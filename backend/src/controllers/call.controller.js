import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { CallRecord, Tenant } from '../models/index.js';
import * as callService from '../services/call.service.js';
import * as tcccService from '../services/tccc.service.js';

export async function initiateCall(req, res) {
  const customerId = Number(req.body?.customer_id);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    throw new HttpError(400, '缺少 customer_id', 400);
  }
  const data = await callService.initiateCall(req.auth.tenantId, req.auth.userId, customerId);
  return ok(res, data);
}

export async function hangupCall(req, res) {
  const id = Number(req.params.id);
  const callRecord = await CallRecord.findOne({
    where: { id, tenant_id: Number(req.auth.tenantId) },
  });
  if (!callRecord) throw new HttpError(404, '通话记录不存在', 404);
  const tenant = await Tenant.findByPk(Number(req.auth.tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);
  if (callRecord.tccc_session_id) {
    try {
      await tcccService.hangupCall(tenant, callRecord.tccc_session_id);
    } catch {
      // mock/真实环境下均允许软失败，避免阻塞本地状态更新
    }
  }
  await callRecord.update({ status: 'cancelled', ended_at: new Date() });
  return ok(res, callRecord);
}

export async function listCalls(req, res) {
  const data = await callService.listCallRecords(req.auth.tenantId, req.query || {});
  return ok(res, data);
}

export async function getCallDetail(req, res) {
  const id = Number(req.params.id);
  const row = await CallRecord.findOne({
    where: { id, tenant_id: Number(req.auth.tenantId) },
  });
  if (!row) throw new HttpError(404, '通话记录不存在', 404);
  return ok(res, row);
}

export async function getCallStats(req, res) {
  const data = await callService.getCallStats(req.auth.tenantId, req.query || {});
  return ok(res, data);
}

export async function getMyCallSetting(req, res) {
  const data = await callService.getUserCallSetting(req.auth.userId);
  return ok(res, data);
}

export async function updateMyCallSetting(req, res) {
  const data = await callService.updateUserCallSetting(req.auth.userId, req.auth.tenantId, req.body || {});
  return ok(res, data);
}

export async function getTcccConfig(req, res) {
  const tenant = await Tenant.findByPk(Number(req.auth.tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);
  return ok(res, callService.getTcccConfig(tenant));
}

export async function saveTcccConfig(req, res) {
  const data = await callService.saveTcccConfig(req.auth.tenantId, req.body || {});
  return ok(res, data);
}

export async function tcccCallback(req, res) {
  await callService.handleCallCallback(req.body || {});
  return res.json({ code: 0 });
}
