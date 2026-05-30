/**
 * @file 套餐计费控制器。
 */
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../services/auditLog.service.js';
import { isPlatformAdminUserId } from '../utils/platformAdmin.js';
import * as billingService from '../services/billing.service.js';

export async function getPlans(req, res) {
  const plans = await billingService.listPlans();
  return ok(res, plans);
}

export async function getSubscription(req, res) {
  const data = await billingService.getSubscription(req.auth.tenantId);
  return ok(res, {
    ...data,
    is_platform_admin: isPlatformAdminUserId(req.auth.userId),
  });
}

export async function getUsage(req, res) {
  const data = await billingService.getUsageSummary(req.auth.tenantId);
  return ok(res, data);
}

/** 仅平台超管：直接开通/变更套餐（线下合同、内测等） */
export async function upsertSubscription(req, res) {
  const { plan_code, billing_cycle = 'monthly', tenant_id: bodyTenantId } = req.body || {};
  if (!plan_code) throw new HttpError(400, '请选择套餐', 400);
  const tenantId = bodyTenantId != null ? Number(bodyTenantId) : req.auth.tenantId;
  if (!Number.isFinite(tenantId)) throw new HttpError(400, '租户无效', 400);
  const sub = await billingService.createSubscription(tenantId, plan_code, billing_cycle);
  await writeAuditLog(req.auth, {
    action: 'subscription_change',
    targetType: 'subscription',
    targetId: String(tenantId),
    detail: { plan_code, billing_cycle, by_platform_admin: true },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, sub);
}

export async function createPayment(req, res) {
  const { plan_code, billing_cycle = 'monthly', pay_channel = 'manual', remark } = req.body || {};
  if (!plan_code) throw new HttpError(400, '请选择套餐', 400);
  const plan = await billingService.getPlanByCode(plan_code);
  const record = await billingService.createPaymentRecord(
    req.auth.tenantId,
    plan.id,
    billing_cycle,
    pay_channel,
    remark,
  );
  return ok(res, record);
}

/** 仅平台超管：确认任意租户线下转账 */
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

export async function listPayments(req, res) {
  const { page = 1, size = 20 } = req.query;
  const data = await billingService.listPayments(req.auth.tenantId, { page: Number(page), size: Number(size) });
  return ok(res, data);
}

export async function redeemPromo(req, res) {
  const { code } = req.body || {};
  const data = await billingService.redeemPromoCode(req.auth.tenantId, req.auth.userId, code);
  await writeAuditLog(req.auth, {
    action: 'promo_redeem',
    targetType: 'subscription',
    targetId: String(req.auth.tenantId),
    detail: { code: String(code || '').trim() },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, data);
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

export async function listPromoCodes(req, res) {
  const rows = await billingService.listPromoCodes();
  return ok(res, rows);
}

export async function listPendingPaymentsPlatform(req, res) {
  const rows = await billingService.listAllPendingPayments();
  return ok(res, rows);
}
