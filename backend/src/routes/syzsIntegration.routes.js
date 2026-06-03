/**
 * @file 智学 AI 平台账号联通路由。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as syzsIntegrationController from '../controllers/syzsIntegration.controller.js';

const router = Router();

router.get('/config', asyncHandler(syzsIntegrationController.getConfig));
router.post('/exchange', asyncHandler(syzsIntegrationController.exchangeFromSyzs));

router.use(requireAuth);
router.get('/status', asyncHandler(syzsIntegrationController.getStatus));
router.post('/bridge', asyncHandler(syzsIntegrationController.createBridge));

export default router;
