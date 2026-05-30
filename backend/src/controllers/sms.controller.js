import { ok } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';
import * as smsService from '../services/sms.service.js';

export async function listTemplates(req, res) {
  return ok(res, await smsService.listTemplates(req.auth.tenantId));
}

export async function createTemplate(req, res) {
  return ok(res, await smsService.createTemplate(req.auth.tenantId, req.auth.userId, req.body || {}));
}

export async function updateTemplate(req, res) {
  return ok(res, await smsService.updateTemplate(req.auth.tenantId, req.params.id, req.body || {}));
}

export async function deleteTemplate(req, res) {
  return ok(res, await smsService.deleteTemplate(req.auth.tenantId, req.params.id));
}

export async function listTasks(req, res) {
  return ok(res, await smsService.listSmsTasks(req.auth.tenantId, req.query || {}));
}

export async function getTask(req, res) {
  return ok(res, await smsService.getSmsTask(req.auth.tenantId, req.params.id));
}

export async function createTask(req, res) {
  return ok(res, await smsService.createSmsTask(req.auth, req.body || {}));
}

export async function cancelTask(req, res) {
  return ok(res, await smsService.cancelSmsTask(req.auth.tenantId, req.params.id));
}

export async function sendSingle(req, res) {
  const customerId = req.body?.customer_id == null ? null : Number(req.body.customer_id);
  const templateId = Number(req.body?.template_id);
  if (!templateId) throw new HttpError(400, '缺少 template_id', 400);
  return ok(res, await smsService.sendSingleSms(req.auth, customerId, templateId, req.body?.extra_params || {}));
}

export async function listLogs(req, res) {
  return ok(res, await smsService.listSendLogs(req.auth.tenantId, req.query || {}));
}

export async function stats(req, res) {
  return ok(res, await smsService.getSmsStats(req.auth.tenantId, req.query || {}));
}

export async function getConfig(req, res) {
  const { Tenant } = await import('../models/index.js');
  const tenant = await Tenant.findByPk(Number(req.auth.tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);
  return ok(res, smsService.getSmsConfig(tenant));
}

export async function saveConfig(req, res) {
  return ok(res, await smsService.saveSmsConfig(req.auth.tenantId, req.body || {}));
}
