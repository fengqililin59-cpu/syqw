/**
 * @file 日级预聚合：广告 ROI、渠道 UTM；与 background_jobs 配合。
 */
import dayjs from 'dayjs';
import { Op, fn, col, literal } from 'sequelize';
import { QueryTypes } from 'sequelize';
import {
  sequelize,
  AdClickRecord,
  AdConversionEvent,
  PageVisit,
  AggAdsRoiDaily,
  AggChannelDaily,
  AggregationMeta,
} from '../models/index.js';

function shDayBounds(statDate) {
  const start = new Date(`${statDate}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 86400000);
  return { start, end };
}

export function expectedDaysInclusive(startDate, endDate) {
  return dayjs(endDate).diff(dayjs(startDate), 'day') + 1;
}

/** 区间内 agg 是否覆盖每个自然日（不含「今天」，避免与实时写入竞态） */
export async function adsRoiAggCoversRange(tenantId, startDate, endDate) {
  if (!tenantId) return false;
  const today = dayjs().format('YYYY-MM-DD');
  if (endDate >= today) return false;
  const expected = expectedDaysInclusive(startDate, endDate);
  const rows = await sequelize.query(
    `SELECT COUNT(DISTINCT stat_date) AS c FROM agg_ads_roi_daily
     WHERE tenant_id = :tid AND stat_date BETWEEN :s AND :e`,
    { replacements: { tid: Number(tenantId), s: startDate, e: endDate }, type: QueryTypes.SELECT },
  );
  const c = Number(rows[0]?.c || 0);
  return c === expected;
}

export async function channelAggCoversRange(tenantId, startDate, endDate) {
  if (!tenantId) return false;
  const today = dayjs().format('YYYY-MM-DD');
  if (endDate >= today) return false;
  const expected = expectedDaysInclusive(startDate, endDate);
  const rows = await sequelize.query(
    `SELECT COUNT(DISTINCT stat_date) AS c FROM agg_channel_daily
     WHERE tenant_id = :tid AND stat_date BETWEEN :s AND :e`,
    { replacements: { tid: Number(tenantId), s: startDate, e: endDate }, type: QueryTypes.SELECT },
  );
  return Number(rows[0]?.c || 0) === expected;
}

async function upsertAggregationMeta(tenantId, dataset) {
  const tid = Number(tenantId);
  const Model = dataset === 'channel_daily' ? AggChannelDaily : AggAdsRoiDaily;
  const minR = await Model.min('stat_date', { where: { tenant_id: tid } });
  const maxR = await Model.max('stat_date', { where: { tenant_id: tid } });
  if (!minR || !maxR) return;
  const [row] = await AggregationMeta.findOrCreate({
    where: { tenant_id: tid, dataset },
    defaults: { through_date: maxR, earliest_date: minR },
  });
  await row.update({ through_date: maxR, earliest_date: minR });
}

/**
 * 单日单租户广告 ROI 聚合
 */
export async function rollupAdsRoiDay(tenantId, statDate) {
  const tid = Number(tenantId);
  const { start, end } = shDayBounds(statDate);
  await AggAdsRoiDaily.destroy({ where: { tenant_id: tid, stat_date: statDate } });

  const clickRows = await AdClickRecord.findAll({
    where: { tenant_id: tid, created_at: { [Op.gte]: start, [Op.lt]: end } },
    attributes: ['platform', [fn('COUNT', col('id')), 'n']],
    group: ['platform'],
    raw: true,
  });

  const convRows = await sequelize.query(
    `SELECT platform,
        COUNT(*) AS conversions,
        SUM(CASE WHEN report_status = 'reported' THEN 1 ELSE 0 END) AS reported,
        COALESCE(SUM(event_value), 0) AS conversion_value
     FROM ad_conversion_events
     WHERE tenant_id = :tid AND created_at >= :s AND created_at < :e
     GROUP BY platform`,
    { replacements: { tid, s: start, e: end }, type: QueryTypes.SELECT },
  );

  const byPlat = new Map();
  for (const r of clickRows) {
    const p = r.platform || 'unknown';
    byPlat.set(p, { platform: p, clicks: Number(r.n || 0), conversions: 0, reported: 0, conversion_value: 0 });
  }
  for (const r of convRows) {
    const p = r.platform || 'unknown';
    if (!byPlat.has(p)) {
      byPlat.set(p, { platform: p, clicks: 0, conversions: 0, reported: 0, conversion_value: 0 });
    }
    const row = byPlat.get(p);
    row.conversions = Number(r.conversions || 0);
    row.reported = Number(r.reported || 0);
    row.conversion_value = Number(r.conversion_value || 0);
  }

  const bulk = [...byPlat.values()].map((r) => ({
    tenant_id: tid,
    stat_date: statDate,
    platform: r.platform,
    clicks: r.clicks,
    conversions: r.conversions,
    reported: r.reported,
    conversion_value: r.conversion_value,
  }));
  if (bulk.length) {
    await AggAdsRoiDaily.bulkCreate(bulk);
  }
  await upsertAggregationMeta(tid, 'ads_roi_daily');
}

export async function rollupAdsRoiDayRange(tenantId, startDate, endDate) {
  let d = dayjs(startDate);
  const last = dayjs(endDate);
  while (!d.isAfter(last)) {
    await rollupAdsRoiDay(tenantId, d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
}

export async function rollupChannelDay(tenantId, statDate) {
  const tid = Number(tenantId);
  const { start, end } = shDayBounds(statDate);
  await AggChannelDaily.destroy({ where: { tenant_id: tid, stat_date: statDate } });

  const rows = await PageVisit.findAll({
    where: { tenant_id: tid, created_at: { [Op.gte]: start, [Op.lt]: end } },
    attributes: [
      [fn('COALESCE', col('utm_source'), literal("'(direct)'")), 'source_key'],
      [fn('COUNT', col('id')), 'visit_count'],
      [fn('COUNT', fn('DISTINCT', col('session_id'))), 'session_count'],
      [fn('COUNT', fn('DISTINCT', col('user_id'))), 'user_count'],
    ],
    group: [fn('COALESCE', col('utm_source'), literal("'(direct)'"))],
    raw: true,
  });

  const bulk = rows.map((r) => ({
    tenant_id: tid,
    stat_date: statDate,
    source_key: String(r.source_key || '(direct)').slice(0, 100),
    visit_count: Number(r.visit_count || 0),
    session_count: Number(r.session_count || 0),
    user_count: Number(r.user_count || 0),
  }));
  if (bulk.length) {
    await AggChannelDaily.bulkCreate(bulk);
  }
  await upsertAggregationMeta(tid, 'channel_daily');
}

export async function rollupChannelDayRange(tenantId, startDate, endDate) {
  let d = dayjs(startDate);
  const last = dayjs(endDate);
  while (!d.isAfter(last)) {
    await rollupChannelDay(tenantId, d.format('YYYY-MM-DD'));
    d = d.add(1, 'day');
  }
}

/** 某日所有有数据的租户 */
export async function listTenantIdsActiveOnDate(statDate) {
  const { start, end } = shDayBounds(statDate);
  const rows = await sequelize.query(
    `SELECT DISTINCT tenant_id FROM (
       SELECT tenant_id FROM ad_click_records
        WHERE tenant_id IS NOT NULL AND created_at >= :s AND created_at < :e
       UNION
       SELECT tenant_id FROM ad_conversion_events
        WHERE tenant_id IS NOT NULL AND created_at >= :s AND created_at < :e
       UNION
       SELECT tenant_id FROM page_visits
        WHERE tenant_id IS NOT NULL AND created_at >= :s AND created_at < :e
     ) t`,
    { replacements: { s: start, e: end }, type: QueryTypes.SELECT },
  );
  return rows.map((r) => Number(r.tenant_id)).filter((id) => Number.isFinite(id) && id > 0);
}

export async function rollupDailyBatchForDate(statDate) {
  const tenants = await listTenantIdsActiveOnDate(statDate);
  let n = 0;
  for (const tid of tenants) {
    await rollupAdsRoiDay(tid, statDate);
    await rollupChannelDay(tid, statDate);
    n += 1;
  }
  return { stat_date: statDate, tenants: n };
}

/** 从预聚合表读 ROI 汇总（按平台），不含 spend；spend 仍由 adTracking 合并 */
export async function queryAdsRoiSummaryFromAgg({ tenantId, startDate, endDate }) {
  const rows = await sequelize.query(
    `SELECT platform,
        SUM(clicks) AS clicks,
        SUM(conversions) AS conversions,
        SUM(reported) AS reported,
        COALESCE(SUM(conversion_value), 0) AS conversion_value
     FROM agg_ads_roi_daily
     WHERE tenant_id = :tid AND stat_date BETWEEN :s AND :e
     GROUP BY platform`,
    { replacements: { tid: Number(tenantId), s: startDate, e: endDate }, type: QueryTypes.SELECT },
  );
  return rows.map((r) => ({
    platform: r.platform || 'unknown',
    clicks: Number(r.clicks || 0),
    conversions: Number(r.conversions || 0),
    reported: Number(r.reported || 0),
    conversion_value: Number(r.conversion_value || 0),
  }));
}

export async function queryAdsRoiTrendFromAgg({ tenantId, startDate, endDate, platform }) {
  const p = String(platform || '').trim();
  const rep = { tid: Number(tenantId), s: startDate, e: endDate };
  let sql = `SELECT stat_date,
        SUM(clicks) AS clicks,
        SUM(conversions) AS conversions,
        SUM(reported) AS reported
     FROM agg_ads_roi_daily
     WHERE tenant_id = :tid AND stat_date BETWEEN :s AND :e`;
  if (p && p !== 'all') {
    sql += ' AND platform = :pl';
    rep.pl = p;
  }
  sql += ' GROUP BY stat_date ORDER BY stat_date';
  const rows = await sequelize.query(sql, { replacements: rep, type: QueryTypes.SELECT });
  return rows.map((r) => {
    const raw = r.stat_date;
    const date = raw instanceof Date ? dayjs(raw).format('YYYY-MM-DD') : String(raw).slice(0, 10);
    return {
      date,
      clicks: Number(r.clicks || 0),
      conversions: Number(r.conversions || 0),
      reported: Number(r.reported || 0),
    };
  });
}

export async function queryChannelReportFromAgg({ tenantId, startDate, endDate }) {
  const rows = await sequelize.query(
    `SELECT source_key AS source,
        SUM(visit_count) AS visit_count,
        SUM(session_count) AS session_count,
        SUM(user_count) AS user_count
     FROM agg_channel_daily
     WHERE tenant_id = :tid AND stat_date BETWEEN :s AND :e
     GROUP BY source_key
     ORDER BY visit_count DESC`,
    { replacements: { tid: Number(tenantId), s: startDate, e: endDate }, type: QueryTypes.SELECT },
  );
  return rows.map((r) => {
    const visit = Number(r.visit_count || 0);
    const session = Number(r.session_count || 0);
    const users = Number(r.user_count || 0);
    return {
      source: String(r.source || '(direct)'),
      visit_count: visit,
      session_count: session,
      user_count: users,
      session_to_user_rate: session > 0 ? Number(((users / session) * 100).toFixed(2)) : 0,
    };
  });
}
