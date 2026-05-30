/**
 * @file 平台方运营后台路由（仅 PLATFORM_ADMIN_USER_IDS）。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePlatformAdmin } from '../middlewares/requirePlatformAdmin.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as platformAdminController from '../controllers/platformAdmin.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/access', asyncHandler(platformAdminController.getAccess));

router.use(requirePlatformAdmin);

router.get('/overview', asyncHandler(platformAdminController.getOverview));
router.get('/tenants', asyncHandler(platformAdminController.listTenants));
router.get('/tenants/:tenantId', asyncHandler(platformAdminController.getTenant));
router.post('/tenants/:tenantId/subscription', asyncHandler(platformAdminController.grantSubscription));
router.post('/tenants/:tenantId/extend-trial', asyncHandler(platformAdminController.extendTrial));

router.get('/payments', asyncHandler(platformAdminController.listPayments));
router.get('/payments/pending', asyncHandler(platformAdminController.listPendingPayments));
router.post('/payments/confirm', asyncHandler(platformAdminController.confirmPayment));

router.get('/promo-codes', asyncHandler(platformAdminController.listPromoCodes));
router.post('/promo-codes', asyncHandler(platformAdminController.createPromoCode));

export default router;
