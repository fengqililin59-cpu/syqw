/**
 * @file 腾讯广告 Marketing API：日报消耗同步至 ad_spend_daily（金额：接口为「分」，入库为「元」）。
 * @description 多策略自动降级（字段 / adq / level 长枚举与简写枚举），错误透传 code、message_cn、trace_id。
 * @see https://developers.e.qq.com/docs/api/insights/ad_insights/daily_reports_get
 */
import crypto from 'crypto';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { AdSpendDaily } from '../models/index.js';

function randomNonce() {
  return crypto.randomBytes(16).toString('hex').slice(0, 32);
}

function parseCostFen(row) {
  const field = env.tencentAds.spendSyncCostField || 'cost';
  const v = row[field] ?? row.cost ?? row.stat_cost ?? 0;
  return Number(v) || 0;
}

function formatTencentApiError(json) {
  const code = json?.code;
  const cn = json?.message_cn || json?.message || '';
  const trace = json?.trace_id ? ` trace_id=${json.trace_id}` : '';
  return `[腾讯广告 ${code}] ${cn}${trace}`.trim();
}

/**
 * @param {Record<string, string>} extra
 */
async function callDailyReportsGet(extra) {
  const base = env.tencentAds.spendSyncBaseUrl.replace(/\/$/, '');
  const path = env.tencentAds.spendSyncPath.startsWith('/')
    ? env.tencentAds.spendSyncPath
    : `/${env.tencentAds.spendSyncPath}`;
  const qs = new URLSearchParams({
    access_token: env.tencentAds.accessToken,
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: randomNonce(),
    ...extra,
  });
  const url = `${base}${path}?${qs.toString()}`;

  let res;
  try {
    res = await fetch(url, { method: 'GET' });
  } catch (e) {
    throw new HttpError(502, `腾讯广告报表网络错误: ${e instanceof Error ? e.message : String(e)}`, 502);
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new HttpError(
      502,
      `腾讯广告报表非 JSON（HTTP ${res.status}）: ${text.slice(0, 240)}`,
      502,
    );
  }

  if (json.code !== 0) {
    throw new HttpError(502, formatTencentApiError(json), 502, {
      tencent_code: json.code,
      tencent_message_cn: json.message_cn,
      tencent_message: json.message,
      tencent_trace_id: json.trace_id,
    });
  }
  return json.data || {};
}

/** GET 超长时改用 POST（application/x-www-form-urlencoded） */
async function callDailyReportsPost(extra) {
  const base = env.tencentAds.spendSyncBaseUrl.replace(/\/$/, '');
  const path = env.tencentAds.spendSyncPath.startsWith('/')
    ? env.tencentAds.spendSyncPath
    : `/${env.tencentAds.spendSyncPath}`;
  const url = `${base}${path}`;
  const form = new URLSearchParams({
    access_token: env.tencentAds.accessToken,
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: randomNonce(),
    ...extra,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: form.toString(),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new HttpError(502, `腾讯广告报表 POST 非 JSON（HTTP ${res.status}）: ${text.slice(0, 240)}`, 502);
  }
  if (json.code !== 0) {
    throw new HttpError(502, formatTencentApiError(json), 502, {
      tencent_code: json.code,
      tencent_message_cn: json.message_cn,
      tencent_message: json.message,
      tencent_trace_id: json.trace_id,
    });
  }
  return json.data || {};
}

async function callDailyReports(extra) {
  const base = env.tencentAds.spendSyncBaseUrl.replace(/\/$/, '');
  const path = env.tencentAds.spendSyncPath.startsWith('/')
    ? env.tencentAds.spendSyncPath
    : `/${env.tencentAds.spendSyncPath}`;
  const probe = new URLSearchParams({
    access_token: env.tencentAds.accessToken,
    timestamp: String(Math.floor(Date.now() / 1000)),
    nonce: randomNonce(),
    ...extra,
  });
  if (`${base}${path}?${probe}`.length > 7500) {
    return callDailyReportsPost(extra);
  }
  return callDailyReportsGet(extra);
}

function fieldsAdvertiser(mode) {
  if (mode === 'minimal') return JSON.stringify(['date', 'cost']);
  return JSON.stringify(['date', 'cost', 'impression', 'click']);
}

function fieldsCampaign(mode, withName) {
  const base = withName
    ? ['date', 'campaign_id', 'campaign_name', 'cost', 'impression', 'click']
    : ['date', 'campaign_id', 'cost', 'impression', 'click'];
  if (mode === 'minimal') {
    return JSON.stringify(withName ? ['date', 'campaign_id', 'campaign_name', 'cost'] : ['date', 'campaign_id', 'cost']);
  }
  return JSON.stringify(base);
}

/**
 * @typedef {{
 *   label: string;
 *   adq: boolean;
 *   fieldsMode: 'full'|'minimal';
 *   campaignName?: boolean;
 *   level?: string;
 * }} SpendSyncStrategy
 */

/** @returns {SpendSyncStrategy[]} */
function strategiesForAdvertiser() {
  const envAdq = env.tencentAds.spendSyncAdqUpgrade;
  const out = [];
  const push = (s) => {
    if (!out.some((x) => x.label === s.label)) out.push(s);
  };
  push({ label: `adq=${envAdq},fields=full`, adq: envAdq, fieldsMode: 'full' });
  push({ label: `adq=${envAdq},fields=minimal`, adq: envAdq, fieldsMode: 'minimal' });
  push({ label: `adq=${!envAdq},fields=minimal`, adq: !envAdq, fieldsMode: 'minimal' });
  push({ label: `adq=${!envAdq},fields=full`, adq: !envAdq, fieldsMode: 'full' });
  /** 简写 level（与官方示例 level=ADGROUP 同风格），部分账号/网关仅接受短枚举 */
  push({ label: 'level=ADVERTISER,adq=false,min', level: 'ADVERTISER', adq: false, fieldsMode: 'minimal' });
  push({ label: 'level=ADVERTISER,adq=true,min', level: 'ADVERTISER', adq: true, fieldsMode: 'minimal' });
  push({ label: 'level=ADVERTISER,adq=false,full', level: 'ADVERTISER', adq: false, fieldsMode: 'full' });
  push({ label: 'level=ADVERTISER,adq=true,full', level: 'ADVERTISER', adq: true, fieldsMode: 'full' });
  return out;
}

/** @returns {SpendSyncStrategy[]} */
function strategiesForCampaign() {
  const envAdq = env.tencentAds.spendSyncAdqUpgrade;
  const out = [];
  const push = (s) => {
    if (!out.some((x) => x.label === s.label)) out.push(s);
  };
  push({ label: `adq=${envAdq},name=1,full`, adq: envAdq, fieldsMode: 'full', campaignName: true });
  push({ label: `adq=${envAdq},name=0,full`, adq: envAdq, fieldsMode: 'full', campaignName: false });
  push({ label: `adq=${envAdq},name=0,min`, adq: envAdq, fieldsMode: 'minimal', campaignName: false });
  push({ label: `adq=${!envAdq},name=0,min`, adq: !envAdq, fieldsMode: 'minimal', campaignName: false });
  push({ label: `adq=${!envAdq},name=1,full`, adq: !envAdq, fieldsMode: 'full', campaignName: true });
  push({
    label: 'level=CAMPAIGN,adq=false,name=0,min',
    level: 'CAMPAIGN',
    adq: false,
    fieldsMode: 'minimal',
    campaignName: false,
  });
  push({
    label: 'level=CAMPAIGN,adq=true,name=0,min',
    level: 'CAMPAIGN',
    adq: true,
    fieldsMode: 'minimal',
    campaignName: false,
  });
  push({
    label: 'level=CAMPAIGN,adq=false,name=1,full',
    level: 'CAMPAIGN',
    adq: false,
    fieldsMode: 'full',
    campaignName: true,
  });
  push({
    label: 'level=CAMPAIGN,adq=true,name=0,full',
    level: 'CAMPAIGN',
    adq: true,
    fieldsMode: 'full',
    campaignName: false,
  });
  return out;
}

/**
 * @param {SpendSyncStrategy} strat
 * @param {'advertiser'|'campaign'} granularity
 */
function buildPayloadPage({ startDate, endDate, page, pageSize, granularity, strat }) {
  const common = {
    account_id: String(env.tencentAds.accountId),
    date_range: JSON.stringify({ start_date: startDate, end_date: endDate }),
    page: String(page),
    page_size: String(pageSize),
    time_line: 'REPORTING_TIME',
  };

  if (granularity === 'campaign') {
    return {
      ...common,
      level: strat.level || 'REPORT_LEVEL_CAMPAIGN',
      group_by: JSON.stringify(['date', 'campaign_id']),
      fields: fieldsCampaign(strat.fieldsMode, strat.campaignName !== false),
      order_by: JSON.stringify([{ sort_field: 'cost', sort_type: 'DESCENDING' }]),
    };
  }

  return {
    ...common,
    level: strat.level || 'REPORT_LEVEL_ADVERTISER',
    group_by: JSON.stringify(['date']),
    fields: fieldsAdvertiser(strat.fieldsMode),
    order_by: JSON.stringify([{ sort_field: 'date', sort_type: 'ASCENDING' }]),
  };
}

/**
 * @param {SpendSyncStrategy} strat
 */
async function fetchAllRowsForStrategy(startDate, endDate, granularity, strat) {
  const pageSize = 1000;
  const all = [];
  let page = 1;
  let totalPage = 1;

  do {
    const payload = buildPayloadPage({ startDate, endDate, page, pageSize, granularity, strat });
    if (strat.adq) {
      payload.adq_accounts_upgrade_enabled = 'true';
    }
    const data = await callDailyReports(payload);
    const list = Array.isArray(data.list) ? data.list : [];
    all.push(...list);
    const pi = data.page_info || {};
    totalPage = Math.max(1, Number(pi.total_page || 1));
    page += 1;
  } while (page <= totalPage && page < 500);

  return all;
}

async function fetchAllRowsWithFallback(startDate, endDate, granularity) {
  const list = granularity === 'campaign' ? strategiesForCampaign() : strategiesForAdvertiser();
  let lastErr = null;
  for (const strat of list) {
    try {
      const rows = await fetchAllRowsForStrategy(startDate, endDate, granularity, strat);
      return { rows, strategy: strat.label };
    } catch (e) {
      lastErr = e;
      if (!(e instanceof HttpError) || e.status !== 502) {
        throw e;
      }
    }
  }
  throw lastErr || new HttpError(502, '腾讯广告报表全部重试策略失败', 502);
}

/**
 * @param {{ tenantId: number; startDate: string; endDate: string; granularity?: 'advertiser'|'campaign' }} opts
 */
export async function syncTencentSpendToAdSpendTable(opts) {
  const tenantId = Number(opts.tenantId);
  if (!tenantId) throw new HttpError(400, '缺少 tenantId', 400);
  if (!env.tencentAds.accessToken || !env.tencentAds.accountId) {
    throw new HttpError(400, '请配置 TENCENT_ADS_ACCESS_TOKEN 与 TENCENT_ADS_ACCOUNT_ID', 400);
  }

  const startDate = String(opts.startDate || '').trim();
  const endDate = String(opts.endDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    throw new HttpError(400, 'start_date / end_date 须为 YYYY-MM-DD', 400);
  }
  if (dayjs(startDate).isAfter(dayjs(endDate))) {
    throw new HttpError(400, '开始日期不能晚于结束日期', 400);
  }

  const granularity = opts.granularity === 'campaign' ? 'campaign' : 'advertiser';
  const { rows, strategy } = await fetchAllRowsWithFallback(startDate, endDate, granularity);

  let upserted = 0;
  for (const row of rows) {
    const date = String(row.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const costFen = parseCostFen(row);
    const spendCny = costFen / 100;

    let externalCampaignId = '';
    let campaignName = null;
    if (granularity === 'campaign' && row.campaign_id != null && String(row.campaign_id).trim() !== '') {
      externalCampaignId = String(row.campaign_id).trim().slice(0, 128);
      campaignName =
        row.campaign_name != null && String(row.campaign_name).trim() !== ''
          ? String(row.campaign_name).slice(0, 255)
          : null;
    }

    await AdSpendDaily.upsert({
      tenant_id: tenantId,
      stat_date: date,
      platform: 'gdt',
      external_campaign_id: externalCampaignId,
      campaign_name: campaignName,
      spend_cny: spendCny,
      impressions: row.impression != null ? Number(row.impression) : null,
      platform_clicks: row.click != null ? Number(row.click) : null,
      source: 'api',
      meta: {
        provider: 'tencent_marketing_api',
        granularity,
        sync_strategy: strategy,
        account_id: String(env.tencentAds.accountId),
        synced_at: new Date().toISOString(),
      },
    });
    upserted += 1;
  }

  return {
    upserted,
    row_count: rows.length,
    granularity,
    start_date: startDate,
    end_date: endDate,
    sync_strategy: strategy,
  };
}
