/**
 * @file 计费服务：订阅、配额、用量与支付记录。
 */
import Joi from 'joi';
import { Op, QueryTypes } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { sequelize } from '../config/database.js';
import { Customer, PaymentRecord, Plan, Subscription, UsageStat, User, BillingPromoCode, BillingPromoRedemption, Tenant, TenantBalance } from '../models/index.js';
import * as balanceService from './balance.service.js';
import * as wechatPayService from './wechatPay.service.js';
import * as wechatMpOAuthService from './wechatMpOAuth.service.js';
import * as alipayService from './alipay.service.js';
import { env } from '../config/env.js';

const RESOURCE_MAP = {
  customers: { usageField: 'customers_count', limitField: 'customers_limit' },
  seats: { usageField: 'seats_count', limitField: 'seats_limit' },
  broadcasts: { usageField: 'broadcasts_used', limitField: 'broadcasts_monthly' },
  ai_calls: { usageField: 'ai_calls_used', limitField: 'ai_calls_monthly' },
};

const listPaymentsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
}).unknown(false);

function currentMonth() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function plusPeriod(now, billingCycle) {
  const d = new Date(now);
  if (billingCycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function calcDaysRemaining(endAt) {
  if (!endAt) return null;
  const ms = new Date(endAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 3600 * 1000));
}

async function ensureUsageRow(tenantId, statMonth, transaction = null) {
  await sequelize.query(
    `INSERT INTO usage_stats (tenant_id, stat_month)
     VALUES (:tenantId, :statMonth)
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    { replacements: { tenantId: Number(tenantId), statMonth }, transaction },
  );
}

async function getOrInitUsageStat(tenantId, statMonth) {
  let usage = await UsageStat.findOne({ where: { tenant_id: tenantId, stat_month: statMonth } });
  if (!usage) {
    const [customersCount, seatsCount] = await Promise.all([
      Customer.count({ where: { tenant_id: tenantId } }),
      User.count({ where: { tenant_id: tenantId } }),
    ]);
    await sequelize.query(
      `INSERT INTO usage_stats (tenant_id, stat_month, customers_count, seats_count, broadcasts_used, ai_calls_used)
       VALUES (:tenantId, :statMonth, :customersCount, :seatsCount, 0, 0)
       ON DUPLICATE KEY UPDATE
         customers_count = VALUES(customers_count),
         seats_count = VALUES(seats_count),
         updated_at = NOW()`,
      {
        replacements: { tenantId: Number(tenantId), statMonth, customersCount, seatsCount },
      },
    );
    usage = await UsageStat.findOne({ where: { tenant_id: tenantId, stat_month: statMonth } });
  }
  return usage;
}

async function getFreePlan() {
  const free = await Plan.findOne({ where: { code: 'free', is_active: 1 } });
  if (!free) throw new HttpError(500, '系统未配置免费套餐', 500);
  return free;
}

async function getProPlan() {
  const pro = await Plan.findOne({ where: { code: 'pro', is_active: 1 } });
  if (!pro) throw new HttpError(500, '系统未配置专业版套餐', 500);
  return pro;
}

export async function downgradeTenantToFree(tenantId, transaction = null) {
  const free = await getFreePlan();
  const sub = await Subscription.findOne({ where: { tenant_id: tenantId }, transaction });
  if (!sub) return;
  await sub.update(
    {
      plan_id: free.id,
      status: 'active',
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      cancelled_at: null,
    },
    { transaction },
  );
}

async function ensureSubscriptionWithPlan(tenantId) {
  let sub = await Subscription.findOne({
    where: { tenant_id: tenantId },
    include: [{ model: Plan, as: 'plan', required: false }],
  });
  if (sub) return sub;

  const pro = await getProPlan();
  await Subscription.create({
    tenant_id: tenantId,
    plan_id: pro.id,
    status: 'trialing',
    trial_ends_at: new Date(Date.now() + 14 * 24 * 3600 * 1000),
  });
  sub = await Subscription.findOne({
    where: { tenant_id: tenantId },
    include: [{ model: Plan, as: 'plan', required: false }],
  });
  return sub;
}

/**
 * 当前订阅 + 套餐 + 月用量。
 */
export async function getSubscription(tenantId) {
  const sub = await ensureSubscriptionWithPlan(tenantId);
  const usage = await getOrInitUsageStat(tenantId, currentMonth());
  const plan = sub.plan;
  const endAt = sub.current_period_end || sub.trial_ends_at || null;
  const daysRemaining = calcDaysRemaining(endAt);
  const isExpired = ['expired', 'cancelled'].includes(sub.status) || (daysRemaining != null && daysRemaining < 0);

  return {
    subscription: {
      status: sub.status,
      trial_ends_at: sub.trial_ends_at,
      current_period_end: sub.current_period_end,
      billing_cycle: sub.billing_cycle,
      is_trial: sub.status === 'trialing',
    },
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          code: plan.code,
          price_monthly: Number(plan.price_monthly),
          price_yearly: Number(plan.price_yearly),
          customers_limit: plan.customers_limit,
          seats_limit: plan.seats_limit,
          broadcasts_monthly: plan.broadcasts_monthly,
          ai_calls_monthly: plan.ai_calls_monthly,
          features: plan.features || [],
        }
      : null,
    usage: usage
      ? {
          customers_count: usage.customers_count,
          seats_count: usage.seats_count,
          broadcasts_used: usage.broadcasts_used,
          ai_calls_used: usage.ai_calls_used,
        }
      : {
          customers_count: 0,
          seats_count: 0,
          broadcasts_used: 0,
          ai_calls_used: 0,
        },
    is_expired: isExpired,
    days_remaining: daysRemaining,
  };
}

/**
 * 配额检查。
 */
export async function checkQuota(tenantId, resource) {
  const cfg = RESOURCE_MAP[resource];
  if (!cfg) throw new HttpError(400, `未知配额资源: ${resource}`, 400);

  const sub = await ensureSubscriptionWithPlan(tenantId);
  if (!sub.plan) throw new HttpError(500, '订阅套餐缺失', 500);
  const plan = sub.plan;

  const hasAll = Array.isArray(plan.features) && plan.features.includes('all');
  const limit = Number(plan[cfg.limitField]);
  if (hasAll || limit === -1) {
    return { allowed: true, current: 0, limit, plan_code: plan.code };
  }

  const usage = await getOrInitUsageStat(tenantId, currentMonth());
  const current = Number(usage?.[cfg.usageField] || 0);
  return { allowed: current < limit, current, limit, plan_code: plan.code };
}

/**
 * 原子递增月度用量（并发安全）。
 */
export async function incrementUsage(tenantId, resource, delta = 1) {
  const cfg = RESOURCE_MAP[resource];
  if (!cfg) throw new HttpError(400, `未知用量资源: ${resource}`, 400);
  const field = cfg.usageField;
  const statMonth = currentMonth();
  await sequelize.query(
    `INSERT INTO usage_stats (tenant_id, stat_month, ${field})
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       ${field} = ${field} + VALUES(${field}),
       updated_at = NOW()`,
    { replacements: [Number(tenantId), statMonth, Number(delta)] },
  );
}

export async function listPlans() {
  const rows = await Plan.findAll({
    where: { is_active: 1 },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  return rows.map((x) => ({
    id: x.id,
    name: x.name,
    code: x.code,
    price_monthly: Number(x.price_monthly),
    price_yearly: Number(x.price_yearly),
    customers_limit: x.customers_limit,
    seats_limit: x.seats_limit,
    broadcasts_monthly: x.broadcasts_monthly,
    ai_calls_monthly: x.ai_calls_monthly,
    features: x.features || [],
  }));
}

export async function createSubscription(tenantId, planCode, billingCycle, transaction = null) {
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const plan = await Plan.findOne({ where: { code: String(planCode), is_active: 1 }, transaction });
  if (!plan) throw new HttpError(404, '套餐不存在', 404);

  const now = new Date();
  const periodEnd = plusPeriod(now, cycle);

  const existing = await Subscription.findOne({ where: { tenant_id: tenantId }, transaction });
  if (existing) {
    await existing.update(
      {
        plan_id: plan.id,
        billing_cycle: cycle,
        status: 'active',
        trial_ends_at: null,
        current_period_start: now,
        current_period_end: periodEnd,
        cancelled_at: null,
      },
      { transaction },
    );
  } else {
    await Subscription.create(
      {
        tenant_id: tenantId,
        plan_id: plan.id,
        billing_cycle: cycle,
        status: 'active',
        current_period_start: now,
        current_period_end: periodEnd,
      },
      { transaction },
    );
  }
  if (transaction) {
    return Subscription.findOne({
      where: { tenant_id: tenantId },
      include: [{ model: Plan, as: 'plan', required: false }],
      transaction,
    });
  }
  return getSubscription(tenantId);
}

export async function cancelSubscription(tenantId) {
  const sub = await Subscription.findOne({ where: { tenant_id: tenantId } });
  if (!sub) throw new HttpError(404, '订阅不存在', 404);
  await sub.update({ status: 'cancelled', cancelled_at: new Date() });
  return getSubscription(tenantId);
}

export async function createPaymentRecord(tenantId, planId, billingCycle, payChannel, remark) {
  const plan = await Plan.findByPk(planId);
  if (!plan) throw new HttpError(404, '套餐不存在', 404);
  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const amount = cycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly);
  const outTradeNo = `PAY${Date.now()}${tenantId}`;
  const row = await PaymentRecord.create({
    tenant_id: tenantId,
    plan_id: plan.id,
    billing_cycle: cycle,
    amount,
    status: 'pending',
    pay_channel: ['wechat', 'alipay', 'manual'].includes(payChannel) ? payChannel : 'manual',
    purchase_type: 'subscription',
    out_trade_no: outTradeNo,
    remark: remark ? String(remark).slice(0, 255) : null,
  });
  return row.get({ plain: true });
}

export async function confirmPayment(outTradeNo, extra = {}) {
  const row = await PaymentRecord.findOne({ where: { out_trade_no: String(outTradeNo) } });
  if (!row) throw new HttpError(404, '支付记录不存在', 404);
  if (row.status === 'paid') return row.get({ plain: true });
  if (!['pending', 'failed'].includes(row.status)) {
    throw new HttpError(400, '订单状态不可确认', 400);
  }

  const patch = { status: 'paid', paid_at: new Date() };
  if (extra.wechat_transaction_id) {
    patch.wechat_transaction_id = String(extra.wechat_transaction_id).slice(0, 64);
  }
  await row.update(patch);

  // 根据 purchase_type 分别处理
  const purchaseType = row.purchase_type || 'subscription';

  if (purchaseType === 'balance_recharge') {
    // 余额充值 → 充值到租户余额
    const meta = row.metadata || {};
    const rechargeAmount = Number(meta.recharge_amount || row.amount);
    const bonusAmount = Number(meta.bonus_amount || 0);
    await balanceService.rechargeBalance(
      row.tenant_id,
      rechargeAmount,
      row.pay_channel,
      row.out_trade_no,
      `在线充值 ¥${rechargeAmount.toFixed(2)}`,
    );
    if (bonusAmount > 0) {
      await balanceService.rechargeBalance(
        row.tenant_id,
        bonusAmount,
        row.pay_channel,
        row.out_trade_no,
        `在线充值赠送 ¥${bonusAmount.toFixed(2)}`,
      );
    }
    return row.get({ plain: true });
  }

  // 默认：套餐订阅
  const plan = await Plan.findByPk(row.plan_id);
  if (!plan) throw new HttpError(500, '支付记录套餐不存在', 500);
  await createSubscription(row.tenant_id, plan.code, row.billing_cycle);
  return row.get({ plain: true });
}

export function getPaymentChannels() {
  return {
    wechat: {
      enabled: wechatPayService.isWechatPayConfigured(),
      mock: wechatPayService.isWechatPayMock(),
      jsapi_enabled: wechatPayService.isWechatJsapiEnabled(),
    },
    alipay: {
      enabled: alipayService.isAlipayConfigured(),
      mock: alipayService.isAlipayMock(),
    },
    manual: { enabled: true },
  };
}

const WECHAT_PENDING_REUSE_MS = 2 * 60 * 60 * 1000;

export async function listPendingOnlinePayments(tenantId) {
  const rows = await PaymentRecord.findAll({
    where: {
      tenant_id: Number(tenantId),
      status: 'pending',
      pay_channel: { [Op.in]: ['wechat', 'alipay'] },
    },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false }],
    order: [['id', 'DESC']],
    limit: 5,
  });
  return rows.map((r) => {
    const p = r.get({ plain: true });
    const payCode = p.pay_code_url || null;
    const payMode =
      payCode && String(payCode).startsWith('jsapi:') ? 'jsapi' : payCode ? 'native' : null;
    return {
      id: p.id,
      out_trade_no: p.out_trade_no,
      pay_channel: p.pay_channel,
      billing_cycle: p.billing_cycle,
      amount: Number(p.amount),
      pay_code_url: payCode,
      pay_mode: payMode,
      created_at: p.created_at,
      plan: p.plan ? { id: p.plan.id, name: p.plan.name, code: p.plan.code } : null,
    };
  });
}

export async function createWechatPayment(tenantId, planCode, billingCycle) {
  if (!wechatPayService.isWechatPayConfigured()) {
    throw new HttpError(503, '微信支付未配置，请使用线下转账或兑换码', 503);
  }
  const plan = await getPlanByCode(planCode);
  if (plan.code === 'free') throw new HttpError(400, '体验版无需支付', 400);

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const reuseSince = new Date(Date.now() - WECHAT_PENDING_REUSE_MS);
  const existing = await PaymentRecord.findOne({
    where: {
      tenant_id: Number(tenantId),
      plan_id: plan.id,
      billing_cycle: cycle,
      status: 'pending',
      pay_channel: 'wechat',
      created_at: { [Op.gte]: reuseSince },
      pay_code_url: { [Op.ne]: null },
    },
    order: [['id', 'DESC']],
  });
  if (existing) {
    const plain = existing.get({ plain: true });
    return {
      ...plain,
      code_url: plain.pay_code_url,
      wechat_mock: wechatPayService.isWechatPayMock(),
      reused: true,
    };
  }

  const record = await createPaymentRecord(tenantId, plan.id, billingCycle, 'wechat', null);
  const amountFen = Math.round(Number(record.amount) * 100);
  const cycleLabel = billingCycle === 'yearly' ? '年付' : '月付';
  const { code_url, mock } = await wechatPayService.createNativeOrder({
    outTradeNo: record.out_trade_no,
    description: `ZhiFlow ${plan.name} ${cycleLabel}`,
    amountFen,
  });

  await PaymentRecord.update({ pay_code_url: code_url }, { where: { id: record.id } });

  return {
    ...record,
    pay_code_url: code_url,
    code_url,
    wechat_mock: mock,
    pay_mode: 'native',
  };
}

export async function getWechatJsapiReady(auth, returnTo) {
  const openid = await wechatMpOAuthService.getUserMpOpenid(auth.userId);
  const jsapiEnabled = wechatPayService.isWechatJsapiEnabled();
  let oauth_url = null;
  if (jsapiEnabled && !openid && wechatMpOAuthService.isWechatMpOAuthConfigured()) {
    try {
      oauth_url = wechatMpOAuthService.buildMpOAuthUrl(auth.userId, returnTo);
    } catch {
      oauth_url = null;
    }
  }
  return {
    jsapi_enabled: jsapiEnabled,
    openid_bound: Boolean(openid),
    oauth_url,
  };
}

export async function createWechatJsapiPayment(auth, planCode, billingCycle) {
  if (!wechatPayService.isWechatJsapiEnabled()) {
    throw new HttpError(503, '微信 JSAPI 支付未配置', 503);
  }

  const openid = await wechatMpOAuthService.getUserMpOpenid(auth.userId);
  if (!openid && !wechatPayService.isWechatPayMock()) {
    throw new HttpError(400, '请先在微信内完成支付授权', 400, { need_oauth: true });
  }

  const tenantId = auth.tenantId;
  const plan = await getPlanByCode(planCode);
  if (plan.code === 'free') throw new HttpError(400, '体验版无需支付', 400);

  const record = await createPaymentRecord(tenantId, plan.id, billingCycle, 'wechat', null);
  const amountFen = Math.round(Number(record.amount) * 100);
  const cycleLabel = billingCycle === 'yearly' ? '年付' : '月付';
  const { prepay_id, mock, jsapi_params } = await wechatPayService.createJsapiOrder({
    outTradeNo: record.out_trade_no,
    description: `ZhiFlow ${plan.name} ${cycleLabel}`,
    amountFen,
    openid: openid || 'mock_openid_dev',
  });

  const marker = `jsapi:${prepay_id}`;
  await PaymentRecord.update({ pay_code_url: marker }, { where: { id: record.id } });

  return {
    ...record,
    pay_code_url: marker,
    pay_mode: 'jsapi',
    prepay_id,
    jsapi_params,
    wechat_mock: mock,
  };
}

export async function createAlipayPayment(tenantId, planCode, billingCycle) {
  if (env.alipay.disabled) {
    throw new HttpError(503, '支付宝支付暂未开放，请使用微信或线下转账', 503);
  }
  if (!alipayService.isAlipayConfigured()) {
    throw new HttpError(503, '支付宝未配置，请使用微信、线下转账或兑换码', 503);
  }
  const plan = await getPlanByCode(planCode);
  if (plan.code === 'free') throw new HttpError(400, '体验版无需支付', 400);

  const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const reuseSince = new Date(Date.now() - WECHAT_PENDING_REUSE_MS);
  const existing = await PaymentRecord.findOne({
    where: {
      tenant_id: Number(tenantId),
      plan_id: plan.id,
      billing_cycle: cycle,
      status: 'pending',
      pay_channel: 'alipay',
      created_at: { [Op.gte]: reuseSince },
      pay_code_url: { [Op.ne]: null },
    },
    order: [['id', 'DESC']],
  });
  if (existing) {
    const plain = existing.get({ plain: true });
    const isMock = alipayService.isAlipayMock();
    const code = String(plain.pay_code_url || '');
    const isMockUrl = code.startsWith('mock:alipay:');
    return {
      ...plain,
      pay_code_url: code,
      redirect_url: isMock || isMockUrl ? null : code,
      alipay_mock: isMock || isMockUrl,
      reused: true,
    };
  }

  const record = await createPaymentRecord(tenantId, plan.id, billingCycle, 'alipay', null);
  const cycleLabel = billingCycle === 'yearly' ? '年付' : '月付';
  const isMock = alipayService.isAlipayMock();
  const redirectUrl = isMock
    ? null
    : alipayService.buildPagePayUrl({
        outTradeNo: record.out_trade_no,
        subject: `ZhiFlow ${plan.name} ${cycleLabel}`,
        totalAmountYuan: record.amount,
        returnUrl: `${alipayService.notifyBaseUrl || ''}/app/billing?status=paid`,
      });
  const payCodeUrl = isMock ? `mock:alipay:${record.out_trade_no}` : redirectUrl;

  await PaymentRecord.update({ pay_code_url: payCodeUrl }, { where: { id: record.id } });

  return {
    ...record,
    pay_code_url: payCodeUrl,
    redirect_url: redirectUrl,
    alipay_mock: isMock,
  };
}

export async function getPaymentStatusForTenant(tenantId, outTradeNo) {
  const row = await PaymentRecord.findOne({
    where: { tenant_id: Number(tenantId), out_trade_no: String(outTradeNo) },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false }],
  });
  if (!row) throw new HttpError(404, '订单不存在', 404);
  const p = row.get({ plain: true });
  return {
    out_trade_no: p.out_trade_no,
    status: p.status,
    amount: Number(p.amount),
    pay_channel: p.pay_channel,
    paid_at: p.paid_at,
    plan: p.plan ? { id: p.plan.id, name: p.plan.name, code: p.plan.code } : null,
  };
}

export async function handleAlipayNotify(rawBody, bodyObj) {
  const parsed = alipayService.parsePayNotification(rawBody, bodyObj);
  if (!parsed.handled) return { ack: 'success', skipped: true, ...parsed };

  const row = await PaymentRecord.findOne({ where: { out_trade_no: String(parsed.out_trade_no) } });
  if (!row) throw new HttpError(404, '订单不存在', 404);

  const expected = Number(row.amount).toFixed(2);
  if (parsed.total_amount != null && Number(parsed.total_amount).toFixed(2) !== expected) {
    console.error('[billing] alipay amount mismatch', parsed.out_trade_no, parsed.total_amount, expected);
    throw new HttpError(400, '支付金额不一致', 400);
  }

  await confirmPayment(parsed.out_trade_no, { wechat_transaction_id: parsed.trade_no || null });
  return { ack: 'success', out_trade_no: parsed.out_trade_no };
}

export async function handleWechatPayNotify(headers, rawBody) {
  const parsed = wechatPayService.parsePayNotification(headers, rawBody);
  if (!parsed.handled) return { ack: true, skipped: true, ...parsed };

  const row = await PaymentRecord.findOne({ where: { out_trade_no: String(parsed.out_trade_no) } });
  if (!row) throw new HttpError(404, '订单不存在', 404);

  const expectedFen = Math.round(Number(row.amount) * 100);
  if (parsed.amountFen != null && Number(parsed.amountFen) !== expectedFen) {
    console.error('[billing] wechat amount mismatch', parsed.out_trade_no, parsed.amountFen, expectedFen);
    throw new HttpError(400, '支付金额不一致', 400);
  }

  await confirmPayment(parsed.out_trade_no, { wechat_transaction_id: parsed.transaction_id });
  return { ack: true, out_trade_no: parsed.out_trade_no };
}

export async function getUsageSummary(tenantId) {
  const sub = await getSubscription(tenantId);
  const plan = sub.plan;
  const usage = sub.usage;

  function pct(current, limit) {
    if (limit === -1 || limit === 0) return 0;
    return Math.min(100, Math.round((Number(current) / Number(limit)) * 1000) / 10);
  }

  return {
    customers: {
      current: usage.customers_count,
      limit: plan?.customers_limit ?? -1,
      percent: pct(usage.customers_count, plan?.customers_limit ?? -1),
    },
    seats: {
      current: usage.seats_count,
      limit: plan?.seats_limit ?? -1,
      percent: pct(usage.seats_count, plan?.seats_limit ?? -1),
    },
    broadcasts: {
      current: usage.broadcasts_used,
      limit: plan?.broadcasts_monthly ?? -1,
      percent: pct(usage.broadcasts_used, plan?.broadcasts_monthly ?? -1),
    },
    ai_calls: {
      current: usage.ai_calls_used,
      limit: plan?.ai_calls_monthly ?? -1,
      percent: pct(usage.ai_calls_used, plan?.ai_calls_monthly ?? -1),
    },
  };
}

export async function listPayments(tenantId, query) {
  const { error, value } = listPaymentsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const { rows, count } = await PaymentRecord.findAndCountAll({
    where: { tenant_id: Number(tenantId) },
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false }],
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
  });
  return {
    list: rows.map((r) => {
      const p = r.get({ plain: true });
      return {
        id: p.id,
        tenant_id: p.tenant_id,
        plan_id: p.plan_id,
        plan: p.plan ? { id: p.plan.id, name: p.plan.name, code: p.plan.code } : null,
        billing_cycle: p.billing_cycle,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        pay_channel: p.pay_channel,
        pay_code_url: p.pay_code_url || null,
        out_trade_no: p.out_trade_no,
        paid_at: p.paid_at,
        remark: p.remark,
        created_at: p.created_at,
      };
    }),
    total: count,
    page: value.page,
    size: value.size,
  };
}

export async function getPlanByCode(code) {
  const row = await Plan.findOne({ where: { code: String(code), is_active: 1 } });
  if (!row) throw new HttpError(404, '套餐不存在', 404);
  return row;
}

export async function ensureUsageRowForTenant(tenantId, transaction = null) {
  await ensureUsageRow(tenantId, currentMonth(), transaction);
}

export async function usageRowRaw(tenantId, statMonth = currentMonth()) {
  const rows = await sequelize.query(
    'SELECT * FROM usage_stats WHERE tenant_id=:tenantId AND stat_month=:statMonth LIMIT 1',
    {
      replacements: { tenantId: Number(tenantId), statMonth },
      type: QueryTypes.SELECT,
    },
  );
  return rows?.[0] || null;
}

function normalizePromoCode(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function randomPromoSuffix(len = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * 租户自助兑换码开通（无需平台确认收款）。
 */
export async function redeemPromoCode(tenantId, userId, rawCode) {
  const code = normalizePromoCode(rawCode);
  if (!code) throw new HttpError(400, '请输入兑换码', 400);

  return sequelize.transaction(async (t) => {
    const promo = await BillingPromoCode.findOne({
      where: { code },
      include: [{ model: Plan, as: 'plan', required: true }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!promo) throw new HttpError(404, '兑换码无效', 404);
    if (promo.valid_until && new Date(promo.valid_until).getTime() < Date.now()) {
      throw new HttpError(400, '兑换码已过期', 400);
    }
    if (Number(promo.redemption_count) >= Number(promo.max_redemptions)) {
      throw new HttpError(400, '兑换码已达使用上限', 400);
    }

    const existed = await BillingPromoRedemption.findOne({
      where: { promo_code_id: promo.id, tenant_id: Number(tenantId) },
      transaction: t,
    });
    if (existed) throw new HttpError(400, '本企业已使用过该兑换码', 400);

    const plan = promo.plan;
    if (!plan?.code) throw new HttpError(500, '兑换码关联套餐异常', 500);

    await BillingPromoRedemption.create(
      {
        promo_code_id: promo.id,
        tenant_id: Number(tenantId),
        redeemed_by_user_id: Number(userId),
        redeemed_at: new Date(),
      },
      { transaction: t },
    );
    await promo.update({ redemption_count: Number(promo.redemption_count) + 1 }, { transaction: t });
    await createSubscription(tenantId, plan.code, promo.billing_cycle, t);
  });
  return getSubscription(tenantId);
}

/**
 * 平台方创建兑换码。
 */
export async function createPromoCode(creatorUserId, payload) {
  const planCode = String(payload.plan_code || '').trim();
  const billingCycle = payload.billing_cycle === 'monthly' ? 'monthly' : 'yearly';
  const maxRedemptions = Math.max(1, Math.min(10000, Number(payload.max_redemptions) || 1));
  const note = payload.note ? String(payload.note).slice(0, 255) : null;
  const validDays = payload.valid_days != null ? Number(payload.valid_days) : 365;
  const customCode = payload.code ? normalizePromoCode(payload.code) : null;

  const plan = await Plan.findOne({ where: { code: planCode, is_active: 1 } });
  if (!plan || plan.code === 'free') throw new HttpError(400, '请选择付费套餐', 400);

  let code = customCode || `ZF-${plan.code.toUpperCase()}-${randomPromoSuffix()}`;
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const dup = await BillingPromoCode.findOne({ where: { code } });
    if (!dup) break;
    code = `ZF-${plan.code.toUpperCase()}-${randomPromoSuffix()}`;
  }

  const validUntil =
    Number.isFinite(validDays) && validDays > 0
      ? new Date(Date.now() + validDays * 24 * 3600 * 1000)
      : null;

  const row = await BillingPromoCode.create({
    code,
    plan_id: plan.id,
    billing_cycle: billingCycle,
    max_redemptions: maxRedemptions,
    redemption_count: 0,
    valid_until: validUntil,
    note,
    created_by_user_id: creatorUserId ? Number(creatorUserId) : null,
  });

  return {
    id: row.id,
    code: row.code,
    plan: { id: plan.id, name: plan.name, code: plan.code },
    billing_cycle: row.billing_cycle,
    max_redemptions: row.max_redemptions,
    valid_until: row.valid_until,
    note: row.note,
  };
}

export async function listPromoCodes() {
  const rows = await BillingPromoCode.findAll({
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false }],
    order: [['id', 'DESC']],
    limit: 100,
  });
  return rows.map((r) => {
    const p = r.get({ plain: true });
    return {
      id: p.id,
      code: p.code,
      plan: p.plan ? { id: p.plan.id, name: p.plan.name, code: p.plan.code } : null,
      billing_cycle: p.billing_cycle,
      max_redemptions: p.max_redemptions,
      redemption_count: p.redemption_count,
      valid_until: p.valid_until,
      note: p.note,
      created_at: p.created_at,
    };
  });
}

/** 平台方：全站待确认订单 */
export async function listAllPendingPayments() {
  const { countAttachmentsForPayments } = await import('./contractAttachment.service.js');
  const rows = await PaymentRecord.findAll({
    where: { status: 'pending' },
    include: [
      { model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false },
      { model: Tenant, attributes: ['id', 'name'], required: false },
    ],
    order: [['id', 'DESC']],
    limit: 100,
  });
  const attCounts = await countAttachmentsForPayments(rows.map((r) => r.id));
  return rows.map((r) => {
    const p = r.get({ plain: true });
    return {
      id: p.id,
      tenant_id: p.tenant_id,
      tenant: p.Tenant ? { id: p.Tenant.id, name: p.Tenant.name } : null,
      plan: p.plan ? { id: p.plan.id, name: p.plan.name, code: p.plan.code } : null,
      billing_cycle: p.billing_cycle,
      amount: Number(p.amount),
      status: p.status,
      out_trade_no: p.out_trade_no,
      remark: p.remark,
      created_at: p.created_at,
      attachment_count: attCounts[p.id] || 0,
    };
  });
}

/**
 * 更新自动续费设置。
 */
export async function updateAutoRenew(tenantId, { auto_renew, plan_code, billing_cycle }) {
  const sub = await Subscription.findOne({ where: { tenant_id: tenantId } });
  if (!sub) throw new HttpError(404, '未找到订阅记录');

  const updateData = { auto_renew: !!auto_renew };

  if (!auto_renew) {
    updateData.auto_renew_plan_id = null;
    updateData.auto_renew_cycle = null;
  } else {
    if (plan_code) {
      const plan = await Plan.findOne({ where: { code: plan_code, is_active: 1 } });
      if (!plan) throw new HttpError(400, '无效的套餐编码');
      updateData.auto_renew_plan_id = plan.id;
    } else {
      updateData.auto_renew_plan_id = sub.plan_id;
    }
    updateData.auto_renew_cycle = billing_cycle || sub.billing_cycle || 'monthly';
  }

  await sub.update(updateData);

  return {
    auto_renew: !!sub.auto_renew,
    auto_renew_plan_id: sub.auto_renew_plan_id,
    auto_renew_cycle: sub.auto_renew_cycle,
  };
}

/**
 * 尝试从余额自动续费。
 * 返回 { success, reason, newPeriodEnd }
 */
export async function tryAutoRenew(tenantId) {
  const sub = await Subscription.findOne({
    where: { tenant_id: tenantId, auto_renew: true },
    include: [{ model: Plan, as: 'plan', required: false }],
  });
  if (!sub || !sub.auto_renew) return { success: false, reason: 'not_enabled' };

  const targetPlanId = sub.auto_renew_plan_id || sub.plan_id;
  const plan = await Plan.findByPk(targetPlanId);
  if (!plan) return { success: false, reason: 'plan_not_found' };

  const cycle = sub.auto_renew_cycle || sub.billing_cycle || 'monthly';
  const price = cycle === 'yearly' ? Number(plan.price_yearly) : Number(plan.price_monthly);

  if (price <= 0) return { success: false, reason: 'free_plan' };

  try {
    await balanceService.consumeBalance(
      tenantId,
      price,
      'auto_renew',
      null,
      `自动续费：${plan.name} ${cycle === 'yearly' ? '年付' : '月付'} ¥${price.toFixed(2)}`,
    );
  } catch (e) {
    return { success: false, reason: e.statusCode === 402 ? 'balance_insufficient' : 'consume_failed', error: e.message };
  }

  // 续费成功，延长订阅周期
  const now = new Date();
  let newEnd = sub.current_period_end && new Date(sub.current_period_end) > now
    ? new Date(sub.current_period_end)
    : now;

  if (cycle === 'yearly') {
    newEnd.setFullYear(newEnd.getFullYear() + 1);
  } else {
    newEnd.setMonth(newEnd.getMonth() + 1);
  }

  await sub.update({
    plan_id: targetPlanId,
    billing_cycle: cycle,
    status: 'active',
    trial_ends_at: null,
    current_period_start: new Date(),
    current_period_end: newEnd,
  });

  await PaymentRecord.create({
    tenant_id: tenantId,
    plan_id: targetPlanId,
    billing_cycle: cycle,
    amount: price,
    currency: 'CNY',
    status: 'paid',
    pay_channel: 'manual',
    out_trade_no: `AR-${tenantId}-${Date.now()}`,
    paid_at: now,
    remark: `余额自动续费：${plan.name} ${cycle === 'yearly' ? '年付' : '月付'}`,
  });

  return { success: true, newPeriodEnd: newEnd };
}
