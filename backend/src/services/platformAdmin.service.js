/**
 * @file 平台方运营后台：全站租户、订阅、订单概览。
 */
import Joi from 'joi';
import { Op, fn, col, QueryTypes } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { sequelize } from '../config/database.js';
import {
  Tenant,
  User,
  Subscription,
  Plan,
  PaymentRecord,
  Customer,
  BillingPromoCode,
} from '../models/index.js';
import * as billingService from './billing.service.js';

const listTenantsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().max(100).allow('').optional(),
  plan_code: Joi.string().trim().max(32).allow('').optional(),
  status: Joi.string().valid('', 'trialing', 'active', 'expired', 'cancelled').optional(),
}).unknown(false);

function calcDaysRemaining(endAt) {
  if (!endAt) return null;
  const ms = new Date(endAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 3600 * 1000));
}

function monthlyEquivalent(plan, billingCycle) {
  if (!plan || plan.code === 'free') return 0;
  const monthly = Number(plan.price_monthly) || 0;
  const yearly = Number(plan.price_yearly) || 0;
  if (billingCycle === 'yearly') return yearly / 12;
  return monthly;
}

export async function getOverview() {
  const [tenantTotal, pendingRows, promoActive] = await Promise.all([
    Tenant.count({ where: { status: 1 } }),
    PaymentRecord.findAll({
      where: { status: 'pending' },
      attributes: ['amount'],
    }),
    BillingPromoCode.count({
      where: {
        [Op.or]: [{ valid_until: null }, { valid_until: { [Op.gt]: new Date() } }],
        redemption_count: { [Op.lt]: col('max_redemptions') },
      },
    }),
  ]);

  const subs = await Subscription.findAll({
    include: [{ model: Plan, as: 'plan', required: true }],
  });

  let trialing = 0;
  let paidActive = 0;
  let experienceFree = 0;
  let expired = 0;
  let mrrEstimate = 0;

  for (const sub of subs) {
    const plan = sub.plan;
    if (sub.status === 'trialing') trialing += 1;
    else if (sub.status === 'expired' || sub.status === 'cancelled') expired += 1;
    else if (sub.status === 'active') {
      if (plan?.code === 'free') experienceFree += 1;
      else {
        paidActive += 1;
        mrrEstimate += monthlyEquivalent(plan, sub.billing_cycle);
      }
    }
  }

  const pendingAmount = pendingRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const recentTenants = await Tenant.findAll({
    where: { status: 1 },
    order: [['id', 'DESC']],
    limit: 5,
    attributes: ['id', 'name', 'created_at'],
  });

  return {
    tenants_total: tenantTotal,
    subscription: {
      trialing,
      paid_active: paidActive,
      experience_free: experienceFree,
      expired,
    },
    pending_payments: {
      count: pendingRows.length,
      amount: Math.round(pendingAmount * 100) / 100,
    },
    promo_codes_available: promoActive,
    mrr_estimate_cny: Math.round(mrrEstimate * 100) / 100,
    recent_tenants: recentTenants.map((t) => ({
      id: t.id,
      name: t.name,
      created_at: t.created_at,
    })),
  };
}

export async function listTenants(query) {
  const { error, value } = listTenantsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const where = { status: 1 };
  if (value.q) {
    const q = `%${value.q}%`;
    where[Op.or] = [{ name: { [Op.like]: q } }, { contact_phone: { [Op.like]: q } }];
  }

  const { rows, count } = await Tenant.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
    attributes: ['id', 'name', 'contact_name', 'contact_phone', 'created_at', 'is_demo'],
  });

  const tenantIds = rows.map((t) => t.id);
  const [subs, adminUsers, customerCounts] = await Promise.all([
    Subscription.findAll({
      where: { tenant_id: { [Op.in]: tenantIds } },
      include: [{ model: Plan, as: 'plan', required: false }],
    }),
    User.findAll({
      where: { tenant_id: { [Op.in]: tenantIds }, role: 'admin', status: 1 },
      attributes: ['id', 'tenant_id', 'username', 'real_name'],
      order: [['id', 'ASC']],
    }),
    Customer.findAll({
      where: { tenant_id: { [Op.in]: tenantIds } },
      attributes: ['tenant_id', [fn('COUNT', col('id')), 'n']],
      group: ['tenant_id'],
      raw: true,
    }),
  ]);

  const subMap = new Map(subs.map((s) => [Number(s.tenant_id), s]));
  const adminMap = new Map();
  for (const u of adminUsers) {
    const tid = Number(u.tenant_id);
    if (!adminMap.has(tid)) adminMap.set(tid, u);
  }
  const custMap = new Map(customerCounts.map((r) => [Number(r.tenant_id), Number(r.n)]));

  let list = rows.map((t) => {
    const sub = subMap.get(Number(t.id));
    const plan = sub?.plan;
    const endAt = sub?.current_period_end || sub?.trial_ends_at || null;
    return {
      id: t.id,
      name: t.name,
      contact_name: t.contact_name,
      contact_phone: t.contact_phone,
      is_demo: Boolean(t.is_demo),
      created_at: t.created_at,
      admin: adminMap.get(Number(t.id))
        ? {
            id: adminMap.get(Number(t.id)).id,
            username: adminMap.get(Number(t.id)).username,
            real_name: adminMap.get(Number(t.id)).real_name,
          }
        : null,
      subscription: sub
        ? {
            status: sub.status,
            plan_code: plan?.code ?? null,
            plan_name: plan?.name ?? null,
            billing_cycle: sub.billing_cycle,
            trial_ends_at: sub.trial_ends_at,
            current_period_end: sub.current_period_end,
            days_remaining: calcDaysRemaining(endAt),
          }
        : null,
      customers_count: custMap.get(Number(t.id)) ?? 0,
    };
  });

  if (value.plan_code) {
    list = list.filter((x) => x.subscription?.plan_code === value.plan_code);
  }
  if (value.status) {
    list = list.filter((x) => x.subscription?.status === value.status);
  }

  return {
    list,
    total: value.plan_code || value.status ? list.length : count,
    page: value.page,
    size: value.size,
  };
}

export async function getTenantDetail(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'name', 'contact_name', 'contact_phone', 'created_at', 'is_demo', 'status'],
  });
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);

  const [subData, users, payments, redemptions] = await Promise.all([
    billingService.getSubscription(tenantId),
    User.findAll({
      where: { tenant_id: tenantId, status: 1 },
      attributes: ['id', 'username', 'real_name', 'role', 'last_login_at', 'created_at'],
      order: [['id', 'ASC']],
      limit: 50,
    }),
    PaymentRecord.findAll({
      where: { tenant_id: tenantId },
      include: [{ model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false }],
      order: [['id', 'DESC']],
      limit: 20,
    }),
    sequelize.query(
      `SELECT r.id, r.redeemed_at, c.code AS promo_code, p.name AS plan_name
       FROM billing_promo_redemptions r
       JOIN billing_promo_codes c ON c.id = r.promo_code_id
       JOIN plans p ON p.id = c.plan_id
       WHERE r.tenant_id = :tenantId
       ORDER BY r.id DESC LIMIT 10`,
      { replacements: { tenantId: Number(tenantId) }, type: QueryTypes.SELECT },
    ),
  ]);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      contact_name: tenant.contact_name,
      contact_phone: tenant.contact_phone,
      is_demo: Boolean(tenant.is_demo),
      created_at: tenant.created_at,
    },
    subscription: subData,
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      real_name: u.real_name,
      role: u.role,
      last_login_at: u.last_login_at,
      created_at: u.created_at,
    })),
    payments: payments.map((p) => {
      const row = p.get({ plain: true });
      return {
        id: row.id,
        amount: Number(row.amount),
        status: row.status,
        billing_cycle: row.billing_cycle,
        out_trade_no: row.out_trade_no,
        plan: row.plan ? { name: row.plan.name, code: row.plan.code } : null,
        created_at: row.created_at,
        paid_at: row.paid_at,
        remark: row.remark,
      };
    }),
    promo_redemptions: redemptions,
  };
}

export async function grantTenantSubscription(tenantId, planCode, billingCycle) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);
  return billingService.createSubscription(tenantId, planCode, billingCycle);
}

export async function extendTenantProTrial(tenantId, days = 14) {
  const d = Math.max(1, Math.min(90, Number(days) || 14));
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);

  const pro = await Plan.findOne({ where: { code: 'pro', is_active: 1 } });
  if (!pro) throw new HttpError(500, '未配置专业版', 500);

  const sub = await Subscription.findOne({ where: { tenant_id: tenantId } });
  const trialEnd = new Date(Date.now() + d * 24 * 3600 * 1000);

  if (sub) {
    await sub.update({
      plan_id: pro.id,
      status: 'trialing',
      trial_ends_at: trialEnd,
      current_period_start: null,
      current_period_end: null,
    });
  } else {
    await Subscription.create({
      tenant_id: tenantId,
      plan_id: pro.id,
      billing_cycle: 'monthly',
      status: 'trialing',
      trial_ends_at: trialEnd,
    });
  }
  return billingService.getSubscription(tenantId);
}

export async function listAllPayments(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 30));
  const status = String(query.status || '').trim();

  const where = {};
  if (status && ['pending', 'paid', 'failed', 'refunded'].includes(status)) {
    where.status = status;
  }

  const { rows, count } = await PaymentRecord.findAndCountAll({
    where,
    include: [
      { model: Plan, as: 'plan', attributes: ['id', 'name', 'code'], required: false },
      { model: Tenant, attributes: ['id', 'name'], required: false },
    ],
    order: [['id', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  return {
    list: rows.map((r) => {
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
        paid_at: p.paid_at,
        created_at: p.created_at,
      };
    }),
    total: count,
    page,
    size,
  };
}
