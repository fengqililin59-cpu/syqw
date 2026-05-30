/**
 * @file 跟进记录控制器（租户级列表与删除）。
 */
import * as followUpService from '../services/followUp.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await followUpService.listFollowUpsForTenant(req.auth, req.query);
  return ok(res, data);
}

export async function exportList(req, res) {
  const data = await followUpService.exportFollowUpsForTenant(req.auth, req.query);
  return ok(res, data);
}

export async function remove(req, res) {
  const data = await followUpService.deleteFollowUp(req.auth, req.params.id);
  return ok(res, data, '已删除');
}

export async function overdue(req, res) {
  const data = await followUpService.listOverdueFollowUps(req.auth, req.query);
  return ok(res, data);
}
