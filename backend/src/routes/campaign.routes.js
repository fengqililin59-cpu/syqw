/**
 * @file 裂变活动路由。
 */
import { Router } from 'express';
import * as campaignController from '../controllers/campaign.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePerm('campaign:view'), asyncHandler(campaignController.list));
router.post('/', requirePerm('campaign:manage'), asyncHandler(campaignController.create));
router.get('/:id/stats', requirePerm('campaign:view'), asyncHandler(campaignController.stats));
router.get('/:id/my-enroll', requirePerm('campaign:view'), asyncHandler(campaignController.getMyEnrollment));
router.post('/:id/generate-invite-code', requirePerm('campaign:manage'), asyncHandler(campaignController.generateInviteCode));
router.get('/:id', requirePerm('campaign:view'), asyncHandler(campaignController.getOne));
router.put('/:id', requirePerm('campaign:manage'), asyncHandler(campaignController.update));
router.post('/:id/start', requirePerm('campaign:manage'), asyncHandler(campaignController.start));
router.post('/:id/pause', requirePerm('campaign:manage'), asyncHandler(campaignController.pause));
router.post('/:id/end', requirePerm('campaign:manage'), asyncHandler(campaignController.end));
router.post('/:id/duplicate', requirePerm('campaign:manage'), asyncHandler(campaignController.duplicate));
router.post('/:id/enroll', requirePerm('campaign:manage'), asyncHandler(campaignController.enroll));
router.post('/:id/simulate-invite', requirePerm('campaign:manage'), asyncHandler(campaignController.simulateInvite));

export default router;
