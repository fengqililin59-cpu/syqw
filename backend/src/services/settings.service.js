/**
 * @file 租户设置（企微等）：管理员操作。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { Tenant, AuditLog, User } from '../models/index.js';
import { isAdmin } from '../utils/permissions.js';
import { clearAccessTokenCache } from '../services/wework.service.js';

const updateWeworkSchema = Joi.object({
  wework_corp_id: Joi.string().max(64).allow('', null).optional(),
  wework_agent_id: Joi.string().max(64).allow('', null).optional(),
  wework_secret: Joi.string().max(255).allow('', null).optional(),
  wework_token: Joi.alternatives().try(Joi.string().max(64), Joi.valid(null)).optional(),
  wework_encoding_aes_key: Joi.string().max(86).allow('', null).optional(),
  allow_auto_send: Joi.boolean().optional(),
}).unknown(false);

const listAuditLogsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(200).default(20),
  action: Joi.string().trim().max(64).allow('', null).optional(),
  target_type: Joi.string().trim().max(32).allow('', null).optional(),
  actor_user_id: Joi.number().integer().positive().optional(),
  start_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow('', null)
    .optional(),
  end_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow('', null)
    .optional(),
}).unknown(false);

export async function getWeworkSettings(auth) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }

  const tenant = await Tenant.findByPk(auth.tenantId);
  if (!tenant) {
    throw new HttpError(404, '租户不存在', 404);
  }

  return {
    wework_corp_id: tenant.wework_corp_id,
    wework_agent_id: tenant.wework_agent_id,
    wework_secret_set: Boolean(tenant.wework_secret),
    wework_token: tenant.wework_token ?? null,
    wework_encoding_aes_key_set: Boolean(tenant.wework_encoding_aes_key),
    allow_auto_send: Boolean(tenant.allow_auto_send),
  };
}

export async function updateWeworkSettings(auth, body) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }

  const { error, value } = updateWeworkSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const tenant = await Tenant.findByPk(auth.tenantId);
  if (!tenant) {
    throw new HttpError(404, '租户不存在', 404);
  }

  const updateData = {};
  if (value.wework_corp_id !== undefined) {
    updateData.wework_corp_id = value.wework_corp_id || null;
  }
  if (value.wework_agent_id !== undefined) {
    updateData.wework_agent_id = value.wework_agent_id || null;
  }
  if (value.wework_secret !== undefined && value.wework_secret !== '') {
    updateData.wework_secret = value.wework_secret;
  }
  if (value.wework_token !== undefined) {
    updateData.wework_token = value.wework_token || null;
  }
  if (value.wework_encoding_aes_key !== undefined && value.wework_encoding_aes_key !== '') {
    updateData.wework_encoding_aes_key = value.wework_encoding_aes_key.trim();
  }
  if (value.allow_auto_send !== undefined) {
    updateData.allow_auto_send = Boolean(value.allow_auto_send);
  }

  await tenant.update(updateData);
  await clearAccessTokenCache(Number(tenant.id));

  await tenant.reload();
  return {
    wework_corp_id: tenant.wework_corp_id,
    wework_agent_id: tenant.wework_agent_id,
    wework_secret_set: Boolean(tenant.wework_secret),
    wework_token: tenant.wework_token ?? null,
    wework_encoding_aes_key_set: Boolean(tenant.wework_encoding_aes_key),
    allow_auto_send: Boolean(tenant.allow_auto_send),
  };
}

export async function listAuditLogs(auth, query) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const { error, value } = listAuditLogsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const where = { tenant_id: auth.tenantId };
  if (value.action) where.action = value.action;
  if (value.target_type) where.target_type = value.target_type;
  if (value.actor_user_id) where.actor_user_id = Number(value.actor_user_id);
  if (value.start_date || value.end_date) {
    const s = value.start_date || '1970-01-01';
    const e = value.end_date || '2999-12-31';
    where.created_at = { [Op.between]: [new Date(`${s}T00:00:00+08:00`), new Date(`${e}T23:59:59+08:00`)] };
  }

  const page = Number(value.page);
  const size = Number(value.size);
  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'username', 'real_name'], required: false }],
    order: [['id', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  return {
    list: rows.map((r) => r.get({ plain: true })),
    total: count,
    page,
    size,
  };
}
