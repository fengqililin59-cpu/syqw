/**
 * @file 员工活动路由：老板看板数据 + KPI 目标管理 + AI 教练建议
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { requireQuota } from '../middlewares/requireQuota.js';
import * as ctrl from '../controllers/employeeActivity.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/activity', requirePerm('dashboard:view'), ctrl.getActivity);

// KPI 目标管理（老板/管理员）
router.get('/kpi-targets', requirePerm('dashboard:view'), ctrl.getKpiTargets);
router.post('/kpi-targets', requirePerm('dashboard:manage'), ctrl.upsertKpiTarget);
router.delete('/kpi-targets/:id', requirePerm('dashboard:manage'), ctrl.deleteKpiTarget);

// AI 教练建议
router.post('/coaching-insight', requirePerm('dashboard:view'), requireQuota('ai_calls'), ctrl.getCoachingInsight);

export default router;
