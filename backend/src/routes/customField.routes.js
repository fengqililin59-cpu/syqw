/**
 * @file 自定义字段路由
 */
import { Router } from 'express';
import * as ctrl from '../controllers/customField.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

// 字段定义 CRUD
router.get('/defs',       requirePerm('setting:view'),   asyncHandler(ctrl.listDefs));
router.post('/defs',      requirePerm('setting:edit'),   asyncHandler(ctrl.createDef));
router.put('/defs/:id',   requirePerm('setting:edit'),   asyncHandler(ctrl.updateDef));
router.delete('/defs/:id',requirePerm('setting:edit'),   asyncHandler(ctrl.deleteDef));

// 行业模板
router.get('/templates',                              asyncHandler(ctrl.listTemplates));
router.post('/templates/:key/apply', requirePerm('setting:edit'), asyncHandler(ctrl.applyTemplate));

export default router;
