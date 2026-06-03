/**
 * @file 公开租户信息（品牌/帮助中心链接，无鉴权）。
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as publicTenantController from '../controllers/publicTenant.controller.js';

const router = Router();

router.get('/:tenantId/branding', asyncHandler(publicTenantController.branding));

export default router;
