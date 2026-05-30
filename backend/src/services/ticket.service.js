/**
 * @file 服务工单 + 客户订单。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import {
  ServiceTicket,
  CustomerOrder,
  Customer,
  User,
  InboxThread,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { paginated } from '../utils/response.js';
import { isAdmin, customerWhereScope } from '../utils/permissions.js';
import {
  maybePromoteCustomerOnRevenueOrder,
  isRevenueOrderStatus,
} from './orderRevenue.service.js';
import { computeTicketDueAt, enrichTicketSla, TICKET_OPEN_STATUSES } from '../utils/ticketSla.util.js';

const TICKET_TYPES = ['consultation', 'refund', 'complaint', 'warranty', 'exchange'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'];
const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'];

const createTicketSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  order_id: Joi.number().integer().positive().allow(null).optional(),
  thread_id: Joi.number().integer().positive().allow(null).optional(),
  type: Joi.string()
    .valid(...TICKET_TYPES)
    .default('consultation'),
  priority: Joi.string()
    .valid(...PRIORITIES)
    .default('normal'),
  title: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(10000).allow('', null).optional(),
  owner_id: Joi.number().integer().positive().optional(),
}).unknown(false);

const updateTicketSchema = Joi.object({
  type: Joi.string()
    .valid(...TICKET_TYPES)
    .optional(),
  priority: Joi.string()
    .valid(...PRIORITIES)
    .optional(),
  status: Joi.string()
    .valid(...TICKET_STATUSES)
    .optional(),
  title: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(10000).allow('', null).optional(),
  resolution: Joi.string().trim().max(10000).allow('', null).optional(),
  owner_id: Joi.number().integer().positive().allow(null).optional(),
}).unknown(false);

const createOrderSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  order_no: Joi.string().trim().max(64).allow('', null).optional(),
  amount: Joi.number().min(0).required(),
  currency: Joi.string().trim().max(8).default('CNY'),
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .default('paid'),
  paid_at: Joi.date().allow(null).optional(),
  remark: Joi.string().trim().max(500).allow('', null).optional(),
}).unknown(false);

const updateOrderSchema = Joi.object({
  order_no: Joi.string().trim().max(64).allow('', null).optional(),
  amount: Joi.number().min(0).optional(),
  currency: Joi.string().trim().max(8).optional(),
  status: Joi.string()
    .valid(...ORDER_STATUSES)
    .optional(),
  paid_at: Joi.date().allow(null).optional(),
  remark: Joi.string().trim().max(500).allow('', null).optional(),
}).unknown(false);

async function loadOrderPlain(auth, id) {
  const row = await CustomerOrder.findOne({
    where: { id, tenant_id: auth.tenantId },
    include: [{ model: Customer, attributes: ['id', 'name', 'nickname', 'phone', 'stage'] }],
  });
  if (!row) {
    throw new HttpError(404, '订单不存在', 404);
  }
  return row.get({ plain: true });
}

async function assertCustomerScope(auth, customerId) {
  const c = await Customer.findOne({
    where: { id: customerId, ...customerWhereScope(auth) },
  });
  if (!c) {
    throw new HttpError(404, '客户不存在或无权操作', 404);
  }
  return c;
}

function mapTicketPlain(row) {
  return enrichTicketSla(row.get ? row.get({ plain: true }) : row);
}

export async function listTickets(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: auth.tenantId };
  if (query.status) where.status = String(query.status);
  if (query.type) where.type = String(query.type);
  if (query.priority) where.priority = String(query.priority);
  if (!isAdmin(auth) && query.mine === '1') {
    where.owner_id = auth.userId;
  }
  if (query.customer_id) {
    where.customer_id = Number(query.customer_id);
  }
  if (query.sla === 'overdue') {
    where.status = { [Op.in]: TICKET_OPEN_STATUSES };
    where.due_at = { [Op.ne]: null, [Op.lte]: new Date() };
    if (!isAdmin(auth)) where.owner_id = auth.userId;
  }

  const order =
    query.sla === 'overdue'
      ? [
          ['due_at', 'ASC'],
          ['priority', 'DESC'],
        ]
      : [
          ['priority', 'DESC'],
          ['updated_at', 'DESC'],
        ];

  const { rows, count } = await ServiceTicket.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order,
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone'] },
      { model: User, as: 'owner', attributes: ['id', 'username', 'real_name'] },
      { model: CustomerOrder, attributes: ['id', 'order_no', 'amount', 'status'] },
    ],
  });
  return paginated(rows.map((r) => mapTicketPlain(r)), count, page, size);
}

export async function getTicket(auth, id) {
  const row = await ServiceTicket.findOne({
    where: { id, tenant_id: auth.tenantId },
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone', 'stage'] },
      { model: User, as: 'owner', attributes: ['id', 'username', 'real_name'] },
      { model: CustomerOrder },
      { model: InboxThread, attributes: ['id', 'status', 'sales_stage'] },
    ],
  });
  if (!row) {
    throw new HttpError(404, '工单不存在', 404);
  }
  return mapTicketPlain(row);
}

export async function createTicket(auth, body) {
  const { error, value } = createTicketSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  await assertCustomerScope(auth, value.customer_id);

  if (value.thread_id) {
    const th = await InboxThread.findOne({
      where: { id: value.thread_id, tenant_id: auth.tenantId },
    });
    if (!th) {
      throw new HttpError(404, '会话不存在', 404);
    }
  }

  const now = new Date();
  const row = await ServiceTicket.create({
    tenant_id: auth.tenantId,
    customer_id: value.customer_id,
    order_id: value.order_id ?? null,
    thread_id: value.thread_id ?? null,
    type: value.type,
    priority: value.priority,
    status: 'open',
    title: value.title,
    description: value.description ?? null,
    owner_id: value.owner_id ?? auth.userId,
    created_by: auth.userId,
    due_at: computeTicketDueAt(value.priority, now),
  });

  if (value.thread_id && ['complaint', 'refund'].includes(value.type)) {
    await InboxThread.update(
      { status: 'pending_human' },
      { where: { id: value.thread_id, tenant_id: auth.tenantId } },
    );
  }

  return getTicket(auth, row.id);
}

export async function createTicketFromThread(auth, threadId, body) {
  const th = await InboxThread.findOne({
    where: { id: threadId, tenant_id: auth.tenantId },
  });
  if (!th) {
    throw new HttpError(404, '会话不存在', 404);
  }
  if (!th.customer_id) {
    throw new HttpError(400, '会话未关联客户，无法创建工单', 400);
  }
  return createTicket(auth, {
    customer_id: th.customer_id,
    thread_id: threadId,
    owner_id: th.assignee_id ?? auth.userId,
    title: body.title,
    description: body.description,
    type: body.type ?? 'consultation',
    priority: body.priority ?? 'normal',
    order_id: body.order_id,
  });
}

export async function updateTicket(auth, id, body) {
  const { error, value } = updateTicketSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const row = await ServiceTicket.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '工单不存在', 404);
  }
  const patch = { ...value };
  if (patch.priority && patch.priority !== row.priority) {
    patch.due_at = computeTicketDueAt(patch.priority, new Date());
    patch.sla_escalated_at = null;
  }
  if (
    patch.status &&
    patch.status !== 'open' &&
    row.status === 'open' &&
    !row.first_response_at
  ) {
    patch.first_response_at = new Date();
  }
  if (patch.status === 'resolved' || patch.status === 'closed') {
    patch.resolved_at = patch.resolved_at ?? new Date();
  }
  await row.update(patch);
  return getTicket(auth, id);
}

export async function resolveTicket(auth, id, body) {
  const resolution = body?.resolution ? String(body.resolution).trim() : '';
  return updateTicket(auth, id, {
    status: 'resolved',
    resolution: resolution || '已处理',
  });
}

export async function listOrders(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: auth.tenantId };
  if (query.status) where.status = String(query.status);
  if (query.customer_id) where.customer_id = Number(query.customer_id);

  const { rows, count } = await CustomerOrder.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['created_at', 'DESC']],
    include: [{ model: Customer, attributes: ['id', 'name', 'nickname', 'phone'] }],
  });
  return paginated(rows.map((r) => r.get({ plain: true })), count, page, size);
}

export async function getOrder(auth, id) {
  return loadOrderPlain(auth, id);
}

export async function createOrder(auth, body) {
  const { error, value } = createOrderSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  await assertCustomerScope(auth, value.customer_id);

  const row = await CustomerOrder.create({
    tenant_id: auth.tenantId,
    customer_id: value.customer_id,
    order_no: value.order_no || null,
    amount: value.amount,
    currency: value.currency || 'CNY',
    status: value.status,
    paid_at: value.paid_at ?? (value.status === 'paid' ? new Date() : null),
    remark: value.remark ?? null,
    created_by: auth.userId,
  });

  if (isRevenueOrderStatus(value.status)) {
    await maybePromoteCustomerOnRevenueOrder(auth.tenantId, value.customer_id);
  }

  return loadOrderPlain(auth, row.id);
}

export async function updateOrder(auth, id, body) {
  const { error, value } = updateOrderSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const row = await CustomerOrder.findOne({ where: { id, tenant_id: auth.tenantId } });
  if (!row) {
    throw new HttpError(404, '订单不存在', 404);
  }

  const prevStatus = String(row.status || '');
  const patch = { ...value };

  if (patch.status && isRevenueOrderStatus(patch.status) && !row.paid_at && patch.paid_at === undefined) {
    patch.paid_at = new Date();
  }
  if (patch.paid_at === null && patch.status && !isRevenueOrderStatus(patch.status)) {
    patch.paid_at = null;
  }

  await row.update(patch);

  const nextStatus = String(row.status || '');
  if (isRevenueOrderStatus(nextStatus) && !isRevenueOrderStatus(prevStatus)) {
    await maybePromoteCustomerOnRevenueOrder(auth.tenantId, row.customer_id);
  }

  return loadOrderPlain(auth, id);
}

export async function countOpenTickets(tenantId) {
  return ServiceTicket.count({
    where: {
      tenant_id: tenantId,
      status: { [Op.in]: TICKET_OPEN_STATUSES },
    },
  });
}

export { listOverdueTicketsForTenant, countOverdueTicketsForTenant } from './ticketSlaReminder.service.js';
