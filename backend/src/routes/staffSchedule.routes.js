/**
 * @file 服务人员排班路由（需登录）。
 */
import { Router } from 'express';
import * as ctrl from '../controllers/staffSchedule.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePerm('appointment:view'), asyncHandler(ctrl.list));
router.post('/weekly', requirePerm('appointment:edit'), asyncHandler(ctrl.replaceWeekly));
router.post('/', requirePerm('appointment:edit'), asyncHandler(ctrl.create));
router.put('/:id', requirePerm('appointment:edit'), asyncHandler(ctrl.update));
router.delete('/:id', requirePerm('appointment:edit'), asyncHandler(ctrl.remove));

export default router;
