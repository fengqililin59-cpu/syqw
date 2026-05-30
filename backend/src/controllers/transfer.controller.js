/**
 * @file 客户转移 API。
 */
import * as customerTransferService from '../services/customerTransfer.service.js';
import { ok } from '../utils/response.js';

export async function createTransfer(req, res) {
  const body = customerTransferService.validateInitiateBody(req.body);
  const data = await customerTransferService.initiateTransfer(
    req.auth.tenantId,
    req.auth.userId,
    body.from_user_id,
    body.to_user_id,
    body.reason ?? 'resigned',
  );
  return ok(res, data, '已提交转移任务');
}

export async function listTransfers(req, res) {
  const data = await customerTransferService.listTransfers(req.auth.tenantId, req.query);
  return ok(res, data);
}

export async function getTransfer(req, res) {
  const data = await customerTransferService.getTransferStatus(req.auth.tenantId, Number(req.params.id));
  return ok(res, data);
}
