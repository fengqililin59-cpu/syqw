/**
 * @file 销售管道配置路由
 */
import { Router } from 'express';
import * as ctrl from '../controllers/pipelineConfig.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

// 管道配置 CRUD
router.get('/config',                           asyncHandler(ctrl.getConfig));
router.get('/stages',                           asyncHandler(ctrl.getStages));    // 看板专用
router.put('/config',     requirePerm('setting:edit'), asyncHandler(ctrl.saveConfig));
router.post('/reset',     requirePerm('setting:edit'), asyncHandler(ctrl.resetConfig));

// 管道模板
router.get('/templates',                        asyncHandler(ctrl.listTemplates));
router.post('/templates/:key/apply', requirePerm('setting:edit'), asyncHandler(ctrl.applyTemplate));

export default router;
