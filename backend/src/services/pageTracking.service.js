/**
 * @file 落地页访问追踪：记录 UTM，并在注册/登录成功时关联用户。
 */
import crypto from 'crypto';
import Joi from 'joi';
import { Op, fn, col, literal } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { PageVisit, User } from '../models/index.js';
import * as aggRollup from './aggregationRollup.service.js';

const createVisitSchema = Joi.object({
  session_id: Joi.string().trim().min(16).max(64).optional(),
  utm_source: Joi.string().trim().max(100).allow('', null).optional(),
  utm_medium: Joi.string().trim().max(100).allow('', null).optional(),
  utm_campaign: Joi.string().trim().max(100).allow('', null).optional(),
  utm_content: Joi.string().trim().max(100).allow('', null).optional(),
  utm_term: Joi.string().trim().max(100).allow('', null).optional(),
  referrer: Joi.string().trim().max(500).allow('', null).optional(),
  landing_path: Joi.string().trim().max(255).allow('', null).optional(),
});

function randomSessionId() {
  return crypto.randomBytes(16).toString('hex');
}

export async function trackVisit(payload, reqMeta) {
  const { error, value } = createVisitSchema.validate(payload || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const hasUtm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].some((k) => {
    const v = value[k];
    return v != null && String(v).trim() !== '';
  });
  if (!hasUtm) throw new HttpError(400, '至少需提供一个 utm_* 参数', 400);

  const sessionId = value.session_id || randomSessionId();
  const ip = (reqMeta?.ip || '').slice(0, 45) || null;
  const userAgent = (reqMeta?.userAgent || '').slice(0, 512) || null;

  const data = {
    session_id: sessionId,
    utm_source: value.utm_source || null,
    utm_medium: value.utm_medium || null,
    utm_campaign: value.utm_campaign || null,
    utm_content: value.utm_content || null,
    utm_term: value.utm_term || null,
    referrer: value.referrer || null,
    landing_path: value.landing_path || null,
    ip,
    user_agent: userAgent,
  };

  const row = await PageVisit.findOne({ where: { session_id: sessionId } });
  if (!row) {
    await PageVisit.create(data);
  } else {
    await row.update(data);
  }
  return { session_id: sessionId };
}

export async function bindVisitToUser(sessionId, tenantId, userId) {
  if (!sessionId) return;
  const normalized = String(sessionId).trim();
  if (!/^[a-f0-9]{16,64}$/i.test(normalized)) return;
  const row = await PageVisit.findOne({ where: { session_id: normalized } });
  if (!row) return;
  await row.update({
    tenant_id: Number(tenantId),
    user_id: Number(userId),
    attributed_at: new Date(),
  });
}

function parseDateOnly(d) {
  if (!d || typeof d !== 'string') return null;
  const s = d.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = new Date(`${s}T00:00:00+08:00`);
  return Number.isNaN(t.getTime()) ? null : t;
}

function normalizeYmd(s) {
  const t = String(s || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/**
 * 渠道报表（按 utm_source 聚合）。
 */
export async function getChannelReport({ tenantId, startDate, endDate }) {
  const sdStr = normalizeYmd(startDate);
  const edStr = normalizeYmd(endDate);
  if (env.aggregation?.readFromAgg && tenantId && sdStr && edStr) {
    const covers = await aggRollup.channelAggCoversRange(tenantId, sdStr, edStr);
    if (covers) {
      return aggRollup.queryChannelReportFromAgg({
        tenantId,
        startDate: sdStr,
        endDate: edStr,
      });
    }
  }

  const where = { tenant_id: Number(tenantId) };
  const sd = parseDateOnly(startDate);
  const ed = parseDateOnly(endDate);
  if (sd && ed) {
    const end = new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1);
    where.created_at = { [Op.between]: [sd, end] };
  }

  const rows = await PageVisit.findAll({
    where,
    attributes: [
      [fn('COALESCE', col('utm_source'), literal("'(direct)'")), 'source'],
      [fn('COUNT', col('id')), 'visit_count'],
      [fn('COUNT', fn('DISTINCT', col('session_id'))), 'session_count'],
      [fn('COUNT', fn('DISTINCT', col('user_id'))), 'user_count'],
    ],
    group: [fn('COALESCE', col('utm_source'), literal("'(direct)'"))],
    order: [[literal('visit_count'), 'DESC']],
    raw: true,
  });

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

export async function getChannelSourceDetails({ tenantId, source, startDate, endDate, limit = 50 }) {
  const where = { tenant_id: Number(tenantId) };
  if (source === '(direct)') where.utm_source = null;
  else if (source && source.trim()) where.utm_source = source.trim();

  const sd = parseDateOnly(startDate);
  const ed = parseDateOnly(endDate);
  if (sd && ed) {
    const end = new Date(ed.getTime() + 24 * 60 * 60 * 1000 - 1);
    where.created_at = { [Op.between]: [sd, end] };
  }

  const rows = await PageVisit.findAll({
    where: { ...where, user_id: { [Op.ne]: null } },
    attributes: [
      'id',
      'session_id',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'referrer',
      'landing_path',
      'created_at',
      'attributed_at',
    ],
    include: [{ model: User, attributes: ['id', 'tenant_id', 'username', 'real_name'] }],
    order: [['attributed_at', 'DESC']],
    limit: Math.max(1, Math.min(200, Number(limit) || 50)),
  });

  return rows.map((r) => {
    const p = r.get({ plain: true });
    return {
      id: Number(p.id),
      session_id: p.session_id,
      source: p.utm_source || '(direct)',
      utm_medium: p.utm_medium || null,
      utm_campaign: p.utm_campaign || null,
      utm_content: p.utm_content || null,
      utm_term: p.utm_term || null,
      landing_path: p.landing_path || null,
      referrer: p.referrer || null,
      first_visit_at: p.created_at || null,
      attributed_at: p.attributed_at || null,
      user: p.User
        ? {
            id: Number(p.User.id),
            tenant_id: Number(p.User.tenant_id),
            username: p.User.username,
            real_name: p.User.real_name || null,
          }
        : null,
    };
  });
}
