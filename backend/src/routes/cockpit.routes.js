/**
 * @file 老板驾驶舱路由（需登录）。
 */
import { Router } from 'express';
import * as ctrl from '../controllers/cockpit.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAnyPerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

const canView = requireAnyPerm('cockpit:view', 'dashboard:view');

router.get('/overview', canView, asyncHandler(ctrl.overview));
router.get('/trends', canView, asyncHandler(ctrl.trends));
router.get('/suggestions', canView, asyncHandler(ctrl.suggestions));

export default router;
