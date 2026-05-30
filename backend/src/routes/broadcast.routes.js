/**
 * @file 企业微信群发任务路由。
 */
import { Router } from 'express';
import * as broadcastController from '../controllers/broadcast.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { requireQuota } from '../middlewares/requireQuota.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePerm('broadcast:view'), asyncHandler(broadcastController.list));
router.get('/export', requirePerm('broadcast:view'), asyncHandler(broadcastController.exportList));
router.get('/:id/recipients', requirePerm('broadcast:view'), asyncHandler(broadcastController.recipients));
router.get('/:id', requirePerm('broadcast:view'), asyncHandler(broadcastController.getOne));
router.post('/', requirePerm('broadcast:send'), requireQuota('broadcasts'), asyncHandler(broadcastController.create));
router.post('/:id/cancel', requirePerm('broadcast:send'), asyncHandler(broadcastController.cancel));
router.post('/:id/run', requirePerm('broadcast:send'), asyncHandler(broadcastController.run));

export default router;
