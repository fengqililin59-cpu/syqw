/**
 * @file 套餐计费路由。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { requirePlatformAdmin } from '../middlewares/requirePlatformAdmin.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as billingController from '../controllers/billing.controller.js';

const router = Router();

router.get('/plans', asyncHandler(billingController.getPlans));

router.use(requireAuth);
router.get('/subscription', asyncHandler(billingController.getSubscription));
router.get('/usage', asyncHandler(billingController.getUsage));

router.post('/subscription', requirePlatformAdmin, asyncHandler(billingController.upsertSubscription));
router.post('/payment', requirePerm('settings:manage'), asyncHandler(billingController.createPayment));
router.post('/payment/confirm', requirePlatformAdmin, asyncHandler(billingController.confirmPayment));
router.get('/payments', requirePerm('settings:manage'), asyncHandler(billingController.listPayments));
router.post('/redeem', requirePerm('settings:manage'), asyncHandler(billingController.redeemPromo));

router.get('/platform/pending-payments', requirePlatformAdmin, asyncHandler(billingController.listPendingPaymentsPlatform));
router.get('/platform/promo-codes', requirePlatformAdmin, asyncHandler(billingController.listPromoCodes));
router.post('/platform/promo-codes', requirePlatformAdmin, asyncHandler(billingController.createPromoCode));

export default router;
