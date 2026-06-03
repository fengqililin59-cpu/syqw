/**
 * @file 通知中心路由。
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import * as ctrl from '../controllers/notification.controller.js';

const router = Router();

router.use(requireAuth);

// 所有通知接口需要登录即可（customer:read 是最基础权限）
router.get('/', requirePerm('customer:read'), asyncHandler(ctrl.list));
router.get('/unread-count', asyncHandler(ctrl.unreadCount));
router.get('/recent', requirePerm('customer:read'), asyncHandler(ctrl.recent));
router.get('/types', requirePerm('customer:read'), asyncHandler(ctrl.types));
router.put('/:id/read', requirePerm('customer:read'), asyncHandler(ctrl.markRead));
router.put('/read-all', requirePerm('customer:read'), asyncHandler(ctrl.markAllRead));

export default router;
