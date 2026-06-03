/**
 * @file 余额、充值、自动续费相关HTTP接口。
 */
import * as balanceService from '../services/balance.service.js';
import * as billingService from '../services/billing.service.js';
import * as wechatPayService from '../services/wechatPay.service.js';
import * as alipayService from '../services/alipay.service.js';
import { PaymentRecord } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { env } from '../config/env.js';

export async function getBalance(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const balance = await balanceService.getOrCreateBalance(tenantId);
  return ok(res, {
    balance: Number(balance.balance),
    total_recharged: Number(balance.total_recharged),
    total_consumed: Number(balance.total_consumed),
  });
}

export async function listRechargePackages(_req, res) {
  const packages = await balanceService.listRechargePackages();
  return ok(res, { list: packages });
}

export async function createRecharge(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const { amount, amount_package_id, pay_channel } = req.body || {};

  let rechargeAmount = 0;
  let bonusAmount = 0;
  let packageName = null;

  if (amount_package_id) {
    const pkg = (await balanceService.listRechargePackages()).find((p) => p.id === Number(amount_package_id));
    if (!pkg) throw new HttpError(400, '无效的充值面额', 400);
    rechargeAmount = Number(pkg.amount);
    bonusAmount = Number(pkg.bonus || 0);
    packageName = pkg.name;
  } else if (amount) {
    rechargeAmount = Number(amount);
  } else {
    throw new HttpError(400, '请选择充值面额或输入金额', 400);
  }

  if (rechargeAmount <= 0) throw new HttpError(400, '充值金额必须大于0', 400);

  const channel = pay_channel === 'transfer' ? 'transfer' : 'manual';

  // 先充基本金额
  const result = await balanceService.rechargeBalance(
    tenantId,
    rechargeAmount,
    channel,
    null,
    packageName ? `${packageName}充值` : '手动充值',
  );

  // 赠送金额
  if (bonusAmount > 0) {
    await balanceService.rechargeBalance(
      tenantId,
      bonusAmount,
      channel,
      null,
      `充值赠送 ¥${bonusAmount.toFixed(2)}`,
    );
  }

  return ok(res, {
    balance: Number(result.balance) + bonusAmount,
    amount: rechargeAmount,
    bonus: bonusAmount,
  });
}

/**
 * 创建余额充值支付订单（微信/支付宝扫码）
 * 返回支付二维码URL，前端展示扫码支付。
 */
export async function createRechargeOrder(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const { amount, amount_package_id, pay_channel } = req.body || {};

  if (!pay_channel || !['wechat', 'alipay'].includes(pay_channel)) {
    throw new HttpError(400, '请选择支付方式（wechat/alipay）');
  }

  let rechargeAmount = 0;
  let bonusAmount = 0;
  let packageName = null;

  if (amount_package_id) {
    const pkg = (await balanceService.listRechargePackages()).find((p) => p.id === Number(amount_package_id));
    if (!pkg) throw new HttpError(400, '无效的充值面额');
    rechargeAmount = Number(pkg.amount);
    bonusAmount = Number(pkg.bonus || 0);
    packageName = pkg.name;
  } else if (amount) {
    rechargeAmount = Number(amount);
  } else {
    throw new HttpError(400, '请选择充值面额或输入金额');
  }

  if (rechargeAmount <= 0) throw new HttpError(400, '充值金额必须大于0');

  const outTradeNo = `BAL${Date.now()}${tenantId}`;
  const subject = packageName
    ? `ZhiFlow 余额充值 - ${packageName}`
    : 'ZhiFlow 余额充值';

  let codeUrl = '';
  let redirectUrl = '';   // 支付宝跳转支付 URL
  let mock = false;

  if (pay_channel === 'wechat') {
    if (!wechatPayService.isWechatPayConfigured()) {
      throw new HttpError(503, '微信支付未配置，请使用其他支付方式', 503);
    }
    const amountFen = Math.round(rechargeAmount * 100);
    const result = await wechatPayService.createNativeOrder({
      outTradeNo,
      description: subject,
      amountFen,
    });
    codeUrl = result.code_url;
    mock = result.mock || false;
  } else {
    // alipay：电脑网站支付，直接跳转支付宝收银台
    if (!alipayService.isAlipayConfigured()) {
      throw new HttpError(503, '支付宝未配置，请使用其他支付方式', 503);
    }
    mock = alipayService.isAlipayMock();
    redirectUrl = mock
      ? null
      : alipayService.buildPagePayUrl({
          outTradeNo,
          subject,
          totalAmountYuan: rechargeAmount,
          returnUrl: `${env.alipay.notifyBaseUrl}/app/billing?status=paid`,
        });
    if (mock) codeUrl = `mock:alipay:${outTradeNo}`;
  }

  await PaymentRecord.create({
    tenant_id: tenantId,
    plan_id: null,
    billing_cycle: 'monthly',
    amount: rechargeAmount,
    currency: 'CNY',
    status: 'pending',
    pay_channel,
    purchase_type: 'balance_recharge',
    out_trade_no: outTradeNo,
    pay_code_url: pay_channel === 'alipay' ? codeUrl || `mock:alipay:${outTradeNo}` : codeUrl,
    remark: packageName ? `${packageName}充值` : `余额充值 ¥${rechargeAmount.toFixed(2)}`,
    metadata: {
      recharge_amount: rechargeAmount,
      bonus_amount: bonusAmount,
      package_name: packageName,
    },
  });

  return ok(res, {
    out_trade_no: outTradeNo,
    code_url: codeUrl,
    redirect_url: redirectUrl,
    amount: rechargeAmount,
    bonus: bonusAmount,
    pay_channel,
    mock,
  });
}

export async function listTransactions(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const size = Math.min(100, Math.max(1, parseInt(String(req.query.size), 10) || 20));
  const type = req.query.type || null;
  const result = await balanceService.listBalanceTransactions(tenantId, { page, size, type });
  return ok(res, result);
}

export async function getAutoRenew(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const sub = await billingService.getSubscription(tenantId);
  return ok(res, {
    auto_renew: sub ? !!sub.auto_renew : false,
    auto_renew_plan_id: sub?.auto_renew_plan_id || null,
    auto_renew_cycle: sub?.auto_renew_cycle || null,
  });
}

export async function updateAutoRenew(req, res) {
  const tenantId = Number(req.auth.tenantId);
  const { auto_renew, plan_code, billing_cycle } = req.body || {};

  const updated = await billingService.updateAutoRenew(tenantId, {
    auto_renew: !!auto_renew,
    plan_code: plan_code || null,
    billing_cycle: billing_cycle || null,
  });

  return ok(res, updated);
}
