/**
 * @file 广告监测与归因：点击入库、302 跳转、多平台转化回传。
 */
import { URL } from 'url';
import { Op, fn, col } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { AdClickRecord, AdConversionEvent, AdSpendDaily, Tenant, WeworkChannel } from '../models/index.js';
import { env } from '../config/env.js';
import { recordServerMarketingEvent } from './marketingEvent.service.js';
import * as aggRollup from './aggregationRollup.service.js';
import { reportToAdPlatform, listSupportedConversionPlatforms } from './adPlatformConversion/index.js';

/** @param {Record<string, unknown>} query */
export function inferPlatform(query) {
  const q = query || {};
  const ex = String(q.platform || '').toLowerCase();
  if (['gdt', 'tencent', 'ams'].includes(ex)) return 'gdt';
  if (['ocean', 'byte', 'douyin'].includes(ex)) return 'ocean';
  if (['baidu', 'bd'].includes(ex)) return 'baidu';
  if (['kuaishou', 'ks'].includes(ex)) return 'kuaishou';
  if (['xhs', 'xiaohongshu', 'redbook'].includes(ex)) return 'xhs';
  if (['zhihu', 'zh'].includes(ex)) return 'zhihu';
  if (q.clickid) return 'ocean';
  if (q.gdt_vid || q.click_id) return 'gdt';
  if (q.bd_vid) return 'baidu';
  if (q.ks_callback) return 'kuaishou';
  return 'unknown';
}

/** @param {Record<string, unknown>} query */
export function extractClickKey(query) {
  const q = query || {};
  const keys = ['click_id', 'clickid', 'gdt_vid', 'bd_vid', 'track_id', 'req_id'];
  for (const k of keys) {
    const v = q[k];
    if (v != null && String(v).trim() !== '') {
      return String(v).trim().slice(0, 500);
    }
  }
  return null;
}

export function getSupportedConversionPlatforms() {
  return listSupportedConversionPlatforms();
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
  const passthrough = [
    'click_id',
    'clickid',
    'gdt_vid',
    'bd_vid',
    '__CALLBACK__',
    'callback',
    'ks_callback',
    'track_id',
    'req_id',
    'state',
    'platform',
  ];
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
 * 转化上报：按平台分发至腾讯 / 巨量 / 百度 / 快手 / 小红书等适配器。
 * @param {{ clickKey?: string; adHit?: number; platform?: string; eventType?: string; eventValue?: number }} _payload
 */
export async function reportConversion(_payload) {
  const payload = _payload || {};
  const clickKey = String(payload.clickKey || payload.click_key || '').trim();
  const adHit = payload.adHit != null ? Number(payload.adHit) : payload.ad_hit != null ? Number(payload.ad_hit) : null;
  const eventType = String(payload.eventType || payload.event_type || 'register').slice(0, 64);
  const eventValue = Number(payload.eventValue ?? payload.event_value ?? 0);
  if (!clickKey && !(adHit && Number.isFinite(adHit))) {
    throw new HttpError(400, '缺少 clickKey 或 adHit', 400);
  }

  const where = adHit && Number.isFinite(adHit) ? { id: adHit } : { click_key: clickKey };
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

  const platformResult = await reportToAdPlatform({
    clickRecord: plain,
    eventType,
    eventValue: Number.isFinite(eventValue) ? eventValue : 0,
  });
  const reportStatus = platformResult.status;
  const reportResponse = String(platformResult.response || '').slice(0, 2000);

  await conv.update({ report_status: reportStatus, report_response: reportResponse });
  await click.update({
    status: reportStatus === 'reported' ? 'reported' : plain.status === 'pending' ? 'converted' : plain.status,
  });

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
    provider: platformResult.provider || plain.platform,
    report_status: reportStatus,
    report_response: reportResponse,
  };
}

/**
 * 留资等场景：根据 URL 归因参数自动回传（不抛错，仅记日志）。
 * @param {object} body
 */
/** 企微「联系我」state 上限 */
const WEWORK_STATE_MAX = 30;

/**
 * 为广告点击生成企微活码 state（≤30 字符），回调时解析为 ad_hit。
 * @param {number} adHit
 */
export function buildAdContactWayState(adHit) {
  const id = Number(adHit);
  if (!Number.isFinite(id) || id < 1) return null;
  return `zfah${Math.floor(id)}`.slice(0, WEWORK_STATE_MAX);
}

/**
 * 从企微回调 state 解析广告归因。
 * @param {string | null | undefined} state
 * @returns {{ adHit?: number; clickKey?: string } | null}
 */
export function parseAdAttributionFromState(state) {
  const s = String(state || '').trim();
  if (!s) return null;
  let m = /^zfah(\d{1,20})$/i.exec(s);
  if (m) return { adHit: Number(m[1]) };
  m = /^zf_ad_(\d{1,20})$/i.exec(s);
  if (m) return { adHit: Number(m[1]) };
  m = /^zfck([a-zA-Z0-9_-]{4,26})$/i.exec(s);
  if (m) return { clickKey: m[1] };
  if (/^\d{1,20}$/.test(s)) return { adHit: Number(s) };
  if (s.length >= 6 && s.length <= WEWORK_STATE_MAX && !s.startsWith('t')) {
    return { clickKey: s };
  }
  return null;
}

/**
 * 企微加好友：从 state / 活码配置 / click_key 解析归因。
 * @param {{ tenantId: number; state?: string | null; channelId?: number | null }} payload
 */
export async function resolveAdAttributionFromWeworkAdd(payload) {
  const tenantId = Number(payload.tenantId);
  if (!Number.isFinite(tenantId) || tenantId < 1) return null;

  const fromState = parseAdAttributionFromState(payload.state);
  if (fromState?.adHit || fromState?.clickKey) {
    return fromState;
  }

  if (payload.channelId) {
    const ch = await WeworkChannel.findOne({
      where: { id: Number(payload.channelId), tenant_id: tenantId },
      attributes: ['config'],
    });
    const cfg = ch?.config && typeof ch.config === 'object' ? ch.config : {};
    const adHitRaw = cfg.ad_hit ?? cfg.adHit;
    if (adHitRaw != null && Number.isFinite(Number(adHitRaw))) {
      return { adHit: Number(adHitRaw) };
    }
    const ck = cfg.click_key ?? cfg.clickid ?? cfg.click_id ?? cfg.gdt_vid ?? cfg.bd_vid;
    if (ck && String(ck).trim()) {
      return { clickKey: String(ck).trim() };
    }
  }

  const state = String(payload.state || '').trim();
  if (state) {
    const click = await AdClickRecord.findOne({
      where: { tenant_id: tenantId, click_key: state },
      order: [['id', 'DESC']],
    });
    if (click) {
      return { adHit: Number(click.id), clickKey: click.click_key };
    }
  }

  return null;
}

/**
 * 校验 ad_hit 属于租户，并返回可用于企微活码的 state。
 * @param {{ tenantId: number; adHit: number }} opts
 */
export async function getWeworkStateForAdHit(opts) {
  const tenantId = Number(opts.tenantId);
  const adHit = Number(opts.adHit);
  if (!Number.isFinite(tenantId) || tenantId < 1 || !Number.isFinite(adHit) || adHit < 1) {
    throw new HttpError(400, '缺少 tenant_id 或 ad_hit', 400);
  }
  const click = await AdClickRecord.findOne({
    where: { id: adHit, tenant_id: tenantId },
  });
  if (!click) {
    throw new HttpError(404, '广告点击记录不存在或不属于该企业', 404);
  }
  const state = buildAdContactWayState(adHit);
  if (!state) {
    throw new HttpError(400, '无法生成 state', 400);
  }
  return { ad_hit: adHit, state, platform: click.platform, click_key: click.click_key };
}

/**
 * 企微加好友后自动转化回传（事件 wework_add）。
 * @param {{ tenantId: number; state?: string | null; channelId?: number | null }} payload
 */
export async function tryAutoReportConversionOnWeworkAdd(payload) {
  if (!env.adConversion?.autoOnWeworkAdd) return null;
  const attr = await resolveAdAttributionFromWeworkAdd(payload);
  if (!attr) return null;
  try {
    const result = await reportConversion({
      adHit: attr.adHit,
      clickKey: attr.clickKey,
      eventType: 'wework_add',
      eventValue: 0,
    });
    if (result.report_status === 'reported' && attr.clickKey) {
      markAttributedByClickKey(attr.clickKey, 'attributed').catch(() => {});
    }
    return result;
  } catch (err) {
    console.error('[ads] auto conversion on wework add', err?.message || err);
    return null;
  }
}

export async function tryAutoReportConversionOnLead(body) {
  if (!env.adConversion?.autoOnLead) return null;
  const value = body || {};
  let adHit = value.ad_hit != null ? Number(value.ad_hit) : null;
  if (adHit != null && !Number.isFinite(adHit)) adHit = null;
  const clickKey = String(
    value.clickid || value.click_id || value.gdt_vid || value.bd_vid || '',
  ).trim();
  if (!adHit && !clickKey) return null;
  try {
    return await reportConversion({
      adHit: adHit || undefined,
      clickKey: clickKey || undefined,
      eventType: 'lead_submit',
      eventValue: 0,
    });
  } catch (err) {
    console.error('[ads] auto conversion on lead', err?.message || err);
    return null;
  }
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
