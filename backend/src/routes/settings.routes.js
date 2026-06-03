/**
 * @file 租户设置路由（需登录 + 管理员）。
 */
import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/audit-logs', requirePerm('audit:view'), asyncHandler(settingsController.listAuditLogs));
router.get('/intent-alerts', requirePerm('dashboard:view'), asyncHandler(settingsController.listIntentAlerts));
router.get(
  '/intent-alerts/:alertId/playbook',
  requirePerm('dashboard:view'),
  asyncHandler(settingsController.getIntentAlertPlaybook),
);
router.get('/wework', requirePerm('settings:manage'), asyncHandler(settingsController.getWework));
router.put('/wework', requirePerm('settings:manage'), asyncHandler(settingsController.updateWework));
router.get('/lead-assignment', requirePerm('settings:manage'), asyncHandler(settingsController.getLeadAssignment));
router.put('/lead-assignment', requirePerm('settings:manage'), asyncHandler(settingsController.updateLeadAssignment));
router.get('/public-webhooks', requirePerm('settings:manage'), asyncHandler(settingsController.getPublicWebhooks));
router.put('/public-webhooks', requirePerm('settings:manage'), asyncHandler(settingsController.updatePublicWebhooks));
router.post('/public-webhooks/sign-preview', requirePerm('settings:manage'), asyncHandler(settingsController.previewPublicWebhookSignatures));
router.get('/health-monitor', requirePerm('settings:manage'), asyncHandler(settingsController.getHealthMonitor));
router.post('/health-monitor/run', requirePerm('settings:manage'), asyncHandler(settingsController.runHealthMonitor));

export default router;
