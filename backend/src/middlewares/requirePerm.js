/**
 * @file 细粒度权限守卫（方案 A：以 JWT 内 perm_codes 为准）。
 */
import { LEGACY_PERMISSION_ALIAS } from '../constants/permissionCatalog.js';
import { fail } from '../utils/response.js';
import { hasPerm, isAdmin } from '../utils/permissions.js';

function authFromReq(req) {
  if (req.auth) {
    return {
      permissions: req.auth.permissions ?? [],
      legacyRole: req.auth.legacyRole ?? null,
      roleName: req.auth.roleName ?? null,
    };
  }
  const u = req.user;
  let legacyRole = u?.get?.('role') ?? u?.role ?? null;
  if (u && Object.prototype.hasOwnProperty.call(u, '__jwtRole') && u.__jwtRole !== undefined && u.__jwtRole !== null) {
    legacyRole = u.__jwtRole;
  }
  return {
    permissions: u?.perm_codes ?? [],
    legacyRole,
    roleName: u?.Role?.name ?? null,
  };
}

function permAllowed(auth, permCode) {
  if (!permCode) return true;
  if (hasPerm(auth, permCode)) return true;
  const alias = LEGACY_PERMISSION_ALIAS[permCode];
  if (alias && hasPerm(auth, alias)) return true;
  return false;
}

/**
 * @param {string} permCode
 */
export function requirePerm(permCode) {
  return function checkPerm(req, res, next) {
    const auth = authFromReq(req);
    if (isAdmin(auth) || permAllowed(auth, permCode)) {
      return next();
    }
    return fail(res, 403, `缺少权限: ${permCode}`, null, 403);
  };
}

/**
 * 满足任一权限即可（常用于 ads:view / dashboard:view 并存阶段）。
 * @param {...string} codes
 */
export function requireAnyPerm(...codes) {
  return function checkAny(req, res, next) {
    const auth = authFromReq(req);
    if (isAdmin(auth)) {
      return next();
    }
    for (const c of codes) {
      if (permAllowed(auth, c)) {
        return next();
      }
    }
    return fail(res, 403, `缺少权限（需其一）: ${codes.join(', ')}`, null, 403);
  };
}
