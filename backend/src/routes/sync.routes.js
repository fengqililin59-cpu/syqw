/**
 * @file 同步相关路由：企微客户拉取等（需登录 + 管理员）。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as syncController from '../controllers/sync.controller.js';

const router = Router();

router.use(requireAuth, requirePerm('settings:manage'));
router.post('/customers', asyncHandler(syncController.syncCustomers));

export default router;
