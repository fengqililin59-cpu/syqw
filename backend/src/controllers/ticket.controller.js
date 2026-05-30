/**
 * @file 工单与订单 HTTP 入口。
 */
import * as ticketService from '../services/ticket.service.js';
import { ok } from '../utils/response.js';

export async function listTickets(req, res) {
  const data = await ticketService.listTickets(req.auth, req.query);
  return ok(res, data);
}

export async function listOverdueTickets(req, res) {
  const data = await ticketService.listOverdueTicketsForTenant(req.auth, req.query);
  return ok(res, data);
}

export async function getTicket(req, res) {
  const data = await ticketService.getTicket(req.auth, req.params.id);
  return ok(res, data);
}

export async function createTicket(req, res) {
  const data = await ticketService.createTicket(req.auth, req.body);
  return ok(res, data, '已创建');
}

export async function updateTicket(req, res) {
  const data = await ticketService.updateTicket(req.auth, req.params.id, req.body);
  return ok(res, data, '已更新');
}

export async function resolveTicket(req, res) {
  const data = await ticketService.resolveTicket(req.auth, req.params.id, req.body);
  return ok(res, data, '已结案');
}

export async function listOrders(req, res) {
  const data = await ticketService.listOrders(req.auth, req.query);
  return ok(res, data);
}

export async function createOrder(req, res) {
  const data = await ticketService.createOrder(req.auth, req.body);
  return ok(res, data, '已创建');
}

export async function getOrder(req, res) {
  const data = await ticketService.getOrder(req.auth, req.params.id);
  return ok(res, data);
}

export async function updateOrder(req, res) {
  const data = await ticketService.updateOrder(req.auth, req.params.id, req.body);
  return ok(res, data, '已更新');
}
