/**
 * @file 统一营销事件：埋点上报、服务端补写、管理端漏斗统计。
 */
import Joi from 'joi';
import { Op, fn, col } from 'sequelize';
import { QueryTypes } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { MarketingEvent, AdClickRecord, Tenant, Customer, sequelize } from '../models/index.js';
import * as pageTrackingService from './pageTracking.service.js';

/** 推荐事件名（文档/校验提示）；也允许 custom_* 扩展 */
export const MARKETING_EVENT_TAXONOMY = [
  { key: 'ad_landing', category: 'acquisition', desc: '带 ad_hit 的广告落地' },
  { key: 'landing_view', category: 'acquisition', desc: '营销落地页浏览' },
  { key: 'landing_cta_click', category: 'acquisition', desc: '落地页 CTA 点击' },
  { key: 'lead_form_view', category: 'acquisition', desc: 'H5 留资页浏览' },
  { key: 'registration_complete', category: 'activation', desc: '注册完成' },
  { key: 'login_success', category: 'activation', desc: '登录成功' },
  { key: 'lead_submit', category: 'activation', desc: '留资/表单提交' },
  { key: 'purchase_complete', category: 'revenue', desc: '成交/付费（业务自定义 properties）' },
  { key: 'ad_conversion', category: 'activation', desc: '广告转化记录入库（服务端）' },
];

export const FUNNEL_EVENT_LABELS = {
  landing_view: '落地页浏览',
  landing_cta_click: 'CTA 点击',
  landing_lead_click: '留资按钮点击',
  landing_demo_click: '演示入口点击',
  lead_form_view: '留资页浏览',
  lead_submit: '留资提交',
  ad_landing: '广告落地',
  registration_complete: '注册完成',
  login_success: '登录成功',
};

const FUNNEL_KEYS = [
  'landing_view',
  'landing_cta_click',
  'landing_lead_click',
  'lead_form_view',
  'lead_submit',
  'ad_landing',
  'registration_complete',
];

const eventKeySchema = Joi.string()
  .trim()
  .pattern(/^(?:[a-z][a-z0-9_]{1,62}|custom_[a-z0-9_]{1,48})$/)
  .required();

const propertiesSchema = Joi.object()
  .pattern(
    Joi.string().max(64),
    Joi.alternatives().try(Joi.string().max(2000), Joi.number(), Joi.boolean(), Joi.allow(null)),
  )
  .max(40);

const ingestSchema = Joi.object({
  event_key: eventKeySchema,
  properties: propertiesSchema.optional(),
  session_id: Joi.string().trim().hex().min(16).max(64).optional(),
  ad_hit: Joi.number().integer().positive().optional(),
  tenant_id: Joi.number().integer().positive().optional(),
});

function parseDateRange(startDate, endDate) {
  const parse = (s) => {
    if (!s || typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const t = new Date(`${s}T00:00:00+08:00`);
    return Number.isNaN(t.getTime()) ? null : t;
  };
  const sd = parse(startDate);
  const ed = parse(endDate);
  return { sd, ed };
}

/**
 * @param {object} payload
 * @param {{ ip?: string; userAgent?: string }} reqMeta
 */
export async function ingestMarketingEvent(payload, reqMeta) {
  const { error, value } = ingestSchema.validate(payload || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  let tenantId = value.tenant_id != null ? Number(value.tenant_id) : null;
  if (tenantId) {
    const t = await Tenant.findByPk(tenantId);
    if (!t) tenantId = null;
  }

  let adHit = value.ad_hit != null ? Number(value.ad_hit) : null;
  if (adHit) {
    const click = await AdClickRecord.findByPk(adHit);
    if (!click) throw new HttpError(400, 'ad_hit 不存在', 400);
    if (click.tenant_id && !tenantId) tenantId = Number(click.tenant_id);
  }

  const row = await MarketingEvent.create({
    tenant_id: tenantId,
    user_id: null,
    session_id: value.session_id || null,
    ad_hit: adHit,
    event_key: value.event_key,
    properties: value.properties || null,
    source: 'web',
    ip: (reqMeta?.ip || '').slice(0, 45) || null,
    user_agent: (reqMeta?.userAgent || '').slice(0, 512) || null,
  });

  return { id: Number(row.id) };
}

export async function bindMarketingEventsToUser(sessionId, tenantId, userId) {
  if (!sessionId) return;
  const normalized = String(sessionId).trim();
  if (!/^[a-f0-9]{16,64}$/i.test(normalized)) return;
  await MarketingEvent.update(
    { tenant_id: Number(tenantId), user_id: Number(userId) },
    { where: { session_id: normalized, user_id: null } },
  );
}

/**
 * @param {object} opts
 */
export async function recordServerMarketingEvent(opts) {
  const {
    tenant_id: tenantId = null,
    user_id: userId = null,
    session_id: sessionId = null,
    ad_hit: adHit = null,
    event_key: eventKey,
    properties = null,
  } = opts || {};
  if (!eventKey || typeof eventKey !== 'string') return null;
  const row = await MarketingEvent.create({
    tenant_id: tenantId != null ? Number(tenantId) : null,
    user_id: userId != null ? Number(userId) : null,
    session_id: sessionId,
    ad_hit: adHit != null ? Number(adHit) : null,
    event_key: String(eventKey).slice(0, 64),
    properties: properties || null,
    source: 'server',
    ip: null,
    user_agent: null,
  });
  return { id: Number(row.id) };
}

export async function getMarketingEventReport({ tenantId, startDate, endDate }) {
  const where = { tenant_id: Number(tenantId) };
  const { sd, ed } = parseDateRange(startDate, endDate);
  if (sd && ed) {
    const end = new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1);
    where.created_at = { [Op.between]: [sd, end] };
  }

  const rows = await MarketingEvent.findAll({
    where,
    attributes: ['event_key', [fn('COUNT', col('id')), 'event_count']],
    group: ['event_key'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw: true,
  });

  return rows.map((r) => ({
    event_key: String(r.event_key || ''),
    count: Number(r.event_count || 0),
    label: FUNNEL_EVENT_LABELS[String(r.event_key || '')] || String(r.event_key || ''),
  }));
}

/**
 * 获客漏斗：营销事件 + 按 utm_source 的留资转化（与渠道访问报表对齐）。
 */
export async function getAcquisitionFunnelReport({ tenantId, startDate, endDate }) {
  const tid = Number(tenantId);
  const { sd, ed } = parseDateRange(startDate, endDate);
  const endDt = sd && ed ? new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1) : null;

  const eventWhere = { tenant_id: tid };
  if (sd && endDt) eventWhere.created_at = { [Op.between]: [sd, endDt] };

  const [eventRows, channelRows] = await Promise.all([
    MarketingEvent.findAll({
      where: eventWhere,
      attributes: ['event_key', [fn('COUNT', col('id')), 'event_count']],
      group: ['event_key'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true,
    }),
    pageTrackingService.getChannelReport({ tenantId: tid, startDate, endDate }),
  ]);

  const event_totals = eventRows.map((r) => ({
    event_key: String(r.event_key || ''),
    count: Number(r.event_count || 0),
    label: FUNNEL_EVENT_LABELS[String(r.event_key || '')] || String(r.event_key || ''),
  }));

  const totalsMap = Object.fromEntries(event_totals.map((e) => [e.event_key, e.count]));

  let sourceEventRows = [];
  let leadCustomerRows = [];
  let recentLeadRows = [];
  if (sd && endDt) {
    [sourceEventRows, leadCustomerRows, recentLeadRows] = await Promise.all([
      sequelize.query(
        `
        SELECT
          COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.utm_source')), ''), '(direct)') AS source,
          event_key,
          COUNT(*) AS cnt
        FROM marketing_events
        WHERE tenant_id = :tid
          AND created_at BETWEEN :start AND :end
          AND event_key IN ('landing_view', 'lead_form_view', 'lead_submit', 'landing_cta_click', 'landing_lead_click')
        GROUP BY source, event_key
        `,
        {
          replacements: { tid, start: sd, end: endDt },
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query(
        `
        SELECT
          COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.utm_source')), ''), '(direct)') AS source,
          SUM(CASE WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.created')) AS UNSIGNED) = 1 THEN 1 ELSE 0 END) AS customers_created,
          SUM(CASE WHEN CAST(JSON_UNQUOTE(JSON_EXTRACT(properties, '$.created')) AS UNSIGNED) = 0 THEN 1 ELSE 0 END) AS customers_existing
        FROM marketing_events
        WHERE tenant_id = :tid
          AND created_at BETWEEN :start AND :end
          AND event_key = 'lead_submit'
        GROUP BY source
        `,
        {
          replacements: { tid, start: sd, end: endDt },
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query(
        `
        SELECT
          me.id AS event_id,
          me.created_at,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(me.properties, '$.customer_id')) AS UNSIGNED) AS customer_id,
          JSON_UNQUOTE(JSON_EXTRACT(me.properties, '$.phone')) AS phone,
          JSON_UNQUOTE(JSON_EXTRACT(me.properties, '$.source')) AS source_label,
          COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(me.properties, '$.utm_source')), ''), '(direct)') AS utm_source,
          CAST(JSON_UNQUOTE(JSON_EXTRACT(me.properties, '$.created')) AS UNSIGNED) AS is_new
        FROM marketing_events me
        WHERE me.tenant_id = :tid
          AND me.created_at BETWEEN :start AND :end
          AND me.event_key = 'lead_submit'
        ORDER BY me.created_at DESC
        LIMIT 20
        `,
        {
          replacements: { tid, start: sd, end: endDt },
          type: QueryTypes.SELECT,
        },
      ),
    ]);
  }

  const sourceMap = new Map();
  const ensureSource = (src) => {
    const key = String(src || '(direct)');
    if (!sourceMap.has(key)) {
      sourceMap.set(key, {
        source: key,
        visits: 0,
        landing_view: 0,
        lead_form_view: 0,
        lead_submit: 0,
        landing_cta_click: 0,
        landing_lead_click: 0,
        customers_created: 0,
        customers_existing: 0,
        lead_rate_percent: null,
      });
    }
    return sourceMap.get(key);
  };

  for (const r of sourceEventRows) {
    const row = ensureSource(r.source);
    const k = String(r.event_key);
    if (k in row) row[k] = Number(r.cnt || 0);
  }

  for (const ch of channelRows) {
    ensureSource(ch.source).visits = Number(ch.visit_count || 0);
  }

  for (const r of leadCustomerRows) {
    const row = ensureSource(r.source);
    row.customers_created = Number(r.customers_created || 0);
    row.customers_existing = Number(r.customers_existing || 0);
  }

  const customerIds = [
    ...new Set(
      recentLeadRows
        .map((r) => Number(r.customer_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  const customerNameMap = new Map();
  if (customerIds.length) {
    const customers = await Customer.findAll({
      where: { tenant_id: tid, id: customerIds },
      attributes: ['id', 'name', 'phone', 'stage'],
      raw: true,
    });
    for (const c of customers) {
      customerNameMap.set(Number(c.id), {
        name: c.name || null,
        phone: c.phone || null,
        stage: c.stage || null,
      });
    }
  }

  const recent_leads = recentLeadRows.map((r) => {
    const customerId = Number(r.customer_id) || null;
    const meta = customerId ? customerNameMap.get(customerId) : null;
    return {
      event_id: Number(r.event_id),
      submitted_at: r.created_at,
      customer_id: customerId,
      customer_name: meta?.name ?? null,
      phone: meta?.phone || r.phone || null,
      source_label: r.source_label || null,
      utm_source: String(r.utm_source || '(direct)'),
      is_new: Number(r.is_new) === 1,
      stage: meta?.stage ?? null,
    };
  });

  const customersCreated = leadCustomerRows.reduce(
    (sum, r) => sum + Number(r.customers_created || 0),
    0,
  );
  const customersExisting = leadCustomerRows.reduce(
    (sum, r) => sum + Number(r.customers_existing || 0),
    0,
  );

  const by_source = [...sourceMap.values()]
    .map((r) => ({
      ...r,
      lead_rate_percent:
        r.landing_view > 0
          ? Math.round((r.lead_submit / r.landing_view) * 1000) / 10
          : r.lead_form_view > 0 && r.lead_submit > 0
            ? Math.round((r.lead_submit / r.lead_form_view) * 1000) / 10
            : null,
    }))
    .sort((a, b) => b.lead_submit - a.lead_submit || b.landing_view - a.landing_view);

  const landingView = totalsMap.landing_view || 0;
  const leadSubmit = totalsMap.lead_submit || 0;
  const leadFormView = totalsMap.lead_form_view || 0;

  return {
    event_totals,
    by_source,
    recent_leads,
    summary: {
      landing_view: landingView,
      lead_form_view: leadFormView,
      lead_submit: leadSubmit,
      customers_created: customersCreated,
      customers_existing: customersExisting,
      lead_to_customer_percent:
        leadSubmit > 0 ? Math.round((customersCreated / leadSubmit) * 1000) / 10 : null,
      landing_to_lead_percent:
        landingView > 0 ? Math.round((leadSubmit / landingView) * 1000) / 10 : null,
      form_to_submit_percent:
        leadFormView > 0 ? Math.round((leadSubmit / leadFormView) * 1000) / 10 : null,
      funnel_steps: FUNNEL_KEYS.filter((k) => (totalsMap[k] || 0) > 0).map((k) => ({
        key: k,
        label: FUNNEL_EVENT_LABELS[k] || k,
        count: totalsMap[k] || 0,
      })),
    },
  };
}
