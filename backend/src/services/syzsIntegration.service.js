/**
 * @file 与智学 AI 平台（www.syzs.top）账号桥接：签发/兑换短期 JWT，绑定同邮箱账号。
 */
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { User, UserSyzsLink, Role, Tenant } from '../models/index.js';
import { signSessionJwt } from './auth.service.js';
import { rawPermissionsFromRole } from '../utils/permissions.js';

const BRIDGE_TYP = 'syzs_account_bridge';
const BRIDGE_TTL = '5m';

function bridgeSecret() {
  const s = env.syzsPlatform.jwtSecret;
  if (!s) {
    throw new HttpError(503, '未配置 SYZS_PLATFORM_JWT_SECRET，无法与智学 AI 联通账号', 503);
  }
  return s;
}

function normalizeEmail(v) {
  const s = String(v || '')
    .trim()
    .toLowerCase();
  return s && s.includes('@') ? s : null;
}

function normalizePhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length >= 8 ? d : null;
}

export function signBridgeFromWework(user, tenant) {
  const email = normalizeEmail(user.email) || normalizeEmail(user.username);
  const phone = normalizePhone(user.phone) || normalizePhone(user.username);
  const payload = {
    typ: BRIDGE_TYP,
    source: 'wework',
    wework_user_id: Number(user.id),
    wework_tenant_id: Number(user.tenant_id),
    tenant_name: tenant?.name || null,
    email,
    phone,
    username: user.username,
    real_name: user.real_name || null,
  };
  const bridgeToken = jwt.sign(payload, bridgeSecret(), { expiresIn: BRIDGE_TTL });
  const base = env.syzsPlatform.webUrl.replace(/\/$/, '');
  // 跳转主站首页（生产已部署 chat 页）；由 ?wework_bridge= 完成 SSO
  const redirectUrl = `${base}/?wework_bridge=${encodeURIComponent(bridgeToken)}`;
  return { bridgeToken, expiresIn: 300, redirectUrl };
}

function verifyBridgeToken(token) {
  if (!token) throw new HttpError(400, '缺少 bridge 凭证', 400);
  try {
    const payload = jwt.verify(String(token), bridgeSecret());
    if (payload.typ !== BRIDGE_TYP) {
      throw new HttpError(400, '无效的 bridge 类型', 400);
    }
    return payload;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(401, 'bridge 已过期或无效', 401);
  }
}

async function findWeworkUserForExchange(payload) {
  const syzsUserId = payload.syzs_user_id ? String(payload.syzs_user_id) : null;
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);

  if (syzsUserId) {
    const link = await UserSyzsLink.findOne({ where: { syzs_user_id: syzsUserId } });
    if (link) {
      const user = await User.findOne({
        where: { id: link.user_id, status: 1 },
        include: [{ model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes'] }],
      });
      if (user) return { user, link };
    }
  }

  const or = [];
  if (email) {
    or.push({ email }, { username: email });
  }
  if (phone) {
    or.push({ phone }, { username: phone });
  }
  if (!or.length) {
    throw new HttpError(
      400,
      '智学 AI 账号缺少可匹配的邮箱或手机，请在平台资料中补全后再试',
      400,
    );
  }

  const candidates = await User.findAll({
    where: { status: 1, [Op.or]: or },
    include: [{ model: Role, attributes: ['id', 'name', 'permissions', 'perm_codes'] }],
    limit: 10,
  });

  if (candidates.length === 0) {
    throw new HttpError(
      404,
      '未找到匹配的企微私域账号。请使用与智学 AI 相同的邮箱/手机登录私域系统，或联系管理员绑定',
      404,
    );
  }
  if (candidates.length > 1) {
    throw new HttpError(
      409,
      '匹配到多个企微私域账号，请联系管理员在后台明确绑定',
      409,
    );
  }

  return { user: candidates[0], link: null };
}

async function upsertLink(user, payload) {
  const syzsUserId = String(payload.syzs_user_id || '');
  if (!syzsUserId) return null;
  const email = normalizeEmail(payload.email);
  const phone = normalizePhone(payload.phone);
  const [link] = await UserSyzsLink.upsert(
    {
      tenant_id: Number(user.tenant_id),
      user_id: Number(user.id),
      syzs_user_id: syzsUserId,
      syzs_email: email,
      syzs_phone: phone,
    },
    { returning: true },
  );
  return link;
}

export async function exchangeFromSyzs(bridgeToken) {
  const payload = verifyBridgeToken(bridgeToken);

  if (payload.source === 'wework') {
    throw new HttpError(400, '请使用智学 AI 平台签发的 bridge 登录私域系统', 400);
  }

  const { user, link } = await findWeworkUserForExchange(payload);
  await upsertLink(user, payload);

  const tenant = await Tenant.findByPk(user.tenant_id, { attributes: ['id', 'name'] });
  await user.update({ last_login_at: new Date() });

  const token = signSessionJwt(user);
  const u = user.get({ plain: true });
  delete u.password_hash;
  if (u.Role) {
    u.role = { id: u.Role.id, name: u.Role.name };
    u.perm_codes = rawPermissionsFromRole(user.Role);
  }

  return {
    token,
    user: u,
    tenant: tenant ? { id: tenant.id, name: tenant.name } : { id: user.tenant_id, name: '' },
    linked: Boolean(link || payload.syzs_user_id),
    redirectUrl: `${env.appUrl.replace(/\/$/, '')}/syzs/callback#token=${encodeURIComponent(token)}`,
  };
}

export async function getLinkStatus(tenantId, userId) {
  const link = await UserSyzsLink.findOne({
    where: { tenant_id: Number(tenantId), user_id: Number(userId) },
  });
  const user = await User.findByPk(userId, {
    attributes: ['id', 'email', 'phone', 'username'],
  });
  return {
    linked: Boolean(link),
    syzs_user_id: link?.syzs_user_id || null,
    syzs_email: link?.syzs_email || null,
    wework_email: normalizeEmail(user?.email) || normalizeEmail(user?.username),
    wework_phone: normalizePhone(user?.phone),
    platform_url: env.syzsPlatform.webUrl,
    wework_app_url: env.appUrl,
  };
}

export async function createBridgeForAuthUser(auth, user) {
  const row = await User.findByPk(auth.userId, {
    include: [{ model: Role, required: false }],
  });
  if (!row || row.status !== 1) throw new HttpError(401, '用户无效', 401);
  const tenant = await Tenant.findByPk(auth.tenantId, { attributes: ['id', 'name'] });
  return signBridgeFromWework(row, tenant);
}
