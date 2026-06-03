/**
 * @file 平台 MRR 月度快照：落库、查询、补录、环比。
 */
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { PlatformMrrSnapshot, Subscription } from '../models/index.js';
import { computeCurrentMrrEstimate, computeMrrByPlan } from './platformMrrMetrics.service.js';

/**
 * MRR 环比：优先用快照，当月无快照时用实时估算。
 */
export async function getMrrMonthOverMonth() {
  const thisMonth = dayjs().format('YYYY-MM');
  const lastMonth = dayjs().subtract(1, 'month').format('YYYY-MM');

  const [snapshots, currentLive] = await Promise.all([
    loadMrrSnapshotsByMonths([thisMonth, lastMonth]),
    computeCurrentMrrEstimate(),
  ]);

  const thisSnap = snapshots.find((s) => s.snapshot_month === thisMonth);
  const lastSnap = snapshots.find((s) => s.snapshot_month === lastMonth);

  const currentMrr = thisSnap?.mrr_total ?? currentLive;
  const previousMrr = lastSnap?.mrr_total ?? null;

  let delta = null;
  let deltaPct = null;
  if (previousMrr != null) {
    delta = Math.round((currentMrr - previousMrr) * 100) / 100;
    if (previousMrr > 0) {
      deltaPct = Math.round(((currentMrr - previousMrr) / previousMrr) * 10000) / 100;
    }
  }

  return {
    current_mrr: currentMrr,
    current_live_mrr: currentLive,
    previous_mrr: previousMrr,
    previous_month: lastMonth,
    current_month: thisMonth,
    delta,
    delta_pct: deltaPct,
    has_current_snapshot: Boolean(thisSnap),
    has_previous_snapshot: Boolean(lastSnap),
  };
}

/** 运营日报 / 概览用单行文案 */
export function formatMrrMomDigestLine(mom) {
  const cur = Number(mom.current_mrr).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (mom.previous_mrr == null) {
    return `¥${cur}（${mom.previous_month} 无快照，显示实时估算；建议开启 ENABLE_PLATFORM_MRR_SNAPSHOT_CRON）`;
  }
  const prev = Number(mom.previous_mrr).toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  if (mom.delta_pct == null) {
    return `¥${cur}（上月 ¥${prev}）`;
  }
  if (mom.delta_pct > 0) {
    return `¥${cur}（环比 +${mom.delta_pct}% ↑，上月 ¥${prev}）`;
  }
  if (mom.delta_pct < 0) {
    return `¥${cur}（环比 ${mom.delta_pct}% ↓，上月 ¥${prev}）`;
  }
  return `¥${cur}（环比持平，上月 ¥${prev}）`;
}

/**
 * 写入或更新指定月份的 MRR 快照（默认可传当前月）。
 */
export async function captureMrrSnapshot(monthKey = dayjs().format('YYYY-MM')) {
  const key = String(monthKey).trim();
  if (!/^\d{4}-\d{2}$/.test(key)) {
    throw new Error('snapshot_month 须为 YYYY-MM');
  }

  const [mrrTotal, mrrByPlan, activeCount] = await Promise.all([
    computeCurrentMrrEstimate(),
    computeMrrByPlan(),
    Subscription.count({ where: { status: 'active' } }),
  ]);

  const now = new Date();
  const existing = await PlatformMrrSnapshot.findOne({ where: { snapshot_month: key } });
  if (existing) {
    await existing.update({
      mrr_total: mrrTotal,
      active_subscriptions: activeCount,
      mrr_by_plan_json: mrrByPlan,
      captured_at: now,
    });
    return {
      snapshot_month: key,
      mrr_total: mrrTotal,
      active_subscriptions: activeCount,
      updated: true,
    };
  }

  await PlatformMrrSnapshot.create({
    snapshot_month: key,
    mrr_total: mrrTotal,
    active_subscriptions: activeCount,
    mrr_by_plan_json: mrrByPlan,
    captured_at: now,
  });

  return {
    snapshot_month: key,
    mrr_total: mrrTotal,
    active_subscriptions: activeCount,
    updated: false,
  };
}

/**
 * 为近 N 个月补写缺失快照（用当前订阅状态估算，仅适合刚启用时铺底）。
 */
export async function backfillMrrSnapshots(months = 12) {
  const count = Math.min(36, Math.max(1, Number(months) || 12));
  const start = dayjs().subtract(count - 1, 'month').startOf('month');
  const keys = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(start.add(i, 'month').format('YYYY-MM'));
  }

  const existing = await PlatformMrrSnapshot.findAll({
    where: { snapshot_month: { [Op.in]: keys } },
    attributes: ['snapshot_month'],
  });
  const have = new Set(existing.map((r) => r.snapshot_month));

  let created = 0;
  let skipped = 0;
  for (const key of keys) {
    if (have.has(key)) {
      skipped += 1;
      continue;
    }
    await captureMrrSnapshot(key);
    created += 1;
  }

  await captureMrrSnapshot(dayjs().format('YYYY-MM'));

  return { months: count, created, skipped, refreshed_current: true };
}

/**
 * @param {string[]} monthKeys
 */
export async function loadMrrSnapshotsByMonths(monthKeys) {
  if (!monthKeys.length) return [];
  const rows = await PlatformMrrSnapshot.findAll({
    where: { snapshot_month: { [Op.in]: monthKeys } },
    order: [['snapshot_month', 'ASC']],
  });
  return rows.map((r) => ({
    snapshot_month: r.snapshot_month,
    mrr_total: Number(r.mrr_total),
    active_subscriptions: Number(r.active_subscriptions),
    mrr_by_plan: Array.isArray(r.mrr_by_plan_json) ? r.mrr_by_plan_json : [],
    captured_at: r.captured_at,
  }));
}
