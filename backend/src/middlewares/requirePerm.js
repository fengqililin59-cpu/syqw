/**
 * @file 细粒度权限守卫（方案 A：以 JWT 内 perm_codes 为准）。
 */
import { fail } from '../utils/response.js';

function jwtRole(req) {
  const u = req.user;
  if (u && Object.prototype.hasOwnProperty.call(u, '__jwtRole') && u.__jwtRole !== undefined && u.__jwtRole !== null) {
    return u.__jwtRole;
  }
  return u?.get?.('role') ?? u?.role;
}

function tokenHasPerm(perms, code) {
  if (!code) return false;
  if (perms.includes('*')) return true;
  return perms.includes(code);
}

/**
 * @param {string} permCode
 */
export function requirePerm(permCode) {
  return function checkPerm(req, res, next) {
    const perms = req.user?.perm_codes ?? [];
    if (jwtRole(req) !== 'admin' && !tokenHasPerm(perms, permCode)) {
      return fail(res, 403, `缺少权限: ${permCode}`, null, 403);
    }
    return next();
  };
}

/**
 * 满足任一权限即可（常用于 ads:view / dashboard:view 并存阶段）。
 * @param {...string} codes
 */
export function requireAnyPerm(...codes) {
  return function checkAny(req, res, next) {
    const perms = req.user?.perm_codes ?? [];
    if (jwtRole(req) === 'admin') {
      return next();
    }
    for (const c of codes) {
      if (tokenHasPerm(perms, c)) {
        return next();
      }
    }
    return fail(res, 403, `缺少权限（需其一）: ${codes.join(', ')}`, null, 403);
  };
}
