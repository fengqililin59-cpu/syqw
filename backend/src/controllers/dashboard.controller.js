/**
 * @file 仪表盘控制器：聚合指标接口。
 */
import * as dashboardService from '../services/dashboard.service.js';
import * as onboardingChecklistService from '../services/onboardingChecklist.service.js';
import * as weeklyDigestService from '../services/weeklyDigest.service.js';
import * as churnRiskService from '../services/churnRisk.service.js';
import * as dashboardTodayActionsService from '../services/dashboardTodayActions.service.js';
import * as todayActionsDigestService from '../services/todayActionsDigest.service.js';
import * as acquisitionWizardService from '../services/acquisitionWizard.service.js';
import * as aiEmployeePlaybookService from '../services/aiEmployeePlaybook.service.js';
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

export async function acquisitionWizard(req, res) {
  const data = await acquisitionWizardService.getAcquisitionWizard(req.auth);
  return ok(res, data);
}

export async function aiEmployeePlaybook(req, res) {
  const data = await aiEmployeePlaybookService.getAiEmployeePlaybook(req.auth);
  return ok(res, data);
}

export async function weeklyWins(req, res) {
  const data = await weeklyDigestService.getWeeklyWins(req.auth);
  return ok(res, data);
}

export async function weeklyWinsShare(req, res) {
  const data = await weeklyDigestService.getWeeklyWinsShareText(req.auth);
  return ok(res, data);
}

export async function weeklyWinsPushWework(req, res) {
  const data = await weeklyDigestService.pushWeeklyWinsToWework(req.auth);
  return ok(res, data, data.sent > 0 ? `已推送 ${data.sent} 人` : '暂无接收人或未配置企微');
}

export async function weeklyWinsExport(req, res) {
  const { html, filename } = await weeklyDigestService.buildWeeklyWinsExportHtml(req.auth);
  const encoded = encodeURIComponent(filename);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  return res.send(html);
}

export async function churnRisk(req, res) {
  const data = await churnRiskService.getChurnRiskSummary(req.auth.tenantId);
  return ok(res, data);
}

export async function todayActions(req, res) {
  const data = await dashboardTodayActionsService.getTodayActions(req.auth);
  return ok(res, data);
}

export async function smartAlerts(req, res) {
  const { getSmartAlerts } = await import('../services/smartAlert.service.js');
  const data = await getSmartAlerts(req.auth);
  return ok(res, data);
}

export async function todayActionsPushWework(req, res) {
  const data = await todayActionsDigestService.pushTodayActionsToWework(req.auth);
  return ok(
    res,
    data,
    data.sent > 0 ? `已推送 ${data.sent} 位管理员` : '未推送：请确认已配置企微且管理员已绑定 wework_userid',
  );
}
