/**
 * @file 广告监测与归因（Phase 2）：点击入库、302 跳转、转化上报占位。
 * @description 与各广告平台 POST conversions 对接需在拿到广告主 token 后实现 reportConversion。
 */
import { URL } from 'url';
import { Op, fn, col } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { AdClickRecord, AdConversionEvent, AdSpendDaily, Tenant } from '../models/index.js';
import { env } from '../config/env.js';
import { recordServerMarketingEvent } from './marketingEvent.service.js';
import * as aggRollup from './aggregationRollup.service.js';

/** @param {Record<string, unknown>} query */
export function inferPlatform(query) {
  const q = query || {};
  const ex = String(q.platform || '').toLowerCase();
  if (['gdt', 'tencent', 'ams'].includes(ex)) return 'gdt';
  if (['ocean', 'byte', 'douyin'].includes(ex)) return 'ocean';
  if (['baidu', 'bd'].includes(ex)) return 'baidu';
  if (q.gdt_vid || q.click_id || q.__CALLBACK__) return 'gdt';
  if (q.clickid) return 'ocean';
  if (q.bd_vid) return 'baidu';
  return 'unknown';
}

/** @param {Record<string, unknown>} query */
export function extractClickKey(query) {
  const q = query || {};
  const keys = ['click_id', 'clickid', 'gdt_vid', 'bd_vid'];
  for (const k of keys) {
    const v = q[k];
    if (v != null && String(v).trim() !== '') {
      return String(v).trim().slice(0, 500);
    }
  }
  return null;
}

/**
 * 校验 next 跳转地址：仅 http(s)，且 hostname 在允许列表或默认前端域内
 * @param {string | undefined} raw
 */
export function safeLandingUrl(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  let u;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return null;
  }
  const allow = env.adRedirectAllowHosts;
  if (!allow.length) {
    try {
      const base = new URL(env.frontendUrl);
      if (u.hostname === base.hostname) {
        return u.toString();
      }
    } catch {
      /* ignore */
    }
    return null;
  }
  const ok = allow.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  return ok ? u.toString() : null;
}

/**
 * 记录一次广告点击（监测链接入口）
 * @param {{ query: Record<string, string>; tenantHint?: number | null }} opts
 */
export async function storeClickRecord(opts) {
  const { query, tenantHint } = opts;
  const platform = inferPlatform(query);
  let clickKey = extractClickKey(query);
  if (!clickKey) {
    clickKey = `noid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  let tenantId =
    tenantHint != null && Number.isFinite(tenantHint) && tenantHint > 0 ? Number(tenantHint) : null;
  if (tenantId) {
    const t = await Tenant.findByPk(tenantId);
    if (!t) {
      tenantId = null;
    }
  }

  const row = await AdClickRecord.create({
    tenant_id: tenantId,
    platform,
    click_key: clickKey,
    status: 'pending',
    raw_query: query,
    redirect_host: null,
  });

  return row.get({ plain: true });
}

/**
 * GET 监测：写库后 302 到落地页，并把常见追踪参数附加到落地页 query
 * @param {import('express').Request} req
 */
export async function handleAdRedirect(req) {
  /** @type {Record<string, string>} */
  const flat = {};
  for (const [k, v] of Object.entries(req.query)) {
    flat[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }

  const nextRaw = flat.next || flat.redirect || flat.target || flat.landing;
  const tenantHint = flat.tenant_id ? Number(flat.tenant_id) : null;

  const landing = safeLandingUrl(typeof nextRaw === 'string' ? nextRaw : '');
  if (!landing) {
    throw new HttpError(
      400,
      '缺少或非法的落地页地址（请传 next= 完整 HTTPS URL；若配置了 AD_REDIRECT_ALLOW_HOSTS，则域名须在白名单）',
      400,
    );
  }

  const record = await storeClickRecord({ query: flat, tenantHint });

  const dest = new URL(landing);
  const passthrough = ['click_id', 'clickid', 'gdt_vid', 'bd_vid', '__CALLBACK__', 'state'];
  for (const k of passthrough) {
    const v = flat[k];
    if (v != null && v !== '' && !dest.searchParams.has(k)) {
      dest.searchParams.set(k, v);
    }
  }
  if (!dest.searchParams.has('ad_hit')) {
    dest.searchParams.set('ad_hit', String(record.id));
  }

  await AdClickRecord.update(
    { redirect_host: dest.hostname },
    { where: { id: record.id } },
  );

  return { redirectUrl: dest.toString(), recordId: record.id };
}

/**
 * 转化上报占位：按平台调用对应 API（需广告主账户与 token）
 * @param {{ clickKey: string; platform?: string; eventType: string; meta?: object }} _payload
 */
export async function reportConversion(_payload) {
  const payload = _payload || {};
  const clickKey = String(payload.clickKey || '').trim();
  const adHit = payload.adHit ? Number(payload.adHit) : null;
  const eventType = String(payload.eventType || 'register').slice(0, 64);
  const eventValue = Number(payload.eventValue || 0);
  if (!clickKey && !(adHit && Number.isFinite(adHit))) {
    throw new HttpError(400, '缺少 clickKey 或 adHit', 400);
  }

  const where = adHit ? { id: adHit } : { click_key: clickKey };
  const click = await AdClickRecord.findOne({ where, order: [['id', 'DESC']] });
  if (!click) throw new HttpError(404, '未找到对应广告点击记录', 404);
  const plain = click.get({ plain: true });

  const conv = await AdConversionEvent.create({
    tenant_id: plain.tenant_id || null,
    ad_click_id: plain.id,
    platform: plain.platform || payload.platform || 'unknown',
    click_key: plain.click_key,
    event_type: eventType,
    event_value: Number.isFinite(eventValue) ? eventValue : 0,
    report_status: 'pending',
  });

  let reportStatus = 'skipped';
  let reportResponse = 'platform_not_supported';
  if (plain.platform === 'gdt') {
    if (!env.tencentAds.enabled) {
      reportStatus = 'skipped';
      reportResponse = 'tencent_ads_disabled';
    } else if (!env.tencentAds.accessToken || !env.tencentAds.accountId) {
      reportStatus = 'failed';
      reportResponse = 'missing_tencent_ads_credentials';
    } else {
      const body = {
        account_id: env.tencentAds.accountId,
        click_id: plain.click_key,
        conversion_type: eventType,
        conversion_time: Math.floor(Date.now() / 1000),
        value: Number.isFinite(eventValue) ? eventValue : 0,
      };
      const resp = await fetch(env.tencentAds.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.tencentAds.accessToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = await resp.text();
      if (resp.ok) {
        reportStatus = 'reported';
        reportResponse = data.slice(0, 2000);
      } else {
        reportStatus = 'failed';
        reportResponse = `${resp.status}:${data}`.slice(0, 2000);
      }
    }
  }

  await conv.update({ report_status: reportStatus, report_response: reportResponse });
  await click.update({ status: reportStatus === 'reported' ? 'reported' : plain.status === 'pending' ? 'converted' : plain.status });

  await recordServerMarketingEvent({
    tenant_id: plain.tenant_id,
    ad_hit: plain.id,
    event_key: 'ad_conversion',
    properties: {
      conversion_type: eventType,
      conversion_id: Number(conv.id),
      report_status: reportStatus,
      click_key: plain.click_key,
    },
  });

  return {
    conversion_id: Number(conv.id),
    click_id: Number(plain.id),
    click_key: plain.click_key,
    platform: plain.platform,
    report_status: reportStatus,
    report_response: reportResponse,
  };
}

/**
 * 企微加好友后可调用：将 click 记录与私域事件关联（后续与 webhook 串联）
 */
export async function markAttributedByClickKey(clickKey, status = 'attributed') {
  const row = await AdClickRecord.findOne({
    where: { click_key: String(clickKey) },
    order: [['id', 'DESC']],
  });
  if (!row) {
    return null;
  }
  await row.update({ status });
  return row.get({ plain: true });
}

function parseDateOnly(s) {
  if (!s || typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeYmd(s) {
  const t = String(s || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function buildRoiItemsFromPlatformRows(byPlatform, spendByPlatform) {
  for (const k of spendByPlatform.keys()) {
    if (!byPlatform.has(k)) {
      byPlatform.set(k, { platform: k, clicks: 0, conversions: 0, reported: 0, conversion_value: 0 });
    }
  }
  const items = [...byPlatform.values()].map((r) => {
    const spend = spendByPlatform.get(r.platform) || 0;
    const spendCny = Number(spend);
    return {
      ...r,
      spend_cny: Number(spendCny.toFixed(2)),
      cpa: r.conversions > 0 ? Number((spendCny / r.conversions).toFixed(2)) : null,
      roas: spendCny > 0 ? Number((r.conversion_value / spendCny).toFixed(4)) : null,
      conversion_rate: r.clicks > 0 ? Number(((r.conversions / r.clicks) * 100).toFixed(2)) : 0,
      report_rate: r.conversions > 0 ? Number(((r.reported / r.conversions) * 100).toFixed(2)) : 0,
    };
  });
  items.sort((a, b) => b.clicks - a.clicks);
  return items;
}

function dayKey(d) {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = `${dt.getMonth() + 1}`.padStart(2, '0');
  const day = `${dt.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function spendDateBetween(startDate, endDate) {
  if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  return { [Op.between]: [startDate, endDate] };
}

async function fetchSpendByPlatform({ tenantId, startDate, endDate }) {
  const m = new Map();
  if (!tenantId) return m;
  const range = spendDateBetween(startDate, endDate);
  if (!range) return m;
  const rows = await AdSpendDaily.findAll({
    where: { tenant_id: Number(tenantId), stat_date: range },
    attributes: ['platform', [fn('SUM', col('spend_cny')), 'total_spend']],
    group: ['platform'],
    raw: true,
  });
  for (const r of rows) {
    const k = r.platform || 'unknown';
    m.set(k, Number(r.total_spend || 0));
  }
  return m;
}

async function fetchSpendByDay({ tenantId, sd, ed, platform }) {
  const m = new Map();
  if (!tenantId || !sd || !ed) return m;
  const range = spendDateBetween(dayKey(sd), dayKey(ed));
  if (!range) return m;
  const where = { tenant_id: Number(tenantId), stat_date: range };
  const p = String(platform || '').trim();
  if (p && p !== 'all') where.platform = p;
  const rows = await AdSpendDaily.findAll({
    where,
    attributes: ['stat_date', [fn('SUM', col('spend_cny')), 'total_spend']],
    group: ['stat_date'],
    raw: true,
  });
  for (const r of rows) {
    const raw = r.stat_date;
    const key = raw instanceof Date ? dayKey(raw) : String(raw).slice(0, 10);
    m.set(key, Number(r.total_spend || 0));
  }
  return m;
}

export async function getRoiSummary({ tenantId, startDate, endDate }) {
  const sdStr = normalizeYmd(startDate);
  const edStr = normalizeYmd(endDate);
  if (env.aggregation?.readFromAgg && tenantId && sdStr && edStr) {
    const covers = await aggRollup.adsRoiAggCoversRange(tenantId, sdStr, edStr);
    if (covers) {
      const baseRows = await aggRollup.queryAdsRoiSummaryFromAgg({
        tenantId,
        startDate: sdStr,
        endDate: edStr,
      });
      const spendByPlatform = await fetchSpendByPlatform({ tenantId, startDate: sdStr, endDate: edStr });
      const byPlatform = new Map();
      for (const r of baseRows) {
        const k = r.platform || 'unknown';
        byPlatform.set(k, {
          platform: k,
          clicks: r.clicks,
          conversions: r.conversions,
          reported: r.reported,
          conversion_value: r.conversion_value,
        });
      }
      return buildRoiItemsFromPlatformRows(byPlatform, spendByPlatform);
    }
  }

  const clickWhere = {};
  const convWhere = {};
  if (tenantId) {
    clickWhere.tenant_id = Number(tenantId);
    convWhere.tenant_id = Number(tenantId);
  }
  const sd = parseDateOnly(startDate);
  const ed = parseDateOnly(endDate);
  if (sd && ed) {
    const end = new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1);
    clickWhere.created_at = { [Op.between]: [sd, end] };
    convWhere.created_at = { [Op.between]: [sd, end] };
  }

  const [clicks, conversions, spendByPlatform] = await Promise.all([
    AdClickRecord.findAll({ where: clickWhere, raw: true }),
    AdConversionEvent.findAll({ where: convWhere, raw: true }),
    fetchSpendByPlatform({ tenantId, startDate, endDate }),
  ]);

  const byPlatform = new Map();
  for (const c of clicks) {
    const k = c.platform || 'unknown';
    if (!byPlatform.has(k)) byPlatform.set(k, { platform: k, clicks: 0, conversions: 0, reported: 0, conversion_value: 0 });
    byPlatform.get(k).clicks += 1;
  }
  for (const x of conversions) {
    const k = x.platform || 'unknown';
    if (!byPlatform.has(k)) byPlatform.set(k, { platform: k, clicks: 0, conversions: 0, reported: 0, conversion_value: 0 });
    const row = byPlatform.get(k);
    row.conversions += 1;
    if (x.report_status === 'reported') row.reported += 1;
    row.conversion_value += Number(x.event_value || 0);
  }

  for (const k of spendByPlatform.keys()) {
    if (!byPlatform.has(k)) {
      byPlatform.set(k, { platform: k, clicks: 0, conversions: 0, reported: 0, conversion_value: 0 });
    }
  }

  return buildRoiItemsFromPlatformRows(byPlatform, spendByPlatform);
}

export async function getRoiTrend({ tenantId, startDate, endDate, platform }) {
  const sd = parseDateOnly(startDate) || new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const ed = parseDateOnly(endDate) || new Date();
  const sdStr = normalizeYmd(startDate) || dayKey(sd);
  const edStr = normalizeYmd(endDate) || dayKey(ed);

  if (env.aggregation?.readFromAgg && tenantId && sdStr && edStr) {
    const covers = await aggRollup.adsRoiAggCoversRange(tenantId, sdStr, edStr);
    if (covers) {
      const aggRows = await aggRollup.queryAdsRoiTrendFromAgg({
        tenantId,
        startDate: sdStr,
        endDate: edStr,
        platform,
      });
      const aggByDate = new Map(aggRows.map((r) => [r.date, r]));
      const spendByDay = await fetchSpendByDay({ tenantId, sd, ed, platform });
      const index = new Map();
      for (let t = sd.getTime(); t <= ed.getTime(); t += 24 * 60 * 60 * 1000) {
        const k = dayKey(new Date(t));
        const a = aggByDate.get(k) || { clicks: 0, conversions: 0, reported: 0 };
        const spend = spendByDay.get(k) || 0;
        index.set(k, {
          date: k,
          clicks: a.clicks,
          conversions: a.conversions,
          reported: a.reported,
          spend_cny: Number(Number(spend).toFixed(2)),
        });
      }
      return [...index.values()];
    }
  }

  const clickWhere = {};
  const convWhere = {};
  if (tenantId) {
    clickWhere.tenant_id = Number(tenantId);
    convWhere.tenant_id = Number(tenantId);
  }
  const p = String(platform || '').trim();
  if (p && p !== 'all') {
    clickWhere.platform = p;
    convWhere.platform = p;
  }
  const end = new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1);
  clickWhere.created_at = { [Op.between]: [sd, end] };
  convWhere.created_at = { [Op.between]: [sd, end] };

  const [clicks, conversions, spendByDay] = await Promise.all([
    AdClickRecord.findAll({ where: clickWhere, raw: true, attributes: ['created_at'] }),
    AdConversionEvent.findAll({ where: convWhere, raw: true, attributes: ['created_at', 'report_status'] }),
    fetchSpendByDay({ tenantId, sd, ed, platform }),
  ]);

  const index = new Map();
  for (let t = sd.getTime(); t <= ed.getTime(); t += 24 * 60 * 60 * 1000) {
    const k = dayKey(new Date(t));
    index.set(k, { date: k, clicks: 0, conversions: 0, reported: 0, spend_cny: 0 });
  }
  for (const c of clicks) {
    const k = dayKey(c.created_at);
    if (index.has(k)) index.get(k).clicks += 1;
  }
  for (const x of conversions) {
    const k = dayKey(x.created_at);
    if (index.has(k)) {
      index.get(k).conversions += 1;
      if (x.report_status === 'reported') index.get(k).reported += 1;
    }
  }
  for (const [k, v] of spendByDay) {
    if (index.has(k)) {
      index.get(k).spend_cny = Number(v.toFixed(2));
    }
  }
  return [...index.values()];
}

export async function getRoiDetails({ tenantId, startDate, endDate, platform, limit = 100 }) {
  const where = {};
  if (tenantId) where.tenant_id = Number(tenantId);
  const p = String(platform || '').trim();
  if (p && p !== 'all') where.platform = p;
  const sd = parseDateOnly(startDate);
  const ed = parseDateOnly(endDate);
  if (sd && ed) {
    const end = new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1);
    where.created_at = { [Op.between]: [sd, end] };
  }
  const rows = await AdConversionEvent.findAll({
    where,
    attributes: [
      'id',
      'platform',
      'event_type',
      'event_value',
      'report_status',
      'report_response',
      'click_key',
      'created_at',
    ],
    order: [['created_at', 'DESC']],
    limit: Math.max(1, Math.min(500, Number(limit) || 100)),
    raw: true,
  });
  return rows.map((r) => ({
    id: Number(r.id),
    platform: r.platform || 'unknown',
    event_type: r.event_type || '',
    event_value: Number(r.event_value || 0),
    report_status: r.report_status || 'pending',
    report_response: String(r.report_response || '').slice(0, 300),
    click_key: String(r.click_key || ''),
    created_at: r.created_at,
  }));
}
