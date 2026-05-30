/**
 * @file 用户（员工）管理：列表、详情、创建、更新、软删除、重置密码。
 * @description 所有操作限定在当前租户；创建时校验套餐人数上限与角色归属。
 */
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { Tenant, User, Role, Customer } from '../models/index.js';

const createSchema = Joi.object({
  username: Joi.string().trim().min(2).max(50).required(),
  password: Joi.string().min(6).max(72).required(),
  real_name: Joi.string().trim().max(50).allow('', null).optional(),
  role_id: Joi.number().integer().positive().required(),
  phone: Joi.string().trim().max(20).allow('', null).optional(),
  email: Joi.string().trim().max(100).allow('', null).optional(),
  department: Joi.string().trim().max(50).allow('', null).optional(),
}).unknown(false);

const updateSchema = Joi.object({
  real_name: Joi.string().trim().max(50).allow('', null).optional(),
  role_id: Joi.number().integer().positive().optional(),
  phone: Joi.string().trim().max(20).allow('', null).optional(),
  email: Joi.string().trim().max(100).allow('', null).optional(),
  department: Joi.string().trim().max(50).allow('', null).optional(),
  /** 企微成员 userid，与扫码登录返回一致；置空则清除绑定 */
  wework_userid: Joi.string().trim().max(64).allow('', null).optional(),
  status: Joi.number().integer().valid(0, 1).optional(),
}).unknown(false);

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(6).max(72).required(),
}).unknown(false);

const assignRoleSchema = Joi.object({
  role_id: Joi.number().integer().positive().required(),
}).unknown(false);

/** 与 roles.name / database/037 对齐，写入 users.role（admin/sales） */
async function syncLegacyRoleFromRoleId(userRow) {
  const rid = userRow.role_id;
  if (rid == null) {
    await userRow.update({ role: null });
    return;
  }
  const role = await Role.findByPk(rid);
  if (!role) return;
  const n = role.name;
  let legacy = null;
  if (n === '管理员' || n === 'admin') legacy = 'admin';
  else if (n === '销售' || n === 'sales') legacy = 'sales';
  await userRow.update({ role: legacy });
}

async function assertRoleInTenant(tenantId, roleId) {
  const role = await Role.findOne({ where: { id: roleId, tenant_id: tenantId } });
  if (!role) {
    throw new HttpError(400, '角色不存在或不属于本企业', 400);
  }
}

async function assertTenantCapacity(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) {
    throw new HttpError(400, '企业不存在', 400);
  }
  const active = await User.count({ where: { tenant_id: tenantId, status: 1 } });
  if (active >= tenant.max_users) {
    throw new HttpError(403, `已达到套餐允许的最大员工数（${tenant.max_users}）`, 403);
  }
}

export async function listUsers(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: auth.tenantId };

  if (query.keyword) {
    const kw = String(query.keyword).trim();
    if (kw) {
      where[Op.or] = [
        { username: { [Op.like]: `%${kw}%` } },
        { real_name: { [Op.like]: `%${kw}%` } },
        { phone: { [Op.like]: `%${kw}%` } },
      ];
    }
  }
  if (query.status === '0' || query.status === '1') {
    where.status = Number(query.status);
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['id', 'DESC']],
    attributes: { exclude: ['password_hash'] },
    include: [{ model: Role, attributes: ['id', 'name', 'permissions'] }],
  });

  return { list: rows.map((r) => r.get({ plain: true })), total: count, page, size };
}

/** 负责人名下客户数（含无 external_userid；不含软删），不过滤用户在职状态 */
export async function countCustomersForOwner(auth, userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid < 1) {
    throw new HttpError(400, '无效的用户 ID', 400);
  }
  const exists = await User.findOne({ where: { id: uid, tenant_id: auth.tenantId }, attributes: ['id'] });
  if (!exists) {
    throw new HttpError(404, '用户不存在', 404);
  }
  const customer_count = await Customer.count({
    where: { tenant_id: auth.tenantId, owner_id: uid },
  });
  return { user_id: uid, customer_count };
}

export async function getUser(auth, id) {
  const row = await User.findOne({
    where: { id, tenant_id: auth.tenantId },
    attributes: { exclude: ['password_hash'] },
    include: [{ model: Role, attributes: ['id', 'name', 'permissions', 'description'] }],
  });
  if (!row) {
    throw new HttpError(404, '用户不存在', 404);
  }
  return row.get({ plain: true });
}

export async function createUser(auth, body) {
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  await assertTenantCapacity(auth.tenantId);
  await assertRoleInTenant(auth.tenantId, value.role_id);

  const password_hash = await bcrypt.hash(value.password, 10);
  try {
    const row = await User.create({
      tenant_id: auth.tenantId,
      username: value.username,
      password_hash,
      real_name: value.real_name || null,
      role_id: value.role_id,
      phone: value.phone || null,
      email: value.email || null,
      department: value.department || null,
      status: 1,
    });
    return getUser(auth, row.id);
  } catch (e) {
    if (e.name === 'SequelizeUniqueConstraintError') {
      throw new HttpError(409, '该企业下登录账号已存在', 409);
    }
    throw e;
  }
}

export async function updateUser(auth, id, body) {
  const { error, value } = updateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const row = await User.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '用户不存在', 404);
  }

  if (value.role_id != null) {
    await assertRoleInTenant(auth.tenantId, value.role_id);
    row.role_id = value.role_id;
  }
  if (value.status === 0 && Number(id) === auth.userId) {
    throw new HttpError(400, '不能禁用当前登录账号', 400);
  }

  if (Object.prototype.hasOwnProperty.call(value, 'wework_userid')) {
    const raw = value.wework_userid;
    const next = raw == null || raw === '' ? null : String(raw).trim() || null;
    if (next) {
      const dup = await User.findOne({
        where: {
          tenant_id: auth.tenantId,
          wework_userid: next,
          id: { [Op.ne]: Number(id) },
        },
      });
      if (dup) {
        throw new HttpError(409, '该企业下已有其他员工绑定此企微 UserID', 409);
      }
    }
    row.wework_userid = next;
  }

  for (const key of ['real_name', 'phone', 'email', 'department', 'status']) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      row[key] = value[key];
    }
  }

  await row.save();
  if (value.role_id != null) {
    await syncLegacyRoleFromRoleId(row);
  }
  return getUser(auth, id);
}

export async function assignUserRole(auth, userId, body) {
  const { error, value } = assignRoleSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const row = await User.findOne({ where: { id: userId, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '用户不存在', 404);
  }
  await assertRoleInTenant(auth.tenantId, value.role_id);
  await row.update({ role_id: value.role_id });
  await syncLegacyRoleFromRoleId(row);
  return getUser(auth, userId);
}

export async function deleteUser(auth, id) {
  if (Number(id) === auth.userId) {
    throw new HttpError(400, '不能删除当前登录账号', 400);
  }
  const row = await User.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '用户不存在', 404);
  }
  await row.update({ status: 0 });
  return { id: Number(id) };
}

export async function resetUserPassword(auth, id, body) {
  const { error, value } = resetPasswordSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const row = await User.findOne({ where: { id, tenant_id: auth.tenantId, status: 1 } });
  if (!row) {
    throw new HttpError(404, '用户不存在或已禁用', 404);
  }
  const password_hash = await bcrypt.hash(value.password, 10);
  await row.update({ password_hash });
  return { id: Number(id) };
}
