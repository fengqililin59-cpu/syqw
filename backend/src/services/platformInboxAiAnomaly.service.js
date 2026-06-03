/**
 * @file 平台运营：全站收件箱 AI 自动发送异常租户汇总。
 */
import { Op, fn, col, literal } from 'sequelize';
import { AiReplyLog, AuditLog, Tenant, Subscription, Plan } from '../models/index.js';

function sinceDays(days) {
  const d = Math.min(30, Math.max(1, Number(days) || 7));
  return { since: new Date(Date.now() - d * 86400000), days: d };
}

/**
 * 纯函数：根据近 N 日指标判定是否异常及等级（供单测）。
 * @param {{ qa_failed: number; qa_pending: number; skip_count: number; days: number; auto_send_on: boolean }} row
 */
export function classifyInboxAiAnomaly(row) {
  const { qa_failed, qa_pending, skip_count, auto_send_on } = row;
  const reasons = [];
  if (qa_failed > 0) reasons.push({ code: 'qa_failed', title: '抽检发现问题', detail: `近 ${row.days} 日 ${qa_failed} 条` });
  if (qa_pending >= 3) {
    reasons.push({ code: 'qa_pending', title: '抽检积压', detail: `待处理 ${qa_pending} 条` });
  } else if (qa_pending > 0) {
    reasons.push({ code: 'qa_pending', title: '待抽检', detail: `${qa_pending} 条` });
  }
  if (skip_count >= 15) {
    reasons.push({
      code: 'skip_high',
      title: '护栏频繁拦截',
      detail: `跳过 ${skip_count} 次（日上限/公域/风控等）`,
    });
  }

  if (!reasons.length) return null;

  let level = 'warn';
  if (
    qa_failed >= 2
    || (qa_failed >= 1 && auto_send_on)
    || skip_count >= 40
    || qa_pending >= 8
  ) {
    level = 'critical';
  }

  return { level, reasons };
}

/**
 * 单租户近 N 日 AI 自动发指标（平台租户详情用）。
 * @param {number} tenantId
 * @param {number} [days]
 */
export async function getTenantInboxAiMetrics(tenantId, days = 7) {
  const id = Number(tenantId);
  const { since, days: d } = sinceDays(days);

  const tenant = await Tenant.findByPk(id, {
    attributes: [
      'id',
      'inbox_ai_auto_send',
      'inbox_ai_auto_send_pricing',
      'inbox_ai_platform_disabled',
    ],
  });
  if (!tenant) return null;

  const autoSendWhere = {
    tenant_id: id,
    status: 'approved',
    approved_by: null,
    created_at: { [Op.gte]: since },
  };

  const [qaAgg, skipCount] = await Promise.all([
    AiReplyLog.findOne({
      attributes: [
        [fn('SUM', literal("CASE WHEN qa_status = 'failed' THEN 1 ELSE 0 END")), 'qa_failed'],
        [fn('SUM', literal("CASE WHEN qa_status = 'pending' THEN 1 ELSE 0 END")), 'qa_pending'],
        [fn('COUNT', col('id')), 'auto_sent'],
      ],
      where: autoSendWhere,
      raw: true,
    }),
    AuditLog.count({
      where: {
        tenant_id: id,
        action: 'inbox_ai_auto_send_skipped',
        created_at: { [Op.gte]: since },
      },
    }),
  ]);

  const qa_failed = Number(qaAgg?.qa_failed) || 0;
  const qa_pending = Number(qaAgg?.qa_pending) || 0;
  const auto_sent = Number(qaAgg?.auto_sent) || 0;
  const skip_count = Number(skipCount) || 0;
  const auto_send_on = Boolean(tenant.inbox_ai_auto_send || tenant.inbox_ai_auto_send_pricing);
  const classified = tenant.inbox_ai_platform_disabled
    ? null
    : classifyInboxAiAnomaly({ qa_failed, qa_pending, skip_count, days: d, auto_send_on });

  return {
    days: d,
    auto_sent,
    qa_failed,
    qa_pending,
    skip_count,
    auto_send_faq: Boolean(tenant.inbox_ai_auto_send),
    auto_send_pricing: Boolean(tenant.inbox_ai_auto_send_pricing),
    platform_disabled: Boolean(tenant.inbox_ai_platform_disabled),
    anomaly_level: classified?.level ?? null,
    anomaly_reasons: classified?.reasons ?? [],
  };
}

/**
 * @param {object} [query]
 */
export async function listInboxAiAnomalyTenants(query = {}) {
  const { since, days } = sinceDays(query.days);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const levelFilter = query.level === 'critical' || query.level === 'warn' ? query.level : '';

  const [qaRows, skipRows] = await Promise.all([
    AiReplyLog.findAll({
      attributes: [
        'tenant_id',
        [fn('SUM', literal("CASE WHEN qa_status = 'failed' THEN 1 ELSE 0 END")), 'qa_failed'],
        [fn('SUM', literal("CASE WHEN qa_status = 'pending' THEN 1 ELSE 0 END")), 'qa_pending'],
        [fn('COUNT', col('id')), 'auto_sent'],
      ],
      where: {
        status: 'approved',
        approved_by: null,
        created_at: { [Op.gte]: since },
      },
      group: ['tenant_id'],
      raw: true,
    }),
    AuditLog.findAll({
      attributes: ['tenant_id', [fn('COUNT', col('id')), 'skip_count']],
      where: {
        action: 'inbox_ai_auto_send_skipped',
        created_at: { [Op.gte]: since },
      },
      group: ['tenant_id'],
      raw: true,
    }),
  ]);

  const byTenant = new Map();
  for (const r of qaRows) {
    const id = Number(r.tenant_id);
    byTenant.set(id, {
      tenant_id: id,
      qa_failed: Number(r.qa_failed) || 0,
      qa_pending: Number(r.qa_pending) || 0,
      auto_sent: Number(r.auto_sent) || 0,
      skip_count: 0,
    });
  }
  for (const r of skipRows) {
    const id = Number(r.tenant_id);
    const cur = byTenant.get(id) || {
      tenant_id: id,
      qa_failed: 0,
      qa_pending: 0,
      auto_sent: 0,
      skip_count: 0,
    };
    cur.skip_count = Number(r.skip_count) || 0;
    byTenant.set(id, cur);
  }

  const tenantIds = [...byTenant.keys()];
  if (!tenantIds.length) {
    return { list: [], total: 0, days, scanned: 0 };
  }

  const tenants = await Tenant.findAll({
    where: { id: { [Op.in]: tenantIds }, status: 1 },
    attributes: ['id', 'name', 'inbox_ai_auto_send', 'inbox_ai_auto_send_pricing', 'inbox_ai_platform_disabled'],
  });
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));

  const subs = await Subscription.findAll({
    where: { tenant_id: { [Op.in]: tenantIds } },
    include: [{ model: Plan, as: 'plan', attributes: ['code', 'name'], required: false }],
  });
  const subMap = new Map(subs.map((s) => [s.tenant_id, s]));

  const results = [];
  for (const [tenantId, stats] of byTenant) {
    const tenant = tenantMap.get(tenantId);
    if (!tenant) continue;
    if (tenant.inbox_ai_platform_disabled) continue;

    const auto_send_on = Boolean(tenant.inbox_ai_auto_send || tenant.inbox_ai_auto_send_pricing);
    const built = classifyInboxAiAnomaly({ ...stats, days, auto_send_on });
    if (!built) continue;
    if (levelFilter && built.level !== levelFilter) continue;

    const sub = subMap.get(tenantId);
    const plain = sub?.get ? sub.get({ plain: true }) : null;

    results.push({
      tenant_id: tenantId,
      tenant_name: tenant.name,
      plan_code: plain?.plan?.code ?? null,
      plan_name: plain?.plan?.name ?? null,
      subscription_status: plain?.status ?? null,
      auto_send_faq: Boolean(tenant.inbox_ai_auto_send),
      auto_send_pricing: Boolean(tenant.inbox_ai_auto_send_pricing),
      qa_failed: stats.qa_failed,
      qa_pending: stats.qa_pending,
      auto_sent: stats.auto_sent,
      skip_count: stats.skip_count,
      level: built.level,
      reasons: built.reasons,
    });
  }

  results.sort((a, b) => {
    if (a.level === b.level) {
      return b.qa_failed - a.qa_failed || b.skip_count - a.skip_count;
    }
    return a.level === 'critical' ? -1 : 1;
  });

  return {
    list: results.slice(0, limit),
    total: results.length,
    days,
    scanned: tenantIds.length,
  };
}

/**
 * @param {number} [days]
 */
export async function summarizeInboxAiAnomalies(days = 7) {
  const { list, total } = await listInboxAiAnomalyTenants({ days, limit: 500 });
  let critical = 0;
  let warn = 0;
  for (const row of list) {
    if (row.level === 'critical') critical += 1;
    else warn += 1;
  }
  return { total, critical, warn, days: sinceDays(days).days };
}

/**
 * 批量查询租户近 N 日异常等级（租户列表角标用）。
 * @param {number[]} tenantIds
 * @param {number} [days]
 * @returns {Promise<Map<number, 'warn'|'critical'|null>>}
 */
export async function getAnomalyLevelsForTenants(tenantIds, days = 7) {
  const map = new Map();
  const ids = [...new Set((tenantIds || []).map((id) => Number(id)).filter(Boolean))];
  if (!ids.length) return map;

  const { since, days: d } = sinceDays(days);

  const [qaRows, skipRows, tenants] = await Promise.all([
    AiReplyLog.findAll({
      attributes: [
        'tenant_id',
        [fn('SUM', literal("CASE WHEN qa_status = 'failed' THEN 1 ELSE 0 END")), 'qa_failed'],
        [fn('SUM', literal("CASE WHEN qa_status = 'pending' THEN 1 ELSE 0 END")), 'qa_pending'],
        [fn('COUNT', col('id')), 'auto_sent'],
      ],
      where: {
        tenant_id: { [Op.in]: ids },
        status: 'approved',
        approved_by: null,
        created_at: { [Op.gte]: since },
      },
      group: ['tenant_id'],
      raw: true,
    }),
    AuditLog.findAll({
      attributes: ['tenant_id', [fn('COUNT', col('id')), 'skip_count']],
      where: {
        tenant_id: { [Op.in]: ids },
        action: 'inbox_ai_auto_send_skipped',
        created_at: { [Op.gte]: since },
      },
      group: ['tenant_id'],
      raw: true,
    }),
    Tenant.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'inbox_ai_auto_send', 'inbox_ai_auto_send_pricing', 'inbox_ai_platform_disabled'],
    }),
  ]);

  const statsById = new Map();
  for (const id of ids) {
    statsById.set(id, { qa_failed: 0, qa_pending: 0, auto_sent: 0, skip_count: 0 });
  }
  for (const r of qaRows) {
    const id = Number(r.tenant_id);
    const cur = statsById.get(id);
    if (!cur) continue;
    cur.qa_failed = Number(r.qa_failed) || 0;
    cur.qa_pending = Number(r.qa_pending) || 0;
    cur.auto_sent = Number(r.auto_sent) || 0;
  }
  for (const r of skipRows) {
    const id = Number(r.tenant_id);
    const cur = statsById.get(id);
    if (cur) cur.skip_count = Number(r.skip_count) || 0;
  }

  for (const tenant of tenants) {
    const id = Number(tenant.id);
    if (tenant.inbox_ai_platform_disabled) {
      map.set(id, null);
      continue;
    }
    const stats = statsById.get(id) || { qa_failed: 0, qa_pending: 0, skip_count: 0 };
    const auto_send_on = Boolean(tenant.inbox_ai_auto_send || tenant.inbox_ai_auto_send_pricing);
    const built = classifyInboxAiAnomaly({ ...stats, days: d, auto_send_on });
    map.set(id, built?.level ?? null);
  }

  return map;
}
