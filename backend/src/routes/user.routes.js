/**
 * @file 用户（员工）管理路由。
 */
import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAnyPerm, requirePerm } from '../middlewares/requirePerm.js';
import { requireQuota } from '../middlewares/requireQuota.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/:id/customer-count', requirePerm('user:manage'), asyncHandler(userController.customerCount));
router.use(requireAnyPerm('user:manage', 'settings:manage'));

router.get('/', asyncHandler(userController.list));
router.get('/:id', asyncHandler(userController.detail));
router.post('/', requireQuota('seats'), asyncHandler(userController.create));
router.put('/:id/role', asyncHandler(userController.assignRole));
router.put('/:id', asyncHandler(userController.update));
router.delete('/:id', asyncHandler(userController.remove));
router.post('/:id/reset-password', asyncHandler(userController.resetPassword));

export default router;
