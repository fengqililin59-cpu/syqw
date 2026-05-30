/**
 * @file 渠道活码路由（分组 + 员工活码）。
 */
import { Router } from 'express';
import * as controller from '../controllers/channelLiveCode.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/groups', requirePerm('channel:view'), asyncHandler(controller.listGroups));
router.post('/groups', requirePerm('channel:manage'), asyncHandler(controller.createGroup));
router.put('/groups/:id', requirePerm('channel:manage'), asyncHandler(controller.updateGroup));
router.delete('/groups/:id', requirePerm('channel:manage'), asyncHandler(controller.removeGroup));

router.get('/channels', requirePerm('channel:view'), asyncHandler(controller.listChannels));
router.post('/channels/employee', requirePerm('channel:manage'), asyncHandler(controller.createEmployeeChannel));
router.put('/channels/:id', requirePerm('channel:manage'), asyncHandler(controller.updateChannel));
router.delete('/channels/:id', requirePerm('channel:manage'), asyncHandler(controller.removeChannel));

export default router;
