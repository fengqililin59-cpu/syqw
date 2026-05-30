/**
 * @file 平台超管守卫（见 env PLATFORM_ADMIN_USER_IDS）。
 */
import { fail } from '../utils/response.js';
import { isPlatformAdminUserId } from '../utils/platformAdmin.js';

export function requirePlatformAdmin(req, res, next) {
  const userId = req.auth?.userId ?? req.user?.id;
  if (!isPlatformAdminUserId(userId)) {
    return fail(res, 403, '需要平台管理员权限（确认收款、发兑换码等请联系平台方）', null, 403);
  }
  return next();
}
