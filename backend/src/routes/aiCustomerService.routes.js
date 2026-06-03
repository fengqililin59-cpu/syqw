/**
 * @file AI客服路由：监控面板统计
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import * as ctrl from '../controllers/aiCustomerService.controller.js';

const router = Router();

router.use(requireAuth);

// GET /api/v1/ai-cs/stats — AI客服自动回复统计数据
router.get('/stats', requirePerm('dashboard:view'), ctrl.getStats);

export default router;
