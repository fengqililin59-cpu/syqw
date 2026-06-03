/**
 * @file 客户成交订单 CRUD 与业务联动。
 *
 * 订单状态: pending(待支付) / paid(已支付) / completed(已完成) / refunded(已退款) / cancelled(已取消)
 * 创建/更新订单后自动同步客户 stage → deal，并触发 flow_engine。
 */
import { Op } from 'sequelize';
import { CustomerOrder, Customer, User } from '../models/index.js';
import { customerWhereScope, isAdmin } from '../utils/permissions.js';
import { maybePromoteCustomerOnRevenueOrder } from './orderRevenue.service.js';
import { dispatchStageChangedFlows } from './flowEngine.service.js';
import { syncInboxThreadsFromCustomerStage } from './salesStageSync.service.js';

/** 合法订单状态 */
export const ORDER_STATUSES = ['pending', 'paid', 'completed', 'refunded', 'cancelled'];

/** 视为「已成交」的状态（参与业绩统计） */
export const PAID_STATUSES = ['paid', 'completed'];

function normalizeStatus(s) {
  const v = String(s || 'pending').trim().toLowerCase();
  return ORDER_STATUSES.includes(v) ? v : 'pending';
}

// ── 列表 ────────────────────────────────────────────────────────────────────────

export async function listOrders(auth, query = {}) {
  const {
    page = 1,
    limit = 20,
    keyword,
    status,
    customer_id,
    start_date,
    end_date,
    sort_by = 'created_at',
    sort_order = 'DESC',
  } = query;

  const offset = (Number(page) - 1) * Number(limit);
  const where = { tenant_id: auth.tenantId };

  if (customer_id) where.customer_id = Number(customer_id);
  if (status) where.status = status;
  if (start_date) where.created_at = { [Op.gte]: new Date(start_date) };
  if (end_date) {
    where.created_at = { ...(where.created_at || {}), [Op.lte]: new Date(end_date + ' 23:59:59') };
  }

  // 按客户名称/手机号模糊搜索（跨表）
  let customerIds = [];
  if (keyword) {
    const customers = await Customer.findAll({
      where: {
        tenant_id: auth.tenantId,
        deleted_at: null,
        [Op.or]: [
          { name: { [Op.like]: `%${keyword}%` } },
          { phone: { [Op.like]: `%${keyword}%` } },
          { nickname: { [Op.like]: `%${keyword}%` } },
        ],
      },
      attributes: ['id'],
      raw: true,
    });
    customerIds = customers.map((c) => c.id);
    if (!customerIds.length) {
      return { list: [], total: 0, page: Number(page), limit: Number(limit), totalPages: 0 };
    }
    where.customer_id = { [Op.in]: customerIds };
  }

  const allowedSorts = ['created_at', 'amount', 'paid_at'];
  const orderField = allowedSorts.includes(sort_by) ? sort_by : 'created_at';
  const orderDir = String(sort_order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { rows, count } = await CustomerOrder.findAndCountAll({
    where,
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone'], required: false },
    ],
    order: [[orderField, orderDir]],
    limit: Number(limit),
    offset,
  });

  return {
    list: rows.map((r) => r.toJSON()),
    total: count,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(count / Number(limit)),
  };
}

// ── 详情 ────────────────────────────────────────────────────────────────────────

export async function getOrder(auth, id) {
  const order = await CustomerOrder.findOne({
    where: { id: Number(id), tenant_id: auth.tenantId },
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone', 'stage'], required: false },
    ],
  });
  if (!order) throw Object.assign(new Error('订单不存在'), { status: 404 });
  return order.toJSON();
}

// ── 创建 ────────────────────────────────────────────────────────────────────────

export async function createOrder(auth, body) {
  const { customer_id, order_no, amount, currency, status, paid_at, remark } = body;

  if (!customer_id) throw Object.assign(new Error('客户不能为空'), { status: 400 });
  if (!amount || Number(amount) <= 0) throw Object.assign(new Error('订单金额必须大于0'), { status: 400 });

  // 校验客户存在
  const customer = await Customer.findOne({
    where: { id: Number(customer_id), tenant_id: auth.tenantId, deleted_at: null },
  });
  if (!customer) throw Object.assign(new Error('客户不存在'), { status: 404 });

  const normalizedStatus = normalizeStatus(status);
  const order = await CustomerOrder.create({
    tenant_id: auth.tenantId,
    customer_id: Number(customer_id),
    order_no: order_no || null,
    amount: Number(amount),
    currency: currency || 'CNY',
    status: normalizedStatus,
    paid_at: normalizedStatus === 'paid' || normalizedStatus === 'completed'
      ? (paid_at ? new Date(paid_at) : new Date())
      : (paid_at ? new Date(paid_at) : null),
    remark: remark || null,
    created_by: auth.userId,
  });

  // 如果状态是「已成交」，自动推进客户阶段
  if (PAID_STATUSES.includes(normalizedStatus)) {
    try {
      await maybePromoteCustomerOnRevenueOrder(auth.tenantId, customer_id);
    } catch (err) {
      console.error('[order] auto promote failed', err);
    }
  }

  return getOrder(auth, order.id);
}

// ── 更新 ────────────────────────────────────────────────────────────────────────

export async function updateOrder(auth, id, body) {
  const order = await CustomerOrder.findOne({
    where: { id: Number(id), tenant_id: auth.tenantId },
  });
  if (!order) throw Object.assign(new Error('订单不存在'), { status: 404 });

  const { order_no, amount, currency, status, paid_at, remark } = body;
  const updates = {};

  if (order_no !== undefined) updates.order_no = order_no || null;
  if (amount !== undefined) {
    if (Number(amount) < 0) throw Object.assign(new Error('订单金额不能为负'), { status: 400 });
    updates.amount = Number(amount);
  }
  if (currency !== undefined) updates.currency = currency || 'CNY';
  if (status !== undefined) {
    const newStatus = normalizeStatus(status);
    updates.status = newStatus;
    // 状态变更为「已成交」时自动填 paid_at
    if (PAID_STATUSES.includes(newStatus) && !order.paid_at) {
      updates.paid_at = new Date();
    }
    if (newStatus === 'pending') {
      updates.paid_at = null;
    }
  }
  if (paid_at !== undefined) {
    updates.paid_at = paid_at ? new Date(paid_at) : null;
  }
  if (remark !== undefined) updates.remark = remark || null;

  const prevStatus = order.status;
  await order.update(updates);

  // 状态从非成交 → 成交：触发客户阶段推进
  if (!PAID_STATUSES.includes(prevStatus) && PAID_STATUSES.includes(updates.status || order.status)) {
    try {
      await maybePromoteCustomerOnRevenueOrder(auth.tenantId, order.customer_id);
    } catch (err) {
      console.error('[order] auto promote failed', err);
    }
  }

  return getOrder(auth, order.id);
}

// ── 删除 ────────────────────────────────────────────────────────────────────────

export async function deleteOrder(auth, id) {
  const order = await CustomerOrder.findOne({
    where: { id: Number(id), tenant_id: auth.tenantId },
  });
  if (!order) throw Object.assign(new Error('订单不存在'), { status: 404 });

  await order.destroy();
  return { deleted: true };
}

// ── 客户维度：订单列表（用于客户详情页 Tab） ─────────────────────────────────

export async function getOrdersByCustomer(auth, customerId) {
  const orders = await CustomerOrder.findAll({
    where: { tenant_id: auth.tenantId, customer_id: Number(customerId) },
    order: [['created_at', 'DESC']],
  });
  return orders.map((o) => o.toJSON());
}
