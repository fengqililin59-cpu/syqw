/**
 * @file 套餐计费控制器。
 */
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { writeAuditLog } from '../services/auditLog.service.js';
import { isPlatformAdminUserId } from '../utils/platformAdmin.js';
import * as billingService from '../services/billing.service.js';
import * as invoiceRequestService from '../services/invoiceRequest.service.js';
import * as billingStatementService from '../services/billingStatement.service.js';
import * as wechatMpOAuthService from '../services/wechatMpOAuth.service.js';
import { env } from '../config/env.js';
import { isWechatPayMock } from '../services/wechatPay.service.js';
import { isAlipayConfigured, isAlipayMock } from '../services/alipay.service.js';
import { BillingInvoiceRequest, Tenant, PaymentRecord, Plan } from '../models/index.js';

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

export async function getPaymentChannels(req, res) {
  return ok(res, billingService.getPaymentChannels());
}

export async function createPayment(req, res) {
  const { plan_code, billing_cycle = 'monthly', pay_channel = 'manual', remark } = req.body || {};
  if (!plan_code) throw new HttpError(400, '请选择套餐', 400);

  if (pay_channel === 'wechat' || pay_channel === 'wechat_jsapi') {
    const record =
      pay_channel === 'wechat_jsapi'
        ? await billingService.createWechatJsapiPayment(req.auth, plan_code, billing_cycle)
        : await billingService.createWechatPayment(req.auth.tenantId, plan_code, billing_cycle);
    return ok(res, record);
  }

  if (pay_channel === 'alipay') {
    if (!isAlipayConfigured()) {
      throw new HttpError(503, '支付宝支付暂未开放，请使用微信或线下转账', 503);
    }
    const record = await billingService.createAlipayPayment(req.auth.tenantId, plan_code, billing_cycle);
    return ok(res, record);
  }

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

export async function getPaymentStatus(req, res) {
  const { outTradeNo } = req.params;
  const data = await billingService.getPaymentStatusForTenant(req.auth.tenantId, outTradeNo);
  return ok(res, data);
}

export async function wechatPayWebhook(req, res) {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  try {
    const result = await billingService.handleWechatPayNotify(req.headers, rawBody);
    return res.status(200).json({ code: 'SUCCESS', message: '成功', ...result });
  } catch (e) {
    console.error('[billing] wechat webhook', e);
    return res.status(e.statusCode === 401 ? 401 : 500).json({
      code: 'FAIL',
      message: e.message || '处理失败',
    });
  }
}

/** 仅 WECHAT_PAY_MOCK=1：模拟支付成功（本地联调） */
export async function alipayPayWebhook(req, res) {
  const rawBody = req.rawBody || '';
  try {
    await billingService.handleAlipayNotify(rawBody, req.body);
    return res.type('text/plain').send('success');
  } catch (e) {
    console.error('[billing] alipay webhook', e);
    return res.status(e.statusCode === 401 ? 401 : 500).type('text/plain').send('failure');
  }
}

/** 仅 ALIPAY_MOCK=1：模拟支付成功 */
export async function alipayPayMockWebhook(req, res) {
  const { out_trade_no: outTradeNo } = req.body || {};
  if (!outTradeNo) throw new HttpError(400, '缺少 out_trade_no', 400);
  if (!isAlipayMock()) throw new HttpError(404, '未启用', 404);
  await billingService.confirmPayment(String(outTradeNo));
  return ok(res, { paid: true, out_trade_no: outTradeNo });
}

export async function wechatPayMockWebhook(req, res) {
  const { out_trade_no: outTradeNo } = req.body || {};
  if (!outTradeNo) throw new HttpError(400, '缺少 out_trade_no', 400);
  if (!isWechatPayMock()) throw new HttpError(404, '未启用', 404);
  await billingService.confirmPayment(String(outTradeNo));
  return ok(res, { paid: true, out_trade_no: outTradeNo });
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

export async function listPendingOnlinePayments(req, res) {
  const list = await billingService.listPendingOnlinePayments(req.auth.tenantId);
  return ok(res, { list });
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

export async function getWechatJsapiReady(req, res) {
  const returnTo = String(req.query.return_to || '/app/billing').slice(0, 500);
  const data = await billingService.getWechatJsapiReady(req.auth, returnTo);
  return ok(res, data);
}

export async function getWechatMpOAuthUrl(req, res) {
  const returnTo = String(req.query.return_to || '/app/billing').slice(0, 500);
  const url = wechatMpOAuthService.buildMpOAuthUrl(req.auth.userId, returnTo);
  return ok(res, { url });
}

export async function wechatMpOAuthCallback(req, res) {
  const base = env.frontendUrl.replace(/\/$/, '');
  const { code, state } = req.query;
  if (!code || !state) {
    return res.redirect(302, `${base}/app/billing?wx_pay_oauth=invalid`);
  }
  try {
    const { returnTo } = await wechatMpOAuthService.exchangeCodeAndBindUser(String(code), String(state));
    const path = String(returnTo || '/app/billing').startsWith('/') ? returnTo : `/app/billing`;
    const sep = path.includes('?') ? '&' : '?';
    return res.redirect(302, `${base}${path}${sep}wx_pay_oauth=ok`);
  } catch (e) {
    console.error('[billing] mp oauth', e);
    return res.redirect(302, `${base}/app/billing?wx_pay_oauth=fail`);
  }
}

export async function listInvoiceRequests(req, res) {
  const data = await invoiceRequestService.listTenantInvoiceRequests(req.auth, req.query);
  return ok(res, data);
}

export async function exportSubscriptionStatement(req, res) {
  const months = Number(req.query.months) || 12;
  const month = req.query.month ? String(req.query.month) : undefined;
  const format = String(req.query.format || 'pdf').toLowerCase();
  const baseOpts = { tenantId: req.auth.tenantId, months, month };

  if (format === 'pdf') {
    const { buffer, filename, period_label, bill_no } =
      await billingStatementService.buildSubscriptionStatementPdf(baseOpts);
    await writeAuditLog(req.auth, {
      action: 'billing_statement_export',
      targetType: 'tenant',
      targetId: String(req.auth.tenantId),
      detail: { format: 'pdf', months, month: month || null, period_label, bill_no },
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    return res.send(buffer);
  }

  const { html, filename, period_label, bill_no } =
    await billingStatementService.buildSubscriptionStatementHtml(baseOpts);
  await writeAuditLog(req.auth, {
    action: 'billing_statement_export',
    targetType: 'tenant',
    targetId: String(req.auth.tenantId),
    detail: { format: 'html', months, month: month || null, period_label, bill_no },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  const encoded = encodeURIComponent(filename);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
  return res.send(html);
}

export async function createInvoiceRequest(req, res) {
  const row = await invoiceRequestService.createInvoiceRequest(req.auth, req.body);
  await writeAuditLog(req.auth, {
    action: 'invoice_request_create',
    targetType: 'billing_invoice_request',
    targetId: String(row.id),
    detail: { amount: row.amount, invoice_type: row.invoice_type },
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return ok(res, row);
}

/**
 * 下载已开具的电子发票（HTML格式，可打印为PDF）。
 */
export async function downloadInvoice(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const invoiceId = Number(req.params.invoiceId);
  const row = await BillingInvoiceRequest.findOne({
    where: { id: invoiceId, tenant_id: tenantId, status: 'issued' },
    include: [
      { model: Tenant, attributes: ['id', 'name'] },
      { model: PaymentRecord, required: false, include: [{ model: Plan, as: 'plan', attributes: ['name'], required: false }] },
    ],
  });
  if (!row) throw new HttpError(404, '发票不存在或未开具');

  const html = invoiceRequestService.generateInvoiceHtml(row);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${row.id}.html"`);
  res.send(html);
}

/**
 * 获取/设置自动开票偏好。
 */
export async function getAutoInvoice(_req, res) {
  return ok(res, { auto_invoice: false });
}

export async function updateAutoInvoice(req, res) {
  const { auto_invoice } = req.body || {};
  if (auto_invoice !== undefined) {
    await PaymentRecord.update(
      { auto_invoice: !!auto_invoice },
      { where: { tenant_id: Number(req.auth.tenantId), status: 'paid' } },
    );
  }
  return ok(res, { auto_invoice: !!auto_invoice });
}
