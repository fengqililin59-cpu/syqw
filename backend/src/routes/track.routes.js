/**
 * @file 落地页访问追踪路由（公开）。
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as pageTrackingController from '../controllers/pageTracking.controller.js';
import * as marketingEventController from '../controllers/marketingEvent.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';

const router = Router();

/** 公开埋点：按 IP 限频，超限 429；自定义 handler 避免默认行为刷日志 */
const trackLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ code: 429, message: '请求过于频繁', data: null });
  },
});

router.post('/visit', trackLimiter, asyncHandler(pageTrackingController.visit));
router.post('/event', trackLimiter, asyncHandler(marketingEventController.ingest));
router.get('/report', requireAuth, requirePerm('dashboard:view'), asyncHandler(pageTrackingController.report));
router.get('/events/report', requireAuth, requirePerm('dashboard:view'), asyncHandler(marketingEventController.report));
router.get('/events/funnel', requireAuth, requirePerm('dashboard:view'), asyncHandler(marketingEventController.funnelReport));
router.get('/report/details', requireAuth, requirePerm('dashboard:view'), asyncHandler(pageTrackingController.reportDetails));

export default router;
