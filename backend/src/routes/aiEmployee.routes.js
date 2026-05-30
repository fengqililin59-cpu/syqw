/**
 * @file AI 员工：回复草稿、审核、知识库、运营看板。
 */
import { Router } from 'express';
import * as aiEmployeeController from '../controllers/aiEmployee.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { requireAnyPerm } from '../middlewares/requirePerm.js';
import { requireQuota } from '../middlewares/requireQuota.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/stats',
  requireAnyPerm('dashboard:view', 'inbox:view'),
  asyncHandler(aiEmployeeController.opsStats),
);
router.get(
  '/reply-pending',
  requirePerm('ai:approve'),
  asyncHandler(aiEmployeeController.pendingReplies),
);
router.post(
  '/reply-draft',
  requirePerm('ai:use'),
  requireQuota('ai_calls'),
  asyncHandler(aiEmployeeController.replyDraft),
);
router.post(
  '/reply-approve',
  requirePerm('ai:approve'),
  asyncHandler(aiEmployeeController.replyApprove),
);

router.get('/kb', requireAnyPerm('inbox:manage', 'ai:use'), asyncHandler(aiEmployeeController.listKb));
router.post('/kb/reindex-all', requireAnyPerm('inbox:manage', 'ai:use'), asyncHandler(aiEmployeeController.reindexAllKb));
router.post('/kb', requireAnyPerm('inbox:manage', 'ai:use'), asyncHandler(aiEmployeeController.createKb));
router.get('/kb/:id', requireAnyPerm('inbox:manage', 'ai:use'), asyncHandler(aiEmployeeController.getKb));
router.put('/kb/:id', requireAnyPerm('inbox:manage', 'ai:use'), asyncHandler(aiEmployeeController.updateKb));
router.post('/kb/:id/reindex', requireAnyPerm('inbox:manage', 'ai:use'), asyncHandler(aiEmployeeController.reindexKb));
router.delete('/kb/:id', requireAnyPerm('inbox:manage', 'ai:use'), asyncHandler(aiEmployeeController.archiveKb));

export default router;
