import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as groupController from '../controllers/group.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/sop', requirePerm('channel:view'), asyncHandler(groupController.listSopTasks));
router.post('/sop', requirePerm('channel:manage'), asyncHandler(groupController.createSopTask));
router.patch('/sop/:id/status', requirePerm('channel:manage'), asyncHandler(groupController.updateSopStatus));
router.delete('/sop/:id', requirePerm('channel:manage'), asyncHandler(groupController.deleteSopTask));

router.get('/', requirePerm('channel:view'), asyncHandler(groupController.listGroups));
router.post('/sync', requirePerm('settings:manage'), asyncHandler(groupController.syncGroups));
router.get('/:id', requirePerm('channel:view'), asyncHandler(groupController.getGroupDetail));
router.post('/:id/send', requirePerm('broadcast:send'), asyncHandler(groupController.sendToGroup));
router.patch('/:id/webhook', requirePerm('settings:manage'), asyncHandler(groupController.updateWebhook));

export default router;

