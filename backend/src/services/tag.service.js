/**
 * @file 客户标签 CRUD（租户隔离）。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { Tag } from '../models/index.js';

const createSchema = Joi.object({
  name: Joi.string().trim().min(1).max(50).required(),
  color: Joi.string().trim().max(20).allow('', null).optional(),
  category: Joi.string().trim().max(50).allow('', null).optional(),
}).unknown(false);

const updateSchema = Joi.object({
  name: Joi.string().trim().min(1).max(50).optional(),
  color: Joi.string().trim().max(20).allow('', null).optional(),
  category: Joi.string().trim().max(50).allow('', null).optional(),
}).unknown(false);

export async function listTags(auth, query = {}) {
  const where = { tenant_id: auth.tenantId };
  const cat = query.category != null ? String(query.category).trim() : '';
  if (cat) {
    where.category = cat;
  }
  const rows = await Tag.findAll({
    where,
    order: [['id', 'ASC']],
  });
  return rows.map((r) => r.get({ plain: true }));
}

/** 当前租户下已出现的标签分类（去重、排序） */
export async function listTagCategories(auth) {
  const rows = await Tag.findAll({
    where: {
      tenant_id: auth.tenantId,
      category: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
    attributes: ['category'],
    raw: true,
  });
  const set = new Set(rows.map((r) => r.category).filter(Boolean));
  return [...set].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
}

export async function createTag(auth, body) {
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const dup = await Tag.findOne({
    where: { tenant_id: auth.tenantId, name: value.name },
  });
  if (dup) {
    throw new HttpError(400, '同企业下已存在该标签名称', 400);
  }
  const row = await Tag.create({
    tenant_id: auth.tenantId,
    name: value.name,
    color: value.color ?? null,
    category: value.category ?? null,
    created_by: auth.userId,
  });
  return row.get({ plain: true });
}

export async function updateTag(auth, id, body) {
  const { error, value } = updateSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const row = await Tag.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '标签不存在', 404);
  }
  if (value.name !== undefined) {
    if (value.name !== row.name) {
      const dup = await Tag.findOne({
        where: {
          tenant_id: auth.tenantId,
          name: value.name,
          id: { [Op.ne]: row.id },
        },
      });
      if (dup) {
        throw new HttpError(400, '同企业下已存在该标签名称', 400);
      }
    }
    row.name = value.name;
  }
  if (value.color !== undefined) row.color = value.color;
  if (value.category !== undefined) row.category = value.category;
  await row.save();
  return row.get({ plain: true });
}

export async function deleteTag(auth, id) {
  const row = await Tag.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '标签不存在', 404);
  }
  await row.destroy();
  return { id: Number(id) };
}
