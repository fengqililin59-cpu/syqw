/**
 * @file 数据权限：管理员判断与客户查询 scope（销售仅看自己负责的客户）。
 */
import { ALL_PERMISSION_CODES, LEGACY_PERMISSION_ALIAS } from '../constants/permissionCatalog.js';

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizePermissionCodes(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = new Set();
  for (const x of arr) {
    const code = String(x || '').trim();
    if (!code) continue;
    if (code === '*') {
      out.add('*');
      continue;
    }
    const canonical = LEGACY_PERMISSION_ALIAS[code] || code;
    out.add(canonical);
  }
  if (out.has('*')) return ['*', ...ALL_PERMISSION_CODES];
  return [...out];
}

/** @param {{ permissions?: string[] | null; roleName?: string | null; legacyRole?: string | null }} auth */
export function hasPerm(auth, code) {
  const perms = normalizePermissionCodes(auth?.permissions || []);
  if (perms.includes('*') || perms.includes(code)) return true;
  /** 旧角色仅有 customer:* 时，兼容渠道 / 导入等扩展码 */
  const impliedBy = {
    'channel:view': ['customer:view'],
    'channel:manage': ['customer:edit'],
    'ads:view': ['dashboard:view'],
    'customer:import': ['customer:edit'],
  };
  const fallback = impliedBy[code];
  if (fallback && fallback.some((x) => perms.includes(x))) return true;
  return false;
}

/** @param {{ roleName?: string | null; permissions?: string[] | null; legacyRole?: string | null }} auth */
export function isAdmin(auth) {
  return (
    auth?.legacyRole === 'admin' ||
    auth?.roleName === '管理员' ||
    hasPerm(auth, 'settings:manage')
  );
}

export function canManageStaff(auth) {
  return hasPerm(auth, 'user:manage') || hasPerm(auth, 'settings:manage');
}

/**
 * 客户表 WHERE 片段：始终限制租户；非管理员叠加 owner_id。
 * @param {{ tenantId: number; userId: number; roleName?: string | null }} auth
 */
export function customerWhereScope(auth) {
  const w = { tenant_id: auth.tenantId };
  if (!isAdmin(auth)) {
    w.owner_id = auth.userId;
  }
  return w;
}

/**
 * 合并 Role 上 perm_codes（新）与 permissions（旧 JSON）作为权限原始数组。
 * @param {unknown} role
 */
export function rawPermissionsFromRole(role) {
  if (!role) return [];
  const plain = role.get ? role.get({ plain: true }) : role;
  const pc = plain.perm_codes;
  const p = plain.permissions;
  if (Array.isArray(pc) && pc.length > 0) return pc;
  if (Array.isArray(p) && p.length > 0) return p;
  return [];
}
