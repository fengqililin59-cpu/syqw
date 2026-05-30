/**
 * @file 广告日消耗：批量导入与查询（成本打通）。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { AdSpendDaily } from '../models/index.js';

const itemSchema = Joi.object({
  stat_date: Joi.string()
    .trim()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  platform: Joi.string().trim().min(1).max(32).required(),
  spend: Joi.number().min(0).max(1e12).required(),
  campaign_id: Joi.string().trim().max(128).allow('', null).optional(),
  campaign_name: Joi.string().trim().max(255).allow('', null).optional(),
  impressions: Joi.number().integer().min(0).max(1e15).allow(null).optional(),
  platform_clicks: Joi.number().integer().min(0).max(1e15).allow(null).optional(),
  meta: Joi.object().optional(),
});

const bulkSchema = Joi.object({
  items: Joi.array().items(itemSchema).min(1).max(500).required(),
});

function parseDateOnly(s) {
  if (!s || typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = new Date(`${s}T00:00:00+08:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

export async function bulkUpsertSpend(auth, body) {
  const { error, value } = bulkSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const tenantId = Number(auth.tenantId);
  for (const it of value.items) {
    const ext = it.campaign_id != null && String(it.campaign_id).trim() !== '' ? String(it.campaign_id).trim() : '';
    await AdSpendDaily.upsert({
      tenant_id: tenantId,
      stat_date: it.stat_date,
      platform: String(it.platform).trim().slice(0, 32),
      external_campaign_id: ext.slice(0, 128),
      campaign_name: it.campaign_name != null ? String(it.campaign_name).slice(0, 255) : null,
      spend_cny: Number(it.spend),
      impressions: it.impressions != null ? Number(it.impressions) : null,
      platform_clicks: it.platform_clicks != null ? Number(it.platform_clicks) : null,
      source: 'manual',
      meta: it.meta || null,
    });
  }
  return { upserted: value.items.length };
}

export async function listSpend({ tenantId, startDate, endDate, platform, limit = 200 }) {
  const where = { tenant_id: Number(tenantId) };
  const sd = parseDateOnly(startDate);
  const ed = parseDateOnly(endDate);
  if (sd && ed) {
    where.stat_date = { [Op.between]: [sd, ed] };
  }
  const p = String(platform || '').trim();
  if (p && p !== 'all') where.platform = p;

  const rows = await AdSpendDaily.findAll({
    where,
    order: [
      ['stat_date', 'DESC'],
      ['platform', 'ASC'],
    ],
    limit: Math.max(1, Math.min(500, Number(limit) || 200)),
    raw: true,
  });

  return rows.map((r) => ({
    id: Number(r.id),
    stat_date: r.stat_date,
    platform: r.platform,
    external_campaign_id: r.external_campaign_id || '',
    campaign_name: r.campaign_name,
    spend_cny: Number(r.spend_cny || 0),
    impressions: r.impressions != null ? Number(r.impressions) : null,
    platform_clicks: r.platform_clicks != null ? Number(r.platform_clicks) : null,
    source: r.source,
    updated_at: r.updated_at,
  }));
}
