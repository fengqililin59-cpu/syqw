/**
 * @file 服务人员排班控制器。
 */
import * as scheduleService from '../services/staffSchedule.service.js';
import { ok } from '../utils/response.js';

export async function list(req, res) {
  const data = await scheduleService.listSchedules(req.auth.tenantId, req.query);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await scheduleService.createSchedule(req.auth.tenantId, req.body);
  return ok(res, data, '排班已添加');
}

export async function update(req, res) {
  const data = await scheduleService.updateSchedule(req.auth.tenantId, req.params.id, req.body);
  return ok(res, data, '排班已更新');
}

export async function remove(req, res) {
  const data = await scheduleService.deleteSchedule(req.auth.tenantId, req.params.id);
  return ok(res, data, '排班已删除');
}

export async function replaceWeekly(req, res) {
  const data = await scheduleService.replaceWeekly(req.auth.tenantId, req.body);
  return ok(res, data, '每周排班已保存');
}
