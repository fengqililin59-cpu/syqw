/**
 * @file 客户卡项路由（需登录）。手工调整余额单独用 card:adjust 权限。
 */
import { Router } from 'express';
import * as ctrl from '../controllers/customerCard.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/alerts', requirePerm('card:view'), asyncHandler(ctrl.alerts));
router.get('/:id', requirePerm('card:view'), asyncHandler(ctrl.detail));
router.get('/:id/transactions', requirePerm('card:view'), asyncHandler(ctrl.transactions));

router.post('/', requirePerm('card:edit'), asyncHandler(ctrl.create));
router.post('/:id/consume', requirePerm('card:edit'), asyncHandler(ctrl.consume));
router.post('/:id/recharge', requirePerm('card:edit'), asyncHandler(ctrl.recharge));
router.post('/:id/adjust', requirePerm('card:adjust'), asyncHandler(ctrl.adjust));

export default router;
