/**
 * @file 统一收件箱路由。
 */
import { Router } from 'express';
import * as inboxController from '../controllers/inbox.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAnyPerm } from '../middlewares/requirePerm.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/followups',
  requireAnyPerm('inbox:view', 'customer:view'),
  asyncHandler(inboxController.listFollowups),
);
router.post(
  '/followups',
  requireAnyPerm('inbox:reply', 'customer:edit'),
  asyncHandler(inboxController.createFollowup),
);
router.post(
  '/followups/:id/done',
  requireAnyPerm('inbox:reply', 'customer:edit'),
  asyncHandler(inboxController.completeFollowup),
);

router.get(
  '/threads',
  requireAnyPerm('inbox:view', 'customer:view'),
  asyncHandler(inboxController.listThreads),
);
router.post(
  '/threads/:id/tickets',
  requireAnyPerm('ticket:manage', 'customer:edit', 'inbox:reply'),
  asyncHandler(inboxController.createTicketFromThread),
);
router.get(
  '/threads/:id/messages',
  requireAnyPerm('inbox:view', 'customer:view'),
  asyncHandler(inboxController.getMessages),
);
router.post(
  '/threads/:id/reply',
  requireAnyPerm('inbox:reply', 'customer:edit'),
  asyncHandler(inboxController.reply),
);
router.patch(
  '/threads/:id',
  requireAnyPerm('inbox:manage', 'customer:edit'),
  asyncHandler(inboxController.updateThread),
);
router.post(
  '/webhooks/:channel',
  requireAnyPerm('inbox:manage', 'customer:edit'),
  asyncHandler(inboxController.webhookIngest),
);
router.post('/sync-wework', requireAdmin, asyncHandler(inboxController.syncWework));
router.post('/sla-scan', requireAdmin, asyncHandler(inboxController.runSlaScan));
router.get(
  '/webhook-info',
  requireAnyPerm('inbox:manage', 'channel:manage'),
  asyncHandler(inboxController.webhookInfo),
);
router.post('/webhook-test', requireAdmin, asyncHandler(inboxController.webhookTest));

export default router;
