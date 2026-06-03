/**
 * @file 兼容旧版 CommonJS 路由的鉴权导出（authenticateToken / authorizeTenant）。
 */
import { requireAuth } from '../middlewares/auth.js';

/** @deprecated 请使用 requireAuth */
export function authenticateToken(req, res, next) {
  return requireAuth(req, res, next);
}

/** 租户隔离由 requireAuth 与业务层保证，此处保持兼容 no-op */
export function authorizeTenant(req, res, next) {
  return next();
}
