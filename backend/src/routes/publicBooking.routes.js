/**
 * @file 客户自助预约（公开，按租户，限流）。
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as publicBookingService from '../services/publicBooking.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';

const router = Router();

const bookingLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ code: 429, message: '提交过于频繁，请稍后再试', data: null });
  },
});

router.get(
  '/:tenantId/slots',
  bookingLimiter,
  asyncHandler(async (req, res) => {
    const data = await publicBookingService.publicSlots(Number(req.params.tenantId), req.query.date);
    return ok(res, data);
  }),
);

router.post(
  '/:tenantId/submit',
  bookingLimiter,
  asyncHandler(async (req, res) => {
    const data = await publicBookingService.submitPublicBooking(Number(req.params.tenantId), req.body);
    return ok(res, data, data.message);
  }),
);

export default router;
