/**
 * @file 服务工单与客户订单。
 */
import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAnyPerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/tickets/overdue',
  requireAnyPerm('ticket:view', 'customer:view'),
  asyncHandler(ticketController.listOverdueTickets),
);
router.get(
  '/tickets',
  requireAnyPerm('ticket:view', 'customer:view'),
  asyncHandler(ticketController.listTickets),
);
router.post(
  '/tickets',
  requireAnyPerm('ticket:manage', 'customer:edit'),
  asyncHandler(ticketController.createTicket),
);
router.get(
  '/tickets/:id',
  requireAnyPerm('ticket:view', 'customer:view'),
  asyncHandler(ticketController.getTicket),
);
router.put(
  '/tickets/:id',
  requireAnyPerm('ticket:manage', 'customer:edit'),
  asyncHandler(ticketController.updateTicket),
);
router.post(
  '/tickets/:id/resolve',
  requireAnyPerm('ticket:manage', 'customer:edit'),
  asyncHandler(ticketController.resolveTicket),
);

router.get(
  '/orders',
  requireAnyPerm('order:view', 'customer:view'),
  asyncHandler(ticketController.listOrders),
);
router.post(
  '/orders',
  requireAnyPerm('order:manage', 'customer:edit'),
  asyncHandler(ticketController.createOrder),
);
router.get(
  '/orders/:id',
  requireAnyPerm('order:view', 'customer:view'),
  asyncHandler(ticketController.getOrder),
);
router.put(
  '/orders/:id',
  requireAnyPerm('order:manage', 'customer:edit'),
  asyncHandler(ticketController.updateOrder),
);

export default router;
