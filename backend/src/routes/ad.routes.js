/**
 * @file 广告监测路由（公开：302 无需 JWT）。
 */
import { Router } from 'express';
import * as adTrackingController from '../controllers/adTracking.controller.js';
import * as adSpendController from '../controllers/adSpend.controller.js';
import * as aggregationController from '../controllers/aggregation.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAnyPerm, requirePerm } from '../middlewares/requirePerm.js';

const router = Router();

router.get('/redirect', asyncHandler(adTrackingController.redirect));
router.get('/wework-state', asyncHandler(adTrackingController.weworkState));
router.post('/conversion', requireAuth, requirePerm('campaign:manage'), asyncHandler(adTrackingController.conversion));
router.get(
  '/conversion/platforms',
  requireAuth,
  requireAnyPerm('ads:view', 'campaign:manage'),
  asyncHandler(adTrackingController.conversionPlatforms),
);
router.get('/roi', requireAuth, requireAnyPerm('ads:view', 'dashboard:view'), asyncHandler(adTrackingController.roi));
router.get('/roi/trend', requireAuth, requireAnyPerm('ads:view', 'dashboard:view'), asyncHandler(adTrackingController.roiTrend));
router.get('/roi/details', requireAuth, requireAnyPerm('ads:view', 'dashboard:view'), asyncHandler(adTrackingController.roiDetails));
router.post('/spend/bulk', requireAuth, requirePerm('settings:manage'), asyncHandler(adSpendController.bulkUpsert));
router.get('/spend', requireAuth, requireAnyPerm('ads:view', 'dashboard:view'), asyncHandler(adSpendController.list));
router.post('/spend/sync/tencent', requireAuth, requirePerm('settings:manage'), asyncHandler(adSpendController.syncTencent));
router.get('/jobs/summary', requireAuth, requirePerm('settings:manage'), asyncHandler(aggregationController.jobQueueSummary));
router.post('/jobs', requireAuth, requirePerm('settings:manage'), asyncHandler(aggregationController.enqueueJob));
router.post('/rollup/run-daily', requireAuth, requirePerm('settings:manage'), asyncHandler(aggregationController.runRollupDailySync));

export default router;
