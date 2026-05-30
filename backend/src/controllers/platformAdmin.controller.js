/**
 * @file 平台方运营后台 API。
 */
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../services/auditLog.service.js';
import { isPlatformAdminUserId } from '../utils/platformAdmin.js';
import * as platformAdminService from '../services/platformAdmin.service.js';
import * as billingService from '../services/billing.service.js';

export async function getAccess(req, res) {
  return ok(res, { is_platform_admin: isPlatformAdminUserId(req.auth.userId) });
}

export async function getOverview(req, res) {
  const data = await platformAdminService.getOverview();
  return ok(res, data);
}

export async function listTenants(req, res) {
  const data = await platformAdminService.listTenants(req.query);
  return ok(res, data);
}

export async function getTenant(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户 ID 无效', 400);
  const data = await platformAdminService.getTenantDetail(tenantId);
  return ok(res, data);
}

export async function grantSubscription(req, res) {
  const tenantId = Number(req.params.tenantId);
  const { plan_code, billing_cycle = 'yearly' } = req.body || {};
  if (!plan_code) throw new HttpError(400, '请选择套餐', 400);
  const data = await platformAdminService.grantTenantSubscription(tenantId, plan_code, billing_cycle);
  await writeAuditLog(req.auth, {
    action: 'platform_grant_subscription',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: { plan_code, billing_cycle },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data);
}

export async function extendTrial(req, res) {
  const tenantId = Number(req.params.tenantId);
  const { days = 14 } = req.body || {};
  const data = await platformAdminService.extendTenantProTrial(tenantId, days);
  await writeAuditLog(req.auth, {
    action: 'platform_extend_trial',
    targetType: 'tenant',
    targetId: String(tenantId),
    detail: { days },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data);
}

export async function listPayments(req, res) {
  const data = await platformAdminService.listAllPayments(req.query);
  return ok(res, data);
}

export async function listPendingPayments(req, res) {
  const data = await billingService.listAllPendingPayments();
  return ok(res, data);
}

export async function confirmPayment(req, res) {
  const { out_trade_no } = req.body || {};
  if (!out_trade_no) throw new HttpError(400, '缺少订单号', 400);
  const result = await billingService.confirmPayment(out_trade_no);
  await writeAuditLog(req.auth, {
    action: 'payment_confirm',
    targetType: 'payment_record',
    targetId: String(out_trade_no),
    detail: { out_trade_no, tenant_id: result.tenant_id },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, result);
}

export async function listPromoCodes(req, res) {
  const rows = await billingService.listPromoCodes();
  return ok(res, rows);
}

export async function createPromoCode(req, res) {
  const row = await billingService.createPromoCode(req.auth.userId, req.body || {});
  await writeAuditLog(req.auth, {
    action: 'promo_create',
    targetType: 'billing_promo_code',
    targetId: String(row.id),
    detail: { code: row.code, plan: row.plan?.code },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, row);
}
