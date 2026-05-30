/**
 * @file 套餐计费控制器。
 */
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../services/auditLog.service.js';
import * as billingService from '../services/billing.service.js';

export async function getPlans(req, res) {
  const plans = await billingService.listPlans();
  return ok(res, plans);
}

export async function getSubscription(req, res) {
  const data = await billingService.getSubscription(req.auth.tenantId);
  return ok(res, data);
}

export async function getUsage(req, res) {
  const data = await billingService.getUsageSummary(req.auth.tenantId);
  return ok(res, data);
}

export async function upsertSubscription(req, res) {
  const { plan_code, billing_cycle = 'monthly' } = req.body || {};
  if (!plan_code) throw new HttpError(400, '请选择套餐', 400);
  const sub = await billingService.createSubscription(req.auth.tenantId, plan_code, billing_cycle);
  await writeAuditLog(req.auth, {
    action: 'subscription_change',
    targetType: 'subscription',
    targetId: String(req.auth.tenantId),
    detail: { plan_code, billing_cycle },
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

export async function confirmPayment(req, res) {
  const { out_trade_no } = req.body || {};
  if (!out_trade_no) throw new HttpError(400, '缺少订单号', 400);
  const result = await billingService.confirmPayment(out_trade_no);
  await writeAuditLog(req.auth, {
    action: 'payment_confirm',
    targetType: 'payment_record',
    targetId: String(out_trade_no),
    detail: { out_trade_no },
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
