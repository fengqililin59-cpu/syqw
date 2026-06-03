/**
 * @file 客户成交订单控制器。
 */
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrdersByCustomer,
} from '../services/order.service.js';
import { ok, fail } from '../utils/response.js';

/** 订单列表 */
export async function listOrdersCtrl(req, res) {
  try {
    const result = await listOrders(req.auth, req.query);
    ok(res, result);
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
}

/** 订单详情 */
export async function getOrderCtrl(req, res) {
  try {
    const result = await getOrder(req.auth, req.params.id);
    ok(res, result);
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
}

/** 创建订单 */
export async function createOrderCtrl(req, res) {
  try {
    const result = await createOrder(req.auth, req.body);
    ok(res, result, '订单创建成功');
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
}

/** 更新订单 */
export async function updateOrderCtrl(req, res) {
  try {
    const result = await updateOrder(req.auth, req.params.id, req.body);
    ok(res, result, '订单更新成功');
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
}

/** 删除订单 */
export async function deleteOrderCtrl(req, res) {
  try {
    const result = await deleteOrder(req.auth, req.params.id);
    ok(res, result, '订单已删除');
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
}

/** 某客户的订单列表（供客户详情页调用） */
export async function getOrdersByCustomerCtrl(req, res) {
  try {
    const result = await getOrdersByCustomer(req.auth, req.params.customerId);
    ok(res, { list: result });
  } catch (err) {
    fail(res, err.message, err.status || 500);
  }
}
