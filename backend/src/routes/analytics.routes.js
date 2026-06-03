/**
 * @file 报表分析路由。
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import * as analyticsController from '../controllers/analytics.controller.js';

const router = Router();

router.use(requireAuth);

// 报表主页：轻量汇总
router.get('/summary', asyncHandler(analyticsController.reportSummary));

// 销售漏斗分析
router.get('/funnel', requirePerm('customer:read'), asyncHandler(analyticsController.funnelReport));

// 团队业绩
router.get('/team', requirePerm('customer:read'), asyncHandler(analyticsController.teamPerformance));

// 客户分析
router.get('/customers', requirePerm('customer:read'), asyncHandler(analyticsController.customerAnalysis));

export default router;
