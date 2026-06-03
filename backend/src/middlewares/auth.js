/**
 * @file JWT 鉴权中间件：解析 Bearer Token 并挂载 req.auth / req.user。
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { fail } from '../utils/response.js';
import { Role, User } from '../models/index.js';
import { normalizePermissionCodes, rawPermissionsFromRole } from '../utils/permissions.js';
import { demoModeMiddleware } from './demoMode.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return fail(res, 401, '未登录或 token 缺失', null, 401);
  }
  try {
    const payload = jwt.verify(token, env.jwt.secret);
    const userId = payload.sub;
    const tenantId = payload.tenant_id;
    const isGuest = Boolean(payload.is_guest);
    if (!userId || !tenantId) {
      return fail(res, 401, 'token 无效', null, 401);
    }
    let permFromJwt = Array.isArray(payload.perm_codes) ? payload.perm_codes.map((x) => String(x)) : [];
    const roleFromJwt = Object.prototype.hasOwnProperty.call(payload, 'role') ? payload.role : undefined;

    const user = await User.findOne({
      where: { id: userId, tenant_id: tenantId, status: 1 },
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Role,
          attributes: ['id', 'name', 'permissions', 'perm_codes', 'is_system', 'description'],
        },
      ],
    });
    if (!user) {
      return fail(res, 401, '用户不存在或已禁用', null, 401);
    }
    if (user.Role) {
      const raw = rawPermissionsFromRole(user.Role);
      const dbPerms = Array.isArray(raw) ? raw.map((x) => String(x)) : [];
      if (permFromJwt.length === 0) {
        permFromJwt = dbPerms;
      } else if (dbPerms.length > 0) {
        permFromJwt = normalizePermissionCodes([...permFromJwt, ...dbPerms]);
      }
    }
    const dbRole = user.get ? user.get('role') : user.role ?? null;
    const effectiveLegacyRole = roleFromJwt !== undefined && roleFromJwt !== null ? roleFromJwt : dbRole;

    req.auth = {
      userId: Number(userId),
      tenantId: Number(tenantId),
      roleId: user.role_id != null ? Number(user.role_id) : null,
      roleName: user.Role?.name ?? null,
      legacyRole: effectiveLegacyRole,
      permissions: normalizePermissionCodes(permFromJwt),
      isGuest,
    };

    // 兼容旧代码：部分 controller/route 仍读取 req.tenantId / req.userId
    // 统一在鉴权层注入，避免 Number(undefined) => NaN 进 SQL。
    req.userId = req.auth.userId;
    req.tenantId = req.auth.tenantId;

    req.user = user;
    req.user.perm_codes = permFromJwt;
    /** 与 JWT 同步的过渡 role（admin/sales），不写入数据库 */
    req.user.__jwtRole = effectiveLegacyRole;
    return demoModeMiddleware(req, res, next);
  } catch {
    return fail(res, 401, 'token 无效或已过期', null, 401);
  }
}
