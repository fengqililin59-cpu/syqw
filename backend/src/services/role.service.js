/**
 * @file 角色服务：角色管理 + 权限字典。
 */
import Joi from 'joi';
import { HttpError } from '../utils/httpError.js';
import { Role, User } from '../models/index.js';
import { canManageStaff, normalizePermissionCodes } from '../utils/permissions.js';
import { PERMISSION_CATALOG } from '../constants/permissionCatalog.js';

/** AI 员工 / 收件箱 / 服务台权限包 */
export const AI_EMPLOYEE_PERMISSION_CODES = [
  'inbox:view',
  'inbox:reply',
  'inbox:manage',
  'ai:approve',
  'ticket:view',
  'ticket:manage',
  'order:view',
  'order:manage',
];

const roleSchema = Joi.object({
  name: Joi.string().trim().min(1).max(32).required(),
  description: Joi.string().trim().max(255).allow('', null).optional(),
  perm_codes: Joi.array().items(Joi.string().trim().max(64)).required(),
}).unknown(false);

function toRoleDto(row) {
  const plain = row?.get ? row.get({ plain: true }) : row;
  const dto = {
    ...plain,
    perm_codes: Array.isArray(plain?.perm_codes) ? plain.perm_codes : [],
  };
  delete dto.permissions;
  return dto;
}

function assertStaffManage(auth) {
  if (!canManageStaff(auth)) {
    throw new HttpError(403, '需要管理员工或系统设置权限', 403);
  }
}

export async function listRoles(auth) {
  assertStaffManage(auth);
  const rows = await Role.findAll({
    where: { tenant_id: auth.tenantId },
    order: [['id', 'ASC']],
  });
  return rows.map((r) => toRoleDto(r));
}

export function getPermissionCatalog() {
  return { permissions: PERMISSION_CATALOG };
}

export async function createRole(auth, body) {
  assertStaffManage(auth);
  const { error, value } = roleSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const perms = normalizePermissionCodes(value.perm_codes || []);
  if (perms.length === 0) throw new HttpError(400, 'perm_codes 不能为空', 400);
  const dup = await Role.findOne({ where: { tenant_id: auth.tenantId, name: value.name } });
  if (dup) throw new HttpError(409, '角色名已存在', 409);
  const row = await Role.create({
    tenant_id: auth.tenantId,
    name: value.name,
    description: value.description || null,
    is_system: 0,
    perm_codes: perms,
  });
  return toRoleDto(row);
}

export async function updateRole(auth, id, body) {
  assertStaffManage(auth);
  const { error, value } = roleSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const row = await Role.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) throw new HttpError(404, '角色不存在', 404);
  const isSystem = Number(row.is_system) === 1;
  if (isSystem && value.name !== row.name) {
    throw new HttpError(400, '系统预设角色不可改名', 400);
  }
  const perms = normalizePermissionCodes(value.perm_codes || []);
  if (perms.length === 0) throw new HttpError(400, 'perm_codes 不能为空', 400);
  const isAdminPreset = row.name === '管理员' || row.name === 'admin';
  if (isAdminPreset && !perms.includes('settings:manage')) {
    throw new HttpError(400, '管理员角色必须包含 settings:manage（或使用 *）', 400);
  }
  const dup = await Role.findOne({ where: { tenant_id: auth.tenantId, name: value.name } });
  if (dup && Number(dup.id) !== Number(id)) throw new HttpError(409, '角色名已存在', 409);
  await row.update({
    name: value.name,
    description: value.description || null,
    perm_codes: perms,
  });
  return toRoleDto(row);
}

function isAdminLikeRole(row, perms) {
  if (Number(row.is_system) === 1) return true;
  const name = String(row.name || '');
  if (/管理员|admin/i.test(name)) return true;
  if (perms.includes('settings:manage') || perms.includes('*')) return true;
  return false;
}

/**
 * 为租户内管理员类角色合并 AI 员工相关权限（幂等）。
 */
export async function grantAiEmployeePermsToAdminRoles(auth) {
  assertStaffManage(auth);
  const roles = await Role.findAll({ where: { tenant_id: auth.tenantId } });
  const updated = [];
  for (const row of roles) {
    const current = normalizePermissionCodes(row.perm_codes || []);
    if (!isAdminLikeRole(row, current)) continue;
    const merged = normalizePermissionCodes([...current, ...AI_EMPLOYEE_PERMISSION_CODES]);
    if (merged.length === current.length && AI_EMPLOYEE_PERMISSION_CODES.every((c) => current.includes(c))) {
      continue;
    }
    await row.update({ perm_codes: merged });
    updated.push({ id: row.id, name: row.name, perm_codes: merged });
  }
  return {
    updated_roles: updated,
    codes_added: AI_EMPLOYEE_PERMISSION_CODES,
    notice: updated.length
      ? '已更新管理员类角色；相关员工需重新登录后权限生效'
      : '未发现需更新的管理员类角色（或权限已齐全）',
  };
}

export async function deleteRole(auth, id) {
  assertStaffManage(auth);
  const row = await Role.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) throw new HttpError(404, '角色不存在', 404);
  if (Number(row.is_system) === 1) {
    throw new HttpError(400, '系统预设角色不允许删除', 400);
  }
  const inUse = await User.count({ where: { tenant_id: auth.tenantId, role_id: row.id, status: 1 } });
  if (inUse > 0) throw new HttpError(400, `该角色仍被 ${inUse} 位在职员工使用`, 400);
  await row.destroy();
  return { id: Number(id) };
}
