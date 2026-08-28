/**
 * @file 客户成交订单控制器。
 * 错误统一交给 asyncHandler + errorHandler 处理：errorHandler 会识别 HttpError
 * 与数据库连接类异常并给出正确的 HTTP 状态码。
 */
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrdersByCustomer,
} from '../services/order.service.js';
import { ok } from '../utils/response.js';

/** 订单列表 */
export async function listOrdersCtrl(req, res) {
  ok(res, await listOrders(req.auth, req.query));
}

/** 订单详情 */
export async function getOrderCtrl(req, res) {
  ok(res, await getOrder(req.auth, req.params.id));
}

/** 创建订单 */
export async function createOrderCtrl(req, res) {
  ok(res, await createOrder(req.auth, req.body), '订单创建成功');
}

/** 更新订单 */
export async function updateOrderCtrl(req, res) {
  ok(res, await updateOrder(req.auth, req.params.id, req.body), '订单更新成功');
}

/** 删除订单 */
export async function deleteOrderCtrl(req, res) {
  ok(res, await deleteOrder(req.auth, req.params.id), '订单已删除');
}

/** 某客户的订单列表（供客户详情页调用） */
export async function getOrdersByCustomerCtrl(req, res) {
  ok(res, { list: await getOrdersByCustomer(req.auth, req.params.customerId) });
}
