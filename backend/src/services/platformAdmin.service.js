/**
 * @file 平台方运营后台：全站租户、订阅、订单概览。
 */
import Joi from 'joi';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const SH_TZ = 'Asia/Shanghai';
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
  TenantPlatformOpsNote,
  AuditLog,
} from '../models/index.js';
import * as billingService from './billing.service.js';
import { evaluateChurnRisks, churnRisksForDisplay } from './churnRisk.service.js';
import { createTenantOpsNote, listTenantOpsNotes } from './tenantPlatformOps.service.js';
import * as contractAttachmentService from './contractAttachment.service.js';
import { countPendingInvoiceRequests } from './invoiceRequest.service.js';
import { computeCurrentMrrEstimate, computeMrrByPlan } from './platformMrrMetrics.service.js';
import { getMrrMonthOverMonth, loadMrrSnapshotsByMonths } from './platformMrrSnapshot.service.js';
import { summarizeInboxAiAnomalies, getTenantInboxAiMetrics, listInboxAiAnomalyTenants, getAnomalyLevelsForTenants } from './platformInboxAiAnomaly.service.js';

const listTenantsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  q: Joi.string().trim().max(100).allow('').optional(),
  plan_code: Joi.string().trim().max(32).allow('').optional(),
  status: Joi.string().valid('', 'trialing', 'active', 'expired', 'cancelled').optional(),
  inbox_ai_anomaly: Joi.string().valid('', '1', 'true').optional(),
}).unknown(false);

function calcDaysRemaining(endAt) {
  if (!endAt) return null;
  const ms = new Date(endAt).getTime() - Date.now();
  return Math.ceil(ms / (24 * 3600 * 1000));
}

function subscriptionEffectiveEndAt(sub) {
  if (!sub) return null;
  if (sub.status === 'trialing') return sub.trial_ends_at || null;
  if (sub.status === 'active') return sub.current_period_end || null;
  return null;
}

function isPaidPlan(plan) {
  return Boolean(plan?.code && plan.code !== 'free');
}

/**
 * 试用/付费订阅在 N 天内到期（不含免费体验档）。
 */
export async function listExpiringSubscriptions(query = {}) {
  const days = Math.min(90, Math.max(1, Number(query.days) || 14));
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const includePastDue = query.include_past_due === '1' || query.include_past_due === 'true';

  const subs = await Subscription.findAll({
    where: { status: { [Op.in]: ['trialing', 'active'] } },
    include: [
      { model: Plan, as: 'plan', required: true },
      {
        model: Tenant,
        required: true,
        where: { status: 1 },
        attributes: ['id', 'name', 'contact_name', 'contact_phone'],
      },
    ],
  });

  const results = [];
  for (const sub of subs) {
    const plan = sub.plan;
    if (!isPaidPlan(plan)) continue;
    const endAt = subscriptionEffectiveEndAt(sub);
    if (!endAt) continue;
    const daysRemaining = calcDaysRemaining(endAt);
    if (daysRemaining == null) continue;
    if (daysRemaining > days) continue;
    if (daysRemaining < 0) {
      if (!includePastDue || daysRemaining < -7) continue;
    }

    const tenant = sub.Tenant;
    results.push({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      contact_name: tenant.contact_name,
      contact_phone: tenant.contact_phone,
      plan_code: plan.code,
      plan_name: plan.name,
      subscription_status: sub.status,
      billing_cycle: sub.billing_cycle,
      ends_at: endAt,
      days_remaining: daysRemaining,
      urgency: daysRemaining <= 3 ? 'critical' : daysRemaining <= 7 ? 'warn' : 'normal',
    });
  }

  results.sort((a, b) => a.days_remaining - b.days_remaining);

  return {
    list: results.slice(0, limit),
    total: results.length,
    days,
    include_past_due: includePastDue,
  };
}

export async function countExpiringSubscriptions(days = 14) {
  const { total } = await listExpiringSubscriptions({ days, limit: 200 });
  return total;
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cells) {
  return cells.map(csvCell).join(',');
}

const URGENCY_LABELS = { critical: '紧急(≤3天)', warn: '关注(≤7天)', normal: '一般' };

export async function exportExpiringSubscriptionsCsv(query = {}) {
  const data = await listExpiringSubscriptions({
    days: query.days,
    limit: 200,
    include_past_due: query.include_past_due,
  });
  const header = [
    '租户ID',
    '租户名称',
    '套餐',
    '订阅状态',
    '计费周期',
    '到期日',
    '剩余天数',
    '紧急程度',
    '联系人',
    '联系电话',
  ];
  const statusLabel = (s) => (s === 'trialing' ? '试用中' : s === 'active' ? '生效中' : s);
  const lines = data.list.map((r) =>
    rowToCsv([
      r.tenant_id,
      r.tenant_name,
      r.plan_name,
      statusLabel(r.subscription_status),
      r.billing_cycle === 'yearly' ? '年付' : '月付',
      dayjs(r.ends_at).format('YYYY-MM-DD'),
      r.days_remaining,
      URGENCY_LABELS[r.urgency] || r.urgency,
      r.contact_name || '',
      r.contact_phone || '',
    ]),
  );
  const csv = [rowToCsv(header), ...lines].join('\n');
  const filename = `ZhiFlow-即将到期订阅-${dayjs().format('YYYYMMDD')}.csv`;
  return { csv, filename, total: data.total, days: data.days };
}

function expiringStatusLabel(status) {
  if (status === 'trialing') return '试用中';
  if (status === 'active') return '生效中';
  return status;
}

function buildExpiringFollowupContent(row) {
  const daysLabel =
    row.days_remaining < 0
      ? `已过期 ${Math.abs(row.days_remaining)} 天`
      : `剩余 ${row.days_remaining} 天`;
  const endDate = dayjs(row.ends_at).tz(SH_TZ).format('YYYY-MM-DD');
  return `【续费跟进】${row.plan_name}（${expiringStatusLabel(row.subscription_status)}，${daysLabel}），到期日 ${endDate}。请主动联系续费/转化。`;
}

function resolveExpiringFollowupDate(daysRemaining) {
  const base = dayjs().tz(SH_TZ);
  if (daysRemaining <= 3) return base.startOf('day').toDate();
  if (daysRemaining <= 7) return base.add(1, 'day').startOf('day').toDate();
  return base.add(2, 'day').startOf('day').toDate();
}

/**
 * 为即将到期租户批量创建平台回访备注（写入待回访队列）。
 */
export async function scheduleExpiringRenewalFollowups(authorUserId, options = {}) {
  const days = Math.min(90, Math.max(1, Number(options.days) || 14));
  const urgencyOnly = options.urgency_only !== false && options.urgency_only !== '0';
  const skipOpen = options.skip_if_open_followup !== false && options.skip_if_open_followup !== '0';
  const includePastDue = options.include_past_due === true || options.include_past_due === '1';

  const { list } = await listExpiringSubscriptions({
    days,
    limit: 200,
    include_past_due: includePastDue,
  });

  let targets = list;
  if (urgencyOnly) {
    targets = targets.filter((t) => t.urgency === 'critical' || t.urgency === 'warn');
  }

  const openFollowTenantIds = skipOpen
    ? await tenantIdsWithOpenFollowup(targets.map((t) => t.tenant_id))
    : new Set();

  const created = [];
  const skipped = [];

  for (const row of targets) {
    if (skipOpen && openFollowTenantIds.has(row.tenant_id)) {
      skipped.push({ tenant_id: row.tenant_id, tenant_name: row.tenant_name, reason: 'has_open_followup' });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const note = await createTenantOpsNote(row.tenant_id, authorUserId, {
      note_type: 'call',
      content: buildExpiringFollowupContent(row),
      next_follow_at: resolveExpiringFollowupDate(row.days_remaining),
    });
    created.push({
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      note_id: note.id,
      next_follow_at: note.next_follow_at,
    });
  }

  return {
    created: created.length,
    skipped: skipped.length,
    days,
    urgency_only: urgencyOnly,
    created_items: created,
    skipped_items: skipped,
  };
}

/**
 * 近 N 月收款与注册趋势（平台概览图表）。
 */
export async function getMrrTrend(query = {}) {
  const monthsCount = Math.min(24, Math.max(6, Number(query.months) || 12));
  const start = dayjs().subtract(monthsCount - 1, 'month').startOf('month');
  const since = start.toDate();

  const [paidRows, tenantRows, planRows, currentMrr] = await Promise.all([
    sequelize.query(
      `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month_key,
              COALESCE(SUM(amount), 0) AS paid_amount,
              COUNT(*) AS paid_count
       FROM payment_records
       WHERE status = 'paid' AND paid_at IS NOT NULL AND paid_at >= :since
       GROUP BY month_key
       ORDER BY month_key ASC`,
      { type: QueryTypes.SELECT, replacements: { since } },
    ),
    sequelize.query(
      `SELECT DATE_FORMAT(pr.paid_at, '%Y-%m') AS month_key,
              COALESCE(pl.code, 'unknown') AS plan_code,
              COALESCE(pl.name, '未知套餐') AS plan_name,
              COALESCE(SUM(pr.amount), 0) AS paid_amount
       FROM payment_records pr
       LEFT JOIN plans pl ON pl.id = pr.plan_id
       WHERE pr.status = 'paid' AND pr.paid_at IS NOT NULL AND pr.paid_at >= :since
       GROUP BY month_key, plan_code, plan_name
       ORDER BY month_key ASC`,
      { type: QueryTypes.SELECT, replacements: { since } },
    ),
    sequelize.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month_key,
              COUNT(*) AS new_tenants
       FROM tenants
       WHERE status = 1 AND created_at >= :since
       GROUP BY month_key
       ORDER BY month_key ASC`,
      { type: QueryTypes.SELECT, replacements: { since } },
    ),
    computeCurrentMrrEstimate(),
  ]);

  const paidMap = Object.fromEntries(
    paidRows.map((r) => [r.month_key, { paid_amount: Number(r.paid_amount), paid_count: Number(r.paid_count) }]),
  );
  const tenantMap = Object.fromEntries(tenantRows.map((r) => [r.month_key, Number(r.new_tenants)]));

  const planMetaMap = new Map();
  for (const row of planRows) {
    if (!planMetaMap.has(row.plan_code)) {
      planMetaMap.set(row.plan_code, { code: row.plan_code, name: row.plan_name });
    }
  }
  const planSeries = [...planMetaMap.values()].sort((a, b) => a.code.localeCompare(b.code));

  const months = [];
  let totalPaid = 0;
  let totalPaidCount = 0;
  for (let i = 0; i < monthsCount; i += 1) {
    const m = start.add(i, 'month');
    const key = m.format('YYYY-MM');
    const paid_amount = Math.round(Number(paidMap[key]?.paid_amount || 0) * 100) / 100;
    const paid_count = Number(paidMap[key]?.paid_count || 0);
    totalPaid += paid_amount;
    totalPaidCount += paid_count;

    const row = {
      month_key: key,
      label: m.format('YY-MM'),
      paid_amount,
      paid_count,
      new_tenants: tenantMap[key] || 0,
    };
    for (const pl of planSeries) {
      const match = planRows.find((r) => r.month_key === key && r.plan_code === pl.code);
      row[pl.code] = Math.round(Number(match?.paid_amount || 0) * 100) / 100;
    }
    months.push(row);
  }

  const mrrByPlan = await computeMrrByPlan();
  const monthKeys = months.map((m) => m.month_key);
  const snapshots = await loadMrrSnapshotsByMonths(monthKeys);
  const snapshotMap = Object.fromEntries(snapshots.map((s) => [s.snapshot_month, s]));

  for (const row of months) {
    const snap = snapshotMap[row.month_key];
    row.mrr_snapshot = snap ? snap.mrr_total : null;
    row.active_subscriptions = snap ? snap.active_subscriptions : null;
  }

  const latestSnapshot = snapshots.length ? snapshots[snapshots.length - 1] : null;

  return {
    current_mrr: currentMrr,
    months,
    plan_series: planSeries,
    mrr_by_plan: mrrByPlan,
    range_paid_total: Math.round(totalPaid * 100) / 100,
    range_paid_count: totalPaidCount,
    has_mrr_snapshots: snapshots.length > 0,
    latest_mrr_snapshot: latestSnapshot
      ? {
          snapshot_month: latestSnapshot.snapshot_month,
          mrr_total: latestSnapshot.mrr_total,
          captured_at: latestSnapshot.captured_at,
        }
      : null,
  };
}

export async function getOverview() {
  const [tenantTotal, pendingRows, promoActive, pendingInvoices] = await Promise.all([
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
    countPendingInvoiceRequests().catch(() => 0),
  ]);

  const subs = await Subscription.findAll({
    include: [{ model: Plan, as: 'plan', required: true }],
  });

  let trialing = 0;
  let paidActive = 0;
  let experienceFree = 0;
  let expired = 0;

  for (const sub of subs) {
    const plan = sub.plan;
    if (sub.status === 'trialing') trialing += 1;
    else if (sub.status === 'expired' || sub.status === 'cancelled') expired += 1;
    else if (sub.status === 'active') {
      if (plan?.code === 'free') experienceFree += 1;
      else paidActive += 1;
    }
  }

  const [mrrEstimate, mrrMom] = await Promise.all([
    computeCurrentMrrEstimate(),
    getMrrMonthOverMonth(),
  ]);

  const pendingAmount = pendingRows.reduce((s, r) => s + Number(r.amount || 0), 0);

  const recentTenants = await Tenant.findAll({
    where: { status: 1 },
    order: [['id', 'DESC']],
    limit: 5,
    attributes: ['id', 'name', 'created_at'],
  });

  const expiring_within_14_days = await countExpiringSubscriptions(14);

  const inbox_ai_anomalies = await summarizeInboxAiAnomalies(7).catch(() => ({
    total: 0,
    critical: 0,
    warn: 0,
    days: 7,
  }));

  return {
    tenants_total: tenantTotal,
    subscription: {
      trialing,
      paid_active: paidActive,
      experience_free: experienceFree,
      expired,
      expiring_within_14_days,
    },
    pending_payments: {
      count: pendingRows.length,
      amount: Math.round(pendingAmount * 100) / 100,
    },
    pending_invoice_requests: pendingInvoices,
    promo_codes_available: promoActive,
    mrr_estimate_cny: Math.round(mrrEstimate * 100) / 100,
    mrr_mom: mrrMom,
    recent_tenants: recentTenants.map((t) => ({
      id: t.id,
      name: t.name,
      created_at: t.created_at,
    })),
    inbox_ai_anomalies,
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

  if (value.inbox_ai_anomaly === '1' || value.inbox_ai_anomaly === 'true') {
    const { list: anomalies } = await listInboxAiAnomalyTenants({ limit: 500, days: 7 });
    const anomalyIds = anomalies.map((a) => a.tenant_id);
    if (!anomalyIds.length) {
      return { list: [], total: 0, page: value.page, size: value.size };
    }
    where.id = { [Op.in]: anomalyIds };
  }

  const { rows, count } = await Tenant.findAndCountAll({
    where,
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
    attributes: [
      'id',
      'name',
      'contact_name',
      'contact_phone',
      'created_at',
      'is_demo',
      'inbox_ai_platform_disabled',
      'inbox_ai_auto_send',
      'inbox_ai_auto_send_pricing',
    ],
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
  const anomalyLevelMap = await getAnomalyLevelsForTenants(tenantIds, 7).catch(() => new Map());

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
      inbox_ai: {
        platform_disabled: Boolean(t.inbox_ai_platform_disabled),
        auto_send_faq: Boolean(t.inbox_ai_auto_send),
        auto_send_pricing: Boolean(t.inbox_ai_auto_send_pricing),
        anomaly_level: anomalyLevelMap.get(Number(t.id)) ?? null,
      },
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
    attributes: [
      'id',
      'name',
      'contact_name',
      'contact_phone',
      'created_at',
      'is_demo',
      'status',
      'inbox_ai_auto_send',
      'inbox_ai_auto_send_pricing',
      'inbox_ai_platform_disabled',
    ],
  });
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);

  const [subData, users, payments, redemptions, churnRisks, opsNotes, inboxAiMetrics] = await Promise.all([
    billingService.getSubscription(tenantId),
    User.findAll({
      where: { tenant_id: tenantId, status: 1 },
      attributes: ['id', 'username', 'real_name', 'email', 'role', 'last_login_at', 'created_at'],
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
    evaluateChurnRisks(tenantId).catch(() => []).then(churnRisksForDisplay),
    listTenantOpsNotes(tenantId).catch(() => []),
    getTenantInboxAiMetrics(tenantId, 7).catch(() => null),
  ]);

  const churnLevel = churnRisks.some((r) => r.level === 'critical')
    ? 'critical'
    : churnRisks.length
      ? 'warn'
      : 'ok';

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      contact_name: tenant.contact_name,
      contact_phone: tenant.contact_phone,
      is_demo: Boolean(tenant.is_demo),
      created_at: tenant.created_at,
    },
    subscription: {
      ...subData,
      usage: {
        ...subData.usage,
        ai_calls_used: subData.usage?.ai_calls_used ?? 0,
      },
    },
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      real_name: u.real_name,
      email: u.email || null,
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
    churn_risk: {
      level: churnLevel,
      risks: churnRisks,
    },
    ops_notes: opsNotes,
    inbox_ai: {
      platform_disabled: Boolean(tenant.inbox_ai_platform_disabled),
      tenant_auto_send_faq: Boolean(tenant.inbox_ai_auto_send),
      tenant_auto_send_pricing: Boolean(tenant.inbox_ai_auto_send_pricing),
      metrics_7d: inboxAiMetrics,
    },
  };
}

/**
 * 平台方一键关停/恢复租户 AI 自动发送
 * @param {number} tenantId
 * @param {{ inbox_ai_platform_disabled: boolean }} body
 */
export async function setTenantInboxAiPlatformControl(tenantId, body) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);

  const disabled = Boolean(body.inbox_ai_platform_disabled);
  const update = { inbox_ai_platform_disabled: disabled };
  if (disabled) {
    update.inbox_ai_auto_send = false;
    update.inbox_ai_auto_send_pricing = false;
  }
  await tenant.update(update);
  await tenant.reload();

  return {
    tenant_id: tenant.id,
    inbox_ai_platform_disabled: Boolean(tenant.inbox_ai_platform_disabled),
    inbox_ai_auto_send: Boolean(tenant.inbox_ai_auto_send),
    inbox_ai_auto_send_pricing: Boolean(tenant.inbox_ai_auto_send_pricing),
  };
}

const INBOX_AI_AUDIT_ACTIONS = [
  'inbox_ai_auto_sent',
  'inbox_ai_auto_send_skipped',
  'inbox_ai_qa_passed',
  'inbox_ai_qa_failed',
  'platform_inbox_ai_disabled',
  'platform_inbox_ai_enabled',
];

/**
 * 平台方查看指定租户的收件箱 AI 相关审计（近 N 日）。
 * @param {number} tenantId
 * @param {object} [query]
 */
export async function listTenantInboxAiAuditLogs(tenantId, query = {}) {
  const id = Number(tenantId);
  const tenant = await Tenant.findByPk(id, { attributes: ['id', 'status'] });
  if (!tenant || tenant.status !== 1) throw new HttpError(404, '租户不存在', 404);

  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(50, Math.max(1, Number(query.size) || 20));
  const days = Math.min(30, Math.max(1, Number(query.days) || 14));
  const since = new Date(Date.now() - days * 86400000);

  const where = {
    tenant_id: id,
    action: { [Op.in]: INBOX_AI_AUDIT_ACTIONS },
    created_at: { [Op.gte]: since },
  };
  const action = String(query.action || '').trim();
  if (action && INBOX_AI_AUDIT_ACTIONS.includes(action)) {
    where.action = action;
  }

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'username', 'real_name'], required: false }],
    order: [['id', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  return {
    list: rows.map((r) => r.get({ plain: true })),
    total: count,
    page,
    size,
    days,
    actions: INBOX_AI_AUDIT_ACTIONS,
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

  const paymentIds = rows.map((r) => r.id);
  const attCounts = await contractAttachmentService.countAttachmentsForPayments(paymentIds);

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
        attachment_count: attCounts[p.id] || 0,
      };
    }),
    total: count,
    page,
    size,
  };
}

const CHURN_SCAN_CAP = 150;

/**
 * 全站流失风险租户（平台运营挽回）。
 */
export async function listChurnRiskTenants(query = {}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const levelFilter = query.level === 'critical' || query.level === 'warn' ? query.level : '';

  const tenants = await Tenant.findAll({
    where: { status: 1 },
    attributes: ['id', 'name', 'created_at'],
    order: [['id', 'DESC']],
    limit: CHURN_SCAN_CAP,
  });

  const results = [];
  for (const t of tenants) {
    // eslint-disable-next-line no-await-in-loop
    const risks = churnRisksForDisplay(await evaluateChurnRisks(t.id));
    if (!risks.length) continue;
    const level = risks.some((r) => r.level === 'critical') ? 'critical' : 'warn';
    if (levelFilter && level !== levelFilter) continue;

    // eslint-disable-next-line no-await-in-loop
    const sub = await Subscription.findOne({
      where: { tenant_id: t.id },
      include: [{ model: Plan, as: 'plan', attributes: ['code', 'name'], required: false }],
    });
    const plain = sub?.get ? sub.get({ plain: true }) : null;

    results.push({
      tenant_id: t.id,
      tenant_name: t.name,
      created_at: t.created_at,
      plan_code: plain?.plan?.code ?? null,
      plan_name: plain?.plan?.name ?? null,
      subscription_status: plain?.status ?? null,
      level,
      risk_count: risks.length,
      risks: risks.map((r) => ({
        code: r.code,
        level: r.level,
        title: r.title,
        detail: r.detail,
      })),
    });
  }

  results.sort((a, b) => {
    if (a.level === b.level) return b.risk_count - a.risk_count;
    return a.level === 'critical' ? -1 : 1;
  });

  return {
    list: results.slice(0, limit),
    total: results.length,
    scanned: tenants.length,
    cap: CHURN_SCAN_CAP,
  };
}

async function tenantIdsWithOpenFollowup(tenantIds) {
  if (!tenantIds.length) return new Set();
  const todayStart = dayjs().tz(SH_TZ).startOf('day').toDate();
  const openRows = await TenantPlatformOpsNote.findAll({
    where: {
      tenant_id: { [Op.in]: tenantIds },
      next_follow_at: { [Op.gte]: todayStart },
    },
    attributes: ['tenant_id'],
    group: ['tenant_id'],
    raw: true,
  });
  return new Set(openRows.map((r) => Number(r.tenant_id)));
}

function buildChurnFollowupContent(row) {
  const levelLabel = row.level === 'critical' ? '严重' : '关注';
  const titles = row.risks.map((r) => r.title).join('、');
  return `【流失挽回·${levelLabel}】${titles}。请主动联系了解使用情况并推动续费/激活。`;
}

function resolveChurnFollowupDate(level) {
  const base = dayjs().tz(SH_TZ);
  if (level === 'critical') return base.startOf('day').toDate();
  return base.add(1, 'day').startOf('day').toDate();
}

/**
 * 为流失风险租户批量创建平台回访备注。
 */
export async function scheduleChurnRenewalFollowups(authorUserId, options = {}) {
  const criticalOnly = options.critical_only !== false && options.critical_only !== '0';
  const skipOpen = options.skip_if_open_followup !== false && options.skip_if_open_followup !== '0';
  const levelFilter =
    options.level === 'critical' || options.level === 'warn'
      ? options.level
      : criticalOnly
        ? 'critical'
        : '';

  const { list } = await listChurnRiskTenants({
    limit: 100,
    level: levelFilter || undefined,
  });

  const openFollowTenantIds = skipOpen
    ? await tenantIdsWithOpenFollowup(list.map((t) => t.tenant_id))
    : new Set();

  const created = [];
  const skipped = [];

  for (const row of list) {
    if (skipOpen && openFollowTenantIds.has(row.tenant_id)) {
      skipped.push({ tenant_id: row.tenant_id, tenant_name: row.tenant_name, reason: 'has_open_followup' });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const note = await createTenantOpsNote(row.tenant_id, authorUserId, {
      note_type: 'call',
      content: buildChurnFollowupContent(row),
      next_follow_at: resolveChurnFollowupDate(row.level),
    });
    created.push({
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      note_id: note.id,
      next_follow_at: note.next_follow_at,
      level: row.level,
    });
  }

  return {
    created: created.length,
    skipped: skipped.length,
    critical_only: criticalOnly,
    level_filter: levelFilter || null,
    created_items: created,
    skipped_items: skipped,
  };
}
