/**
 * @file 话术库 CRUD（租户隔离 + 软删除）。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { ScriptLibraryItem } from '../models/index.js';

const createSchema = Joi.object({
  category: Joi.string().trim().max(50).allow('', null).optional(),
  title: Joi.string().trim().min(1).max(200).required(),
  body: Joi.string().trim().min(1).max(10000).required(),
  sort_order: Joi.number().integer().min(-99999).max(99999).optional(),
}).unknown(false);

const updateSchema = Joi.object({
  category: Joi.string().trim().max(50).allow('', null).optional(),
  title: Joi.string().trim().min(1).max(200).optional(),
  body: Joi.string().trim().min(1).max(10000).optional(),
  sort_order: Joi.number().integer().min(-99999).max(99999).optional(),
}).unknown(false);

function plain(row) {
  return row.get({ plain: true });
}

export async function listScriptLibraryItems(auth, query = {}) {
  const where = { tenant_id: auth.tenantId, deleted_at: null };
  const category = query.category != null ? String(query.category).trim() : '';
  const keyword = query.keyword != null ? String(query.keyword).trim() : '';
  if (category) where.category = category;
  if (keyword) {
    where[Op.or] = [
      { title: { [Op.like]: `%${keyword}%` } },
      { body: { [Op.like]: `%${keyword}%` } },
    ];
  }
  const rows = await ScriptLibraryItem.findAll({
    where,
    order: [
      ['sort_order', 'DESC'],
      ['id', 'DESC'],
    ],
  });
  return rows.map(plain);
}

export async function listScriptLibraryCategories(auth) {
  const rows = await ScriptLibraryItem.findAll({
    where: {
      tenant_id: auth.tenantId,
      deleted_at: null,
      category: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
    attributes: ['category'],
    raw: true,
  });
  const set = new Set(rows.map((r) => r.category).filter(Boolean));
  return [...set].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
}

export async function createScriptLibraryItem(auth, body) {
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const row = await ScriptLibraryItem.create({
    tenant_id: auth.tenantId,
    category: value.category || 'general',
    title: value.title,
    body: value.body,
    sort_order: value.sort_order ?? 0,
    created_by: auth.userId,
  });
  return plain(row);
}

export async function updateScriptLibraryItem(auth, id, body) {
  const { error, value } = updateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const row = await ScriptLibraryItem.findOne({
    where: { id, tenant_id: auth.tenantId, deleted_at: null },
  });
  if (!row) throw new HttpError(404, '话术不存在', 404);

  if (value.category !== undefined) row.category = value.category || 'general';
  if (value.title !== undefined) row.title = value.title;
  if (value.body !== undefined) row.body = value.body;
  if (value.sort_order !== undefined) row.sort_order = value.sort_order;
  await row.save();
  return plain(row);
}

export async function deleteScriptLibraryItem(auth, id) {
  const row = await ScriptLibraryItem.findOne({
    where: { id, tenant_id: auth.tenantId, deleted_at: null },
  });
  if (!row) throw new HttpError(404, '话术不存在', 404);

  row.deleted_at = new Date();
  await row.save();
  return { id: Number(id) };
}
