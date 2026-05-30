/**
 * @file 收件箱跟进任务。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { InboxFollowupTask, InboxThread, Customer } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin, customerWhereScope } from '../utils/permissions.js';

const createSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  customer_id: Joi.number().integer().positive().optional(),
  thread_id: Joi.number().integer().positive().optional(),
  due_at: Joi.date().allow(null).optional(),
  owner_id: Joi.number().integer().positive().optional(),
}).unknown(false);

export async function listFollowups(auth, query) {
  const where = { tenant_id: auth.tenantId };
  if (query.status) where.status = String(query.status);
  if (query.thread_id) where.thread_id = Number(query.thread_id);
  if (query.customer_id) where.customer_id = Number(query.customer_id);
  if (!isAdmin(auth) && !query.thread_id && !query.customer_id) {
    where.owner_id = auth.userId;
  }
  const rows = await InboxFollowupTask.findAll({
    where,
    order: [
      ['status', 'ASC'],
      ['due_at', 'ASC'],
      ['id', 'DESC'],
    ],
    limit: Math.min(100, Number(query.limit) || 30),
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone'] },
      { model: InboxThread, attributes: ['id', 'sales_stage', 'status'] },
    ],
  });
  return rows.map((r) => r.get({ plain: true }));
}

export async function createFollowup(auth, body) {
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  if (value.customer_id) {
    const c = await Customer.findOne({
      where: { id: value.customer_id, ...customerWhereScope(auth) },
    });
    if (!c) {
      throw new HttpError(404, '客户不存在或无权操作', 404);
    }
  }
  if (value.thread_id) {
    const t = await InboxThread.findOne({
      where: { id: value.thread_id, tenant_id: auth.tenantId },
    });
    if (!t) {
      throw new HttpError(404, '会话不存在', 404);
    }
    if (!value.customer_id && t.customer_id) {
      value.customer_id = t.customer_id;
    }
  }
  const row = await InboxFollowupTask.create({
    tenant_id: auth.tenantId,
    title: value.title,
    customer_id: value.customer_id ?? null,
    thread_id: value.thread_id ?? null,
    due_at: value.due_at ?? null,
    owner_id: value.owner_id ?? auth.userId,
    status: 'open',
  });
  return row.get({ plain: true });
}

export async function completeFollowup(auth, id) {
  const row = await InboxFollowupTask.findOne({
    where: { id, tenant_id: auth.tenantId },
  });
  if (!row) {
    throw new HttpError(404, '任务不存在', 404);
  }
  if (!isAdmin(auth) && row.owner_id && Number(row.owner_id) !== Number(auth.userId)) {
    throw new HttpError(403, '无权操作', 403);
  }
  await row.update({ status: 'done' });
  return row.get({ plain: true });
}
