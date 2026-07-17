/**
 * @file 报表分析控制器。
 */
import * as analyticsService from '../services/analytics.service.js';
import * as leaderboardService from '../services/leaderboard.service.js';
import { ok } from '../utils/response.js';

export async function funnelReport(req, res) {
  const data = await analyticsService.getFunnelReport(req.auth, req.query);
  return ok(res, data);
}

export async function teamPerformance(req, res) {
  const data = await analyticsService.getTeamPerformance(req.auth, req.query);
  return ok(res, data);
}

export async function customerAnalysis(req, res) {
  const data = await analyticsService.getCustomerAnalysis(req.auth, req.query);
  return ok(res, data);
}

export async function reportSummary(req, res) {
  const data = await analyticsService.getReportSummary(req.auth, req.query);
  return ok(res, data);
}

export async function leaderboard(req, res) {
  const data = await leaderboardService.getWeeklyLeaderboard(req.auth);
  return ok(res, data);
}
