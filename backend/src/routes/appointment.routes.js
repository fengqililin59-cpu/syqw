/**
 * @file 预约到店路由（需登录）。
 */
import { Router } from 'express';
import * as ctrl from '../controllers/appointment.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/calendar', requirePerm('appointment:view'), asyncHandler(ctrl.calendar));
router.get('/today', requirePerm('appointment:view'), asyncHandler(ctrl.today));
router.get('/', requirePerm('appointment:view'), asyncHandler(ctrl.list));
router.get('/:id', requirePerm('appointment:view'), asyncHandler(ctrl.detail));

router.post('/', requirePerm('appointment:edit'), asyncHandler(ctrl.create));
router.put('/:id', requirePerm('appointment:edit'), asyncHandler(ctrl.update));
router.post('/:id/arrive', requirePerm('appointment:edit'), asyncHandler(ctrl.arrive));
router.post('/:id/complete', requirePerm('appointment:edit'), asyncHandler(ctrl.complete));
router.post('/:id/no-show', requirePerm('appointment:edit'), asyncHandler(ctrl.noShow));
router.post('/:id/cancel', requirePerm('appointment:edit'), asyncHandler(ctrl.cancel));

export default router;
