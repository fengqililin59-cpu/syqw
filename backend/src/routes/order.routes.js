/**
 * @file 客户成交订单路由。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  listOrdersCtrl,
  getOrderCtrl,
  createOrderCtrl,
  updateOrderCtrl,
  deleteOrderCtrl,
  getOrdersByCustomerCtrl,
} from '../controllers/order.controller.js';

const router = Router();

router.use(requireAuth);

// 某客户的订单列表（必须在 /:id 之前）
router.get(
  '/by-customer/:customerId',
  requirePerm('customer:view'),
  asyncHandler(getOrdersByCustomerCtrl),
);

// 订单列表
router.get('/', requirePerm('customer:view'), asyncHandler(listOrdersCtrl));

// 订单详情
router.get('/:id', requirePerm('customer:view'), asyncHandler(getOrderCtrl));

// 创建订单
router.post('/', requirePerm('customer:edit'), asyncHandler(createOrderCtrl));

// 更新订单
router.put('/:id', requirePerm('customer:edit'), asyncHandler(updateOrderCtrl));

// 删除订单
router.delete('/:id', requirePerm('customer:delete'), asyncHandler(deleteOrderCtrl));

export default router;
