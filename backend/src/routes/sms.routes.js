import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as smsController from '../controllers/sms.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/templates', requirePerm('broadcast:view'), asyncHandler(smsController.listTemplates));
router.post('/templates', requirePerm('broadcast:send'), asyncHandler(smsController.createTemplate));
router.patch('/templates/:id', requirePerm('broadcast:send'), asyncHandler(smsController.updateTemplate));
router.delete('/templates/:id', requirePerm('broadcast:send'), asyncHandler(smsController.deleteTemplate));

router.get('/tasks', requirePerm('broadcast:view'), asyncHandler(smsController.listTasks));
router.post('/tasks', requirePerm('broadcast:send'), asyncHandler(smsController.createTask));
router.get('/tasks/:id', requirePerm('broadcast:view'), asyncHandler(smsController.getTask));
router.post('/tasks/:id/cancel', requirePerm('broadcast:send'), asyncHandler(smsController.cancelTask));

router.post('/send', requirePerm('sms:send'), asyncHandler(smsController.sendSingle));
router.get('/logs', requirePerm('broadcast:view'), asyncHandler(smsController.listLogs));
router.get('/stats', requirePerm('dashboard:view'), asyncHandler(smsController.stats));
router.get('/config', requirePerm('settings:manage'), asyncHandler(smsController.getConfig));
router.put('/config', requirePerm('settings:manage'), asyncHandler(smsController.saveConfig));

export default router;
