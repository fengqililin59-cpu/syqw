/**
 * @file 渠道活码：分组与员工活码 API。
 */
import * as service from '../services/channelLiveCode.service.js';
import { ok } from '../utils/response.js';

export async function listGroups(req, res) {
  const data = await service.listGroups(req.auth);
  return ok(res, data);
}

export async function createGroup(req, res) {
  const data = await service.createGroup(req.auth, req.body);
  return ok(res, data, '已创建');
}

export async function updateGroup(req, res) {
  const data = await service.updateGroup(req.auth, req.params.id, req.body);
  return ok(res, data, '已更新');
}

export async function removeGroup(req, res) {
  const data = await service.deleteGroup(req.auth, req.params.id);
  return ok(res, data, '已删除');
}

export async function listChannels(req, res) {
  const data = await service.listChannels(req.auth);
  return ok(res, data);
}

export async function createEmployeeChannel(req, res) {
  const data = await service.createEmployeeChannel(req.auth, req.body);
  return ok(res, data, '活码已创建');
}

export async function updateChannel(req, res) {
  const data = await service.updateEmployeeChannel(req.auth, req.params.id, req.body);
  return ok(res, data, '已更新');
}

export async function removeChannel(req, res) {
  const data = await service.deleteChannel(req.auth, req.params.id);
  return ok(res, data, '已删除');
}
