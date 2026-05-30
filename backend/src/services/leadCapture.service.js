/**
 * @file H5 留资表单：公开提交创建线索客户并触发营销事件与新客户流程。
 */
import Joi from 'joi';
import { Customer, Tenant } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { dispatchNewCustomerFlows } from './flowEngine.service.js';
import { recordServerMarketingEvent } from './marketingEvent.service.js';
import { resolveLeadOwnerId, notifyOwnerNewLead } from './leadAssignment.service.js';
import * as billingService from './billing.service.js';

const submitSchema = Joi.object({
  name: Joi.string().trim().max(50).required(),
  phone: Joi.string().trim().max(20).required(),
  company: Joi.string().trim().max(100).allow('', null).optional(),
  remark: Joi.string().trim().max(500).allow('', null).optional(),
  need: Joi.string().trim().max(500).allow('', null).optional(),
  source: Joi.string().trim().max(50).allow('', null).optional(),
  session_id: Joi.string().trim().hex().min(16).max(64).optional(),
  utm_source: Joi.string().trim().max(64).optional(),
  utm_medium: Joi.string().trim().max(64).optional(),
  utm_campaign: Joi.string().trim().max(64).optional(),
  utm_content: Joi.string().trim().max(64).optional(),
  utm_term: Joi.string().trim().max(64).optional(),
  landing_from: Joi.string().trim().max(32).optional(),
  landing_variant: Joi.string().trim().max(8).optional(),
  landing_cta: Joi.string().trim().max(64).optional(),
}).unknown(false);

function buildLeadSource(value) {
  if (value.source?.trim()) return value.source.trim();
  if (value.landing_from === 'landing') {
    const parts = ['落地页留资'];
    if (value.landing_variant) parts.push(`AB:${value.landing_variant}`);
    if (value.utm_source) parts.push(value.utm_source);
    return parts.join('·').slice(0, 50);
  }
  if (value.utm_source) return `H5·${value.utm_source}`.slice(0, 50);
  return 'H5留资';
}

async function resolveDefaultOwnerId(tenantId, value) {
  const resolved = await resolveLeadOwnerId(tenantId, {
    utm_source: value.utm_source,
    channel_key: value.utm_source,
    prefer_wework_follow: false,
  });
  return resolved?.owner_id ?? null;
}

/**
 * @param {number} tenantId
 * @param {object} body
 * @param {{ ip?: string; userAgent?: string }} meta
 */
export async function submitPublicLead(tenantId, body, meta = {}) {
  const { error, value } = submitSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant || tenant.status !== 1) {
    throw new HttpError(404, '企业不存在或已停用', 404);
  }

  const phone = String(value.phone).trim();
  const ownerId = await resolveDefaultOwnerId(tenantId, value);
  if (!ownerId) {
    throw new HttpError(503, '该企业尚未配置员工账号，无法接收留资', 503);
  }

  const sourceLabel = buildLeadSource(value);
  const remarkParts = [value.remark, value.need].filter((x) => x && String(x).trim());
  const remark = remarkParts.length ? remarkParts.join('\n') : null;

  let existing = await Customer.findOne({
    where: { tenant_id: tenantId, phone },
    paranoid: false,
  });
  if (existing?.deleted_at) await existing.restore();

  let created = false;
  let customerId;

  if (existing) {
    customerId = existing.id;
    const patch = {};
    if (value.name && !existing.name) patch.name = value.name;
    if (value.company && !existing.company) patch.company = value.company;
    if (remark) {
      patch.remark = existing.remark ? `${existing.remark}\n[留资] ${remark}` : `[留资] ${remark}`;
    }
    if (Object.keys(patch).length) await existing.update(patch);
  } else {
    const quota = await billingService.checkQuota(tenantId, 'customers');
    if (!quota.allowed) {
      throw new HttpError(402, '客户数量已达套餐上限，请联系企业管理员', 402);
    }

    const row = await Customer.create({
      tenant_id: tenantId,
      owner_id: ownerId,
      name: value.name,
      phone,
      company: value.company ?? null,
      source: sourceLabel,
      stage: 'new',
      remark,
    });
    created = true;
    customerId = row.id;
    billingService.incrementUsage(tenantId, 'customers').catch((err) =>
      console.error('[billing] lead capture increment', err),
    );
    dispatchNewCustomerFlows(tenantId, customerId).catch((err) =>
      console.error('[flow-engine] lead capture dispatch', err),
    );
    notifyOwnerNewLead(tenantId, ownerId, {
      customer_id: customerId,
      name: value.name,
      phone,
      source: sourceLabel,
    }).catch((err) => console.error('[lead-assign] notify', err));
  }

  await recordServerMarketingEvent({
    tenant_id: tenantId,
    session_id: value.session_id ?? null,
    event_key: 'lead_submit',
    properties: {
      customer_id: customerId,
      phone,
      source: sourceLabel,
      utm_source: value.utm_source ?? null,
      utm_medium: value.utm_medium ?? null,
      utm_campaign: value.utm_campaign ?? null,
      landing_from: value.landing_from ?? null,
      landing_variant: value.landing_variant ?? null,
      landing_cta: value.landing_cta ?? null,
      created: created ? 1 : 0,
      ip: meta.ip ?? null,
    },
  });

  return {
    customer_id: customerId,
    created,
    message: created ? '提交成功，顾问将尽快联系您' : '我们已收到您的信息，顾问将尽快联系您',
  };
}
