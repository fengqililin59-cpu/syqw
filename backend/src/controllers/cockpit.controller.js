/**
 * @file 老板驾驶舱控制器。
 */
import * as cockpitService from '../services/cockpit.service.js';
import { ok } from '../utils/response.js';

export async function overview(req, res) {
  const data = await cockpitService.getOverview(req.auth.tenantId);
  return ok(res, data);
}

export async function trends(req, res) {
  const data = await cockpitService.getTrends(req.auth.tenantId, req.query.days);
  return ok(res, data);
}

export async function suggestions(req, res) {
  const data = await cockpitService.getSuggestions(req.auth.tenantId);
  return ok(res, data);
}
