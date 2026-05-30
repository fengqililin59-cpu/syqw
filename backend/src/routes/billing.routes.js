/**
 * @file 套餐计费路由。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as billingController from '../controllers/billing.controller.js';

const router = Router();

// 公开套餐列表
router.get('/plans', asyncHandler(billingController.getPlans));

router.use(requireAuth);
router.get('/subscription', asyncHandler(billingController.getSubscription));
router.post('/subscription', requirePerm('settings:manage'), asyncHandler(billingController.upsertSubscription));
router.get('/usage', asyncHandler(billingController.getUsage));
router.post('/payment', requirePerm('settings:manage'), asyncHandler(billingController.createPayment));
router.post('/payment/confirm', requirePerm('settings:manage'), asyncHandler(billingController.confirmPayment));
router.get('/payments', requirePerm('settings:manage'), asyncHandler(billingController.listPayments));

export default router;
