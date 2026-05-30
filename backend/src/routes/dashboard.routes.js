/**
 * @file 仪表盘路由。
 */
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/overview', requirePerm('dashboard:view'), asyncHandler(dashboardController.overview));
router.get('/stats', requirePerm('dashboard:view'), asyncHandler(dashboardController.stats));
router.get('/onboarding', requirePerm('dashboard:view'), asyncHandler(dashboardController.onboarding));
router.get('/charts', requirePerm('dashboard:view'), asyncHandler(dashboardController.charts));

export default router;
