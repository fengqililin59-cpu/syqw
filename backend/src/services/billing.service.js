/**
 * @file 计费服务：订阅、配额、用量与支付记录。
 */
import Joi from 'joi';
import { QueryTypes } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { sequelize } from '../config/database.js';
import { Customer, PaymentRecord, Plan, Subscription, UsageStat, User, BillingPromoCode, BillingPromoRedemption, Tenant } from '../models/index.js';

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
    out_trade_no: outTradeNo,
    remark: remark ? String(remark).slice(0, 255) : null,
  });
  return row.get({ plain: true });
}

export async function confirmPayment(outTradeNo) {
  const row = await PaymentRecord.findOne({ where: { out_trade_no: String(outTradeNo) } });
  if (!row) throw new HttpError(404, '支付记录不存在', 404);
  await row.update({ status: 'paid', paid_at: new Date() });
  const plan = await Plan.findByPk(row.plan_id);
  if (!plan) throw new HttpError(500, '支付记录套餐不存在', 500);
  await createSubscription(row.tenant_id, plan.code, row.billing_cycle);
  return row.get({ plain: true });
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
  const rows = await PaymentRecord.findAll({
    where: { status: 'pending' },
    include: [
      { model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false },
      { model: Tenant, attributes: ['id', 'name'], required: false },
    ],
    order: [['id', 'DESC']],
    limit: 100,
  });
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
    };
  });
}
