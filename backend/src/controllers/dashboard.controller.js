/**
 * @file 仪表盘控制器：聚合指标接口。
 */
import * as dashboardService from '../services/dashboard.service.js';
import * as onboardingChecklistService from '../services/onboardingChecklist.service.js';
import { ok } from '../utils/response.js';

export async function overview(req, res) {
  const data = await dashboardService.getOverview(req.auth);
  return ok(res, data);
}

export async function charts(req, res) {
  const data = await dashboardService.getCharts(req.auth, req.query);
  return ok(res, data);
}

export async function stats(req, res) {
  const data = await dashboardService.getStats(req.auth);
  return ok(res, data);
}

export async function onboarding(req, res) {
  const data = await onboardingChecklistService.getOnboardingChecklist(req.auth);
  return ok(res, data);
}
