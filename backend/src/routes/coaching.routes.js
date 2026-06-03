/**
 * @file AI 教练建议路由
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as ctrl from '../controllers/coaching.controller.js';

const router = Router();

router.use(requireAuth);
router.use(requirePerm('dashboard:view'));

// 常量
router.get('/types', asyncHandler(ctrl.getCoachTypes));

// 列表 & 生成
router.get('/', asyncHandler(ctrl.list));

// 预览（不入库，须在 /:id 之前）
router.get('/preview/check', asyncHandler(ctrl.preview));

router.get('/:id', asyncHandler(ctrl.get));

// 生成教练建议
router.post('/generate', asyncHandler(ctrl.generate));
router.post('/generate-all', asyncHandler(ctrl.generateAll));

// 状态变更
router.patch('/:id/dismiss', asyncHandler(ctrl.dismiss));
router.patch('/:id/implement', asyncHandler(ctrl.implement));

export default router;
