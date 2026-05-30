/**
 * @file 平台超管判定（非租户管理员，用于确认收款、发兑换码等）。
 */
import { env } from '../config/env.js';

export function isPlatformAdminUserId(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return false;
  return env.platformAdminUserIds.includes(id);
}

export function assertPlatformAdmin(auth) {
  if (!auth?.userId || !isPlatformAdminUserId(auth.userId)) {
    const err = new Error('需要平台管理员权限');
    err.status = 403;
    err.httpCode = 403;
    throw err;
  }
}
