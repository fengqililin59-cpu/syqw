import * as groupService from '../services/customerGroup.service.js';
import { ok } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';

export async function listGroups(req, res) {
  const { page = 1, size = 20, name, status } = req.query;
  const data = await groupService.listGroups(req.auth.tenantId, {
    page: Number(page),
    size: Number(size),
    name,
    status: status == null || status === '' ? undefined : Number(status),
  });
  return res.json(ok(data));
}

export async function syncGroups(req, res) {
  const result = await groupService.syncGroups(req.auth.tenantId);
  return res.json(ok(result));
}

export async function getGroupDetail(req, res) {
  const { page = 1, size = 50 } = req.query;
  const data = await groupService.getGroupDetail(req.auth.tenantId, Number(req.params.id), {
    page: Number(page),
    size: Number(size),
  });
  return res.json(ok(data));
}

export async function sendToGroup(req, res) {
  const { msg_type = 'text', text } = req.body;
  if (!text) throw new HttpError(400, '消息内容不能为空', 400);
  const result = await groupService.sendToGroup(req.auth.tenantId, Number(req.params.id), {
    msg_type,
    text,
  });
  return res.json(ok(result));
}

export async function updateWebhook(req, res) {
  const { webhook_url = '' } = req.body || {};
  const result = await groupService.updateGroupWebhook(req.auth.tenantId, Number(req.params.id), webhook_url);
  return res.json(ok(result));
}

export async function listSopTasks(req, res) {
  const { page = 1, size = 20, status } = req.query;
  const data = await groupService.listSopTasks(req.auth.tenantId, {
    page: Number(page),
    size: Number(size),
    status,
  });
  return res.json(ok(data));
}

export async function createSopTask(req, res) {
  const data = await groupService.createSopTask(req.auth.tenantId, req.auth.userId, req.body);
  return res.json(ok(data));
}

export async function updateSopStatus(req, res) {
  const { status } = req.body || {};
  if (!status) throw new HttpError(400, '缺少 status', 400);
  const data = await groupService.updateSopStatus(req.auth.tenantId, Number(req.params.id), status);
  return res.json(ok(data));
}

export async function deleteSopTask(req, res) {
  const data = await groupService.deleteSopTask(req.auth.tenantId, Number(req.params.id));
  return res.json(ok(data));
}

