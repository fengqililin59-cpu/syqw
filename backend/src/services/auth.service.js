/**
 * @file 认证服务：企业注册、登录、当前用户信息。
 * @description JWT 携带 sub、tenant_id、perm_codes（来自 roles）、role（users 过渡字段）。
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { sequelize, Tenant, Role, User, Plan, Subscription } from '../models/index.js';
import * as registrationOtp from './registrationOtp.service.js';
import { bindVisitToUser } from './pageTracking.service.js';
import { bindMarketingEventsToUser, recordServerMarketingEvent } from './marketingEvent.service.js';
import * as billingService from './billing.service.js';
import { rawPermissionsFromRole } from '../utils/permissions.js';

const registerSchemaBase = {
  tenant_name: Joi.string().trim().min(1).max(100).required(),
  username: Joi.string().trim().min(2).max(50).required(),
  password: Joi.string().min(6).max(72).required(),
  real_name: Joi.string().trim().max(50).allow('', null).optional(),
  contact_name: Joi.string().trim().max(50).allow('', null).optional(),
  contact_phone: Joi.string().trim().max(20).allow('', null).optional(),
  attribution_token: Joi.string().trim().length(32).hex().optional(),
  landing_from: Joi.string().trim().max(32).allow('', null).optional(),
  landing_variant: Joi.string().trim().valid('a', 'b').allow('', null).optional(),
  landing_cta: Joi.string().trim().max(64).allow('', null).optional(),
};

const registerSchemaOtpFields = {
  register_channel: Joi.string().valid('email', 'sms').required(),
  register_target: Joi.string().trim().min(3).max(191).required(),
  otp_code: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
};

const registerSchema = Joi.object({ ...registerSchemaBase, ...registerSchemaOtpFields });

const loginSchema = Joi.object({
  tenant_id: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.base': 'tenant_id 必须是数字（企业注册后获得的正整数 ID）',
      'number.integer': 'tenant_id 必须是整数',
    }),
  username: Joi.string().trim().min(1).max(50).required(),
  password: Joi.string().min(1).max(72).required(),
  attribution_token: Joi.string().trim().length(32).hex().optional(),
  landing_from: Joi.string().trim().max(32).allow('', null).optional(),
  landing_variant: Joi.string().trim().valid('a', 'b').allow('', null).optional(),
  landing_cta: Joi.string().trim().max(64).allow('', null).optional(),
});

const GUEST_USER_ID = 9998;
const DEMO_TENANT_ID = 9999;

/**
 * 从已加载 Role 的用户生成 JWT（携带 perm_codes + 过渡 role，供 requirePerm 无库校验）
 * @param {import('sequelize').Model} user
 */
export function signSessionJwt(user, expiresIn = null) {
  const raw = rawPermissionsFromRole(user.Role);
  const perm_codes = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
  const legacyRole = user.get ? user.get('role') : user.role ?? null;
  const payloadIsGuest = user.get ? user.get('is_guest') : user.is_guest;
  const isGuest = payloadIsGuest != null ? Boolean(payloadIsGuest) : false;
  return jwt.sign(
    {
      sub: String(user.id),
      tenant_id: Number(user.tenant_id),
      perm_codes,
      role: legacyRole,
      is_guest: isGuest,
    },
    env.jwt.secret,
    { expiresIn: expiresIn || env.jwt.expiresIn },
  );
}

function stripPassword(user) {
  if (!user) return null;
  const plain = user.get ? user.get({ plain: true }) : { ...user };
  delete plain.password_hash;
  return plain;
}

export async function register(body) {
  const { error, value } = registerSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const ch = value.register_channel;
  const target = value.register_target.trim();
  const uname = value.username.trim();
  if (ch === 'email') {
    const em = target.toLowerCase();
    if (uname.toLowerCase() !== em) {
      throw new HttpError(400, '管理员账号须与接收验证码的邮箱一致', 400);
    }
  } else if (uname.replace(/\D/g, '') !== target.replace(/\D/g, '')) {
    throw new HttpError(400, '管理员账号须与接收验证码的手机号一致', 400);
  }
  await registrationOtp.consumeRegisterOtpIfValid({
    channel: ch,
    target,
    code: value.otp_code,
  });

  const t = await sequelize.transaction();
  try {
    const tenant = await Tenant.create(
      {
        name: value.tenant_name,
        contact_name: value.contact_name || null,
        contact_phone: value.contact_phone || null,
        plan: 'free',
        status: 1,
      },
      { transaction: t }
    );

    await sequelize.query('CALL create_default_roles_for_tenant(?)', {
      replacements: [tenant.id],
      transaction: t,
    });

    const role = await Role.findOne({
      where: { tenant_id: tenant.id, name: '管理员' },
      transaction: t,
    });
    if (!role) {
      throw new HttpError(500, '创建默认角色失败，请确认已执行 database/037_rbac_seed_roles.sql', 500);
    }

    const password_hash = await bcrypt.hash(value.password, 10);
    const loginUsername =
      value.register_channel === 'email' ? value.username.trim().toLowerCase() : value.username.trim();
    const user = await User.create(
      {
        tenant_id: tenant.id,
        username: loginUsername,
        password_hash,
        real_name: value.real_name || null,
        role_id: role.id,
        role: 'admin',
        demo_mode: 0,
        status: 1,
      },
      { transaction: t }
    );

    // 创建默认订阅（免费版，14天试用）
    const freePlan = await Plan.findOne({
      where: { code: 'free', is_active: 1 },
      transaction: t,
    });
    if (freePlan) {
      await Subscription.create(
        {
          tenant_id: tenant.id,
          plan_id: freePlan.id,
          billing_cycle: 'monthly',
          status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 24 * 3600 * 1000),
        },
        { transaction: t },
      );
      // 初始化当月用量行（全零）
      await billingService.ensureUsageRowForTenant(tenant.id, t);
    }

    await t.commit();

    const userWithRole = await User.findByPk(user.id, {
      include: [{ model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes'] }],
    });
    const token = signSessionJwt(userWithRole);
    const u = stripPassword(userWithRole);
    if (u && u.Role) {
      u.role = { id: u.Role.id, name: u.Role.name };
    }
    // Attribution 绑定属于非核心链路，不应影响注册成功响应
    await Promise.allSettled([
      bindVisitToUser(value.attribution_token, tenant.id, user.id),
      bindMarketingEventsToUser(value.attribution_token, tenant.id, user.id),
      recordServerMarketingEvent({
        tenant_id: tenant.id,
        user_id: user.id,
        session_id: value.attribution_token || null,
        event_key: 'registration_complete',
        properties: {
          path: '/register',
          landing_from: value.landing_from || null,
          landing_variant: value.landing_variant || null,
          landing_cta: value.landing_cta || null,
        },
      }),
    ]);
    return {
      token,
      tenant: { id: tenant.id, name: tenant.name },
      user: u,
    };
  } catch (e) {
    if (!t.finished) {
      await t.rollback();
    }
    if (e.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, '该企业下账号已存在', 409);
    }
    throw e;
  }
}

export async function login(body) {
  const { error, value } = loginSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const loginIdentityRaw = String(value.username || '').trim();
  const loginIdentityLower = loginIdentityRaw.toLowerCase();
  const loginIdentityDigits = loginIdentityRaw.replace(/\D/g, '');
  const identityOr = [
    { username: loginIdentityRaw },
    { email: loginIdentityRaw },
    { phone: loginIdentityRaw },
  ];
  if (loginIdentityLower && loginIdentityLower !== loginIdentityRaw) {
    identityOr.push({ username: loginIdentityLower }, { email: loginIdentityLower });
  }
  if (loginIdentityDigits && loginIdentityDigits !== loginIdentityRaw) {
    identityOr.push({ phone: loginIdentityDigits });
  }
  const identityWhere = { [Op.or]: identityOr };

  let user = null;
  if (value.tenant_id != null) {
    const tenantCandidates = await User.findAll({
      where: { tenant_id: value.tenant_id, status: 1, ...identityWhere },
      include: [{ model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes'] }],
      limit: 20,
    });
    const matched = [];
    for (const c of tenantCandidates) {
      // eslint-disable-next-line no-await-in-loop
      const okPwd = await bcrypt.compare(value.password, c.password_hash);
      if (okPwd) matched.push(c);
    }
    if (matched.length === 1) {
      user = matched[0];
    } else if (matched.length > 1) {
      throw new HttpError(409, '该登录标识在同一企业匹配到多个账号，请联系管理员处理', 409);
    }
  } else {
    const candidates = await User.findAll({
      where: { status: 1, ...identityWhere },
      include: [
        { model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes'] },
        { model: Tenant, attributes: ['id', 'name'] },
      ],
      limit: 20,
    });
    if (candidates.length === 1) {
      user = candidates[0];
    } else if (candidates.length > 1) {
      const matched = [];
      for (const c of candidates) {
        // eslint-disable-next-line no-await-in-loop
        const okPwd = await bcrypt.compare(value.password, c.password_hash);
        if (okPwd) matched.push(c);
      }
      if (matched.length === 1) {
        user = matched[0];
      } else if (matched.length > 1) {
        throw new HttpError(
          409,
          '该账号存在于多个企业，请选择企业后登录',
          409,
          matched.map((x) => ({
            tenant_id: Number(x.tenant_id),
            tenant_name: x.Tenant?.name || '',
          })),
        );
      }
    }
  }
  if (!user) {
    throw new HttpError(401, '账号或密码错误', 401);
  }

  const match = await bcrypt.compare(value.password, user.password_hash);
  if (!match) {
    throw new HttpError(401, '账号或密码错误', 401);
  }

  const effectiveTenantId = Number(user.tenant_id);
  if (!Number.isFinite(effectiveTenantId)) {
    throw new HttpError(401, '账号或密码错误', 401);
  }

  await user.update({ last_login_at: new Date() });

  const tenant = await Tenant.findByPk(effectiveTenantId, { attributes: ['id', 'name'] });

  const token = signSessionJwt(user);
  const u = stripPassword(user);
  if (u && u.Role) {
    u.role = { id: u.Role.id, name: u.Role.name };
  }
  const result = {
    token,
    user: u,
    tenant: tenant ? { id: tenant.id, name: tenant.name } : { id: effectiveTenantId, name: '' },
  };
  await Promise.allSettled([
    bindVisitToUser(value.attribution_token, effectiveTenantId, user.id),
    bindMarketingEventsToUser(value.attribution_token, effectiveTenantId, user.id),
    recordServerMarketingEvent({
      tenant_id: effectiveTenantId,
      user_id: user.id,
      session_id: value.attribution_token || null,
      event_key: 'login_success',
      properties: {
        path: '/login',
        landing_from: value.landing_from || null,
        landing_variant: value.landing_variant || null,
        landing_cta: value.landing_cta || null,
      },
    }),
  ]);
  return result;
}

const GUEST_PERM_CODES = [
  'customer:view',
  'customer:edit',
  'customer:delete',
  'customer:import',
  'broadcast:view',
  'campaign:view',
  'automation:view',
  'ai:use',
  'channel:view',
  'dashboard:view',
  'audit:view',
  'call:make',
  'sms:view',
  'intent:view',
];

export async function guestLogin() {
  const guestUser = await User.findOne({
    where: { id: GUEST_USER_ID, tenant_id: DEMO_TENANT_ID, status: 1 },
    include: [{ model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes'] }],
  });

  if (!guestUser) {
    throw new HttpError(503, '演示环境暂不可用', 503);
  }

  await guestUser.update({ demo_mode: 1, last_login_at: new Date() });

  // 访客直接签发预设权限，不依赖 role_obj（role_id 可能为空）
  const token = jwt.sign(
    {
      sub: String(guestUser.id),
      tenant_id: DEMO_TENANT_ID,
      perm_codes: GUEST_PERM_CODES,
      role: 'admin',
      is_guest: true,
    },
    env.jwt.secret,
    { expiresIn: '2h' },
  );
  const u = stripPassword(guestUser);
  if (u && u.Role) {
    u.role = { id: u.Role.id, name: u.Role.name };
  }
  if (u) {
    u.is_guest = true;
  }

  const tenant = await Tenant.findByPk(DEMO_TENANT_ID, { attributes: ['id', 'name'] });

  return {
    token,
    user: u,
    tenant: tenant ? { id: tenant.id, name: tenant.name } : { id: DEMO_TENANT_ID, name: '演示企业' },
  };
}

export async function getMe(auth) {
  const user = await User.findOne({
    where: { id: auth.userId, tenant_id: auth.tenantId, status: 1 },
    attributes: { exclude: ['password_hash'] },
    include: [
      { model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes', 'description'] },
      { model: Tenant, attributes: ['id', 'name', 'plan', 'status', 'expired_at', 'max_users'] },
    ],
  });
  if (!user) {
    throw new HttpError(401, '用户不存在或已禁用', 401);
  }
  return user.get({ plain: true });
}

