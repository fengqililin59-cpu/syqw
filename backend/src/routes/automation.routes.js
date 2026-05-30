/**
 * @file 自动跟进：规则与人工暂停（需登录）。
 */
import { Router } from 'express';
import * as automationController from '../controllers/automation.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/rules', requirePerm('automation:view'), asyncHandler(automationController.listRules));
router.patch('/rules/:id', requirePerm('automation:manage'), asyncHandler(automationController.patchRule));
router.post('/rules/bootstrap', requirePerm('automation:manage'), asyncHandler(automationController.bootstrapRules));
router.post('/run-scan', requirePerm('automation:manage'), asyncHandler(automationController.runScan));
router.patch('/customers/:customerId/pause', requirePerm('automation:manage'), asyncHandler(automationController.setCustomerPause));

export default router;
