/**
 * @file AI：文案生成、回复建议、上下文聊天（需登录）。
 */
import { Router } from 'express';
import * as aiContentController from '../controllers/aiContent.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { requireQuota } from '../middlewares/requireQuota.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth, requirePerm('ai:use'), requireQuota('ai_calls'));
router.post('/sidebar-scripts', asyncHandler(aiContentController.generateSidebarScripts));
router.post('/generate-copy', asyncHandler(aiContentController.generateCopy));
router.post('/generate-poster', asyncHandler(aiContentController.generatePoster));
router.post('/reply-suggestions', asyncHandler(aiContentController.replySuggestions));
router.post('/chat', asyncHandler(aiContentController.contextChat));
router.post('/assistant', asyncHandler(aiContentController.assistantChat));

export default router;
