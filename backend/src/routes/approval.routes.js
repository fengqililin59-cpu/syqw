/**
 * @file 审批路由。
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import * as ctrl from '../controllers/approval.controller.js';

const router = Router();

router.use(requireAuth);

// 模板管理
router.get('/templates', requirePerm('customer:read'), asyncHandler(ctrl.listTemplates));
router.get('/templates/:id', requirePerm('customer:read'), asyncHandler(ctrl.getTemplate));
router.post('/templates', requirePerm('customer:manage'), asyncHandler(ctrl.createTemplate));
router.put('/templates/:id', requirePerm('customer:manage'), asyncHandler(ctrl.updateTemplate));
router.delete('/templates/:id', requirePerm('customer:manage'), asyncHandler(ctrl.deleteTemplate));

// 查询列表（具体路由在 /:id 之前）
router.get('/pending/list', requirePerm('customer:read'), asyncHandler(ctrl.listPendingApprovals));
router.get('/processed/list', requirePerm('customer:read'), asyncHandler(ctrl.listProcessedApprovals));
router.get('/', requirePerm('customer:read'), asyncHandler(ctrl.listMyApplications));
router.get('/:id', requirePerm('customer:read'), asyncHandler(ctrl.getInstance));

// 审批操作
router.post('/', requirePerm('customer:read'), asyncHandler(ctrl.submit));
router.post('/:id/approve', requirePerm('customer:read'), asyncHandler(ctrl.approve));
router.post('/:id/reject', requirePerm('customer:read'), asyncHandler(ctrl.reject));
router.post('/:id/cancel', requirePerm('customer:read'), asyncHandler(ctrl.cancel));

export default router;
