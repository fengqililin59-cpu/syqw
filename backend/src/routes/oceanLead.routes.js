/**
 * @file 巨量引擎表单广告线索 Webhook 路由（公开，无 JWT）。
 * POST /public/ocean-lead/:tenantId
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleOceanLead } from '../controllers/oceanLead.controller.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁' },
});

router.post('/:tenantId', limiter, asyncHandler(handleOceanLead));

export default router;
