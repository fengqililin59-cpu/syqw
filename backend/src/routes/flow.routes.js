/**
 * @file 自动化流程引擎 API。
 */
import { Router } from 'express';
import * as flowController from '../controllers/flow.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/meta', requirePerm('automation:view'), asyncHandler(flowController.meta));
router.get('/', requirePerm('automation:view'), asyncHandler(flowController.list));
router.post('/', requirePerm('automation:manage'), asyncHandler(flowController.create));
router.post('/bootstrap/welcome', requirePerm('automation:manage'), asyncHandler(flowController.bootstrapWelcome));
router.post('/bootstrap/starter-pack', requirePerm('automation:manage'), asyncHandler(flowController.bootstrapStarterPack));
router.post('/:id/runs', requirePerm('automation:manage'), asyncHandler(flowController.startRun));
router.get('/:id', requirePerm('automation:view'), asyncHandler(flowController.getOne));
router.put('/:id', requirePerm('automation:manage'), asyncHandler(flowController.update));
router.delete('/:id', requirePerm('automation:manage'), asyncHandler(flowController.remove));

export default router;
