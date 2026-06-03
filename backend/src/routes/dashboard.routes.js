/**
 * @file 仪表盘路由。
 */
import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import * as dashboardConfigCtrl from '../controllers/dashboardConfig.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.get('/overview', requirePerm('dashboard:view'), asyncHandler(dashboardController.overview));
router.get('/stats', requirePerm('dashboard:view'), asyncHandler(dashboardController.stats));
router.get('/onboarding', requirePerm('dashboard:view'), asyncHandler(dashboardController.onboarding));
router.get(
  '/acquisition-wizard',
  requirePerm('dashboard:view'),
  asyncHandler(dashboardController.acquisitionWizard),
);
router.get(
  '/ai-employee-playbook',
  requirePerm('dashboard:view'),
  asyncHandler(dashboardController.aiEmployeePlaybook),
);
router.get('/weekly-wins', requirePerm('dashboard:view'), asyncHandler(dashboardController.weeklyWins));
router.get(
  '/weekly-wins/share',
  requirePerm('dashboard:view'),
  asyncHandler(dashboardController.weeklyWinsShare),
);
router.post(
  '/weekly-wins/push-wework',
  requirePerm('dashboard:view'),
  asyncHandler(dashboardController.weeklyWinsPushWework),
);
router.get(
  '/weekly-wins/export',
  requirePerm('dashboard:view'),
  asyncHandler(dashboardController.weeklyWinsExport),
);
router.get('/churn-risk', requirePerm('dashboard:view'), asyncHandler(dashboardController.churnRisk));
router.get('/today-actions', requirePerm('dashboard:view'), asyncHandler(dashboardController.todayActions));
router.get('/smart-alerts', requirePerm('dashboard:view'), asyncHandler(dashboardController.smartAlerts));
router.post(
  '/today-actions/push-wework',
  requirePerm('dashboard:view'),
  asyncHandler(dashboardController.todayActionsPushWework),
);
router.get('/charts', requirePerm('dashboard:view'), asyncHandler(dashboardController.charts));

// ── Widget 配置 ──
router.get('/widget-config', requirePerm('dashboard:view'), asyncHandler(dashboardConfigCtrl.getConfig));
router.put('/widget-config', requirePerm('setting:edit'), asyncHandler(dashboardConfigCtrl.saveConfig));
router.get('/widget-config/templates', requirePerm('dashboard:view'), asyncHandler(dashboardConfigCtrl.listTemplates));
router.post('/widget-config/templates/:key/apply', requirePerm('setting:edit'), asyncHandler(dashboardConfigCtrl.applyTemplate));

export default router;
