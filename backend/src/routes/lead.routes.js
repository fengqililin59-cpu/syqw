/**
 * @file H5 留资（公开，按租户）。
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as leadCaptureController from '../controllers/leadCapture.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const leadLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ code: 429, message: '提交过于频繁，请稍后再试', data: null });
  },
});

router.post('/:tenantId/submit', leadLimiter, asyncHandler(leadCaptureController.submit));

export default router;
