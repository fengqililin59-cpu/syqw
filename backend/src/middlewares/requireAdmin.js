/**
 * @file 管理员路由守卫（基于 JWT 后加载的 roleName）。
 */
import { requirePerm } from './requirePerm.js';

export const requireAdmin = requirePerm('settings:manage');
