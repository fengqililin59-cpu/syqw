import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as callController from '../controllers/call.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', requirePerm('call:make'), asyncHandler(callController.initiateCall));
router.get('/', requirePerm('customer:view'), asyncHandler(callController.listCalls));
router.get('/stats', requirePerm('dashboard:view'), asyncHandler(callController.getCallStats));
router.get('/settings/me', asyncHandler(callController.getMyCallSetting));
router.put('/settings/me', asyncHandler(callController.updateMyCallSetting));
router.get('/tccc-config', requirePerm('settings:manage'), asyncHandler(callController.getTcccConfig));
router.put('/tccc-config', requirePerm('settings:manage'), asyncHandler(callController.saveTcccConfig));
router.get('/:id', requirePerm('customer:view'), asyncHandler(callController.getCallDetail));
router.post('/:id/hangup', requirePerm('call:make'), asyncHandler(callController.hangupCall));

export default router;
