/**
 * @file 客户卡项控制器。
 */
import * as cardService from '../services/customerCard.service.js';
import { ok } from '../utils/response.js';

function ctxOf(req) {
  return {
    userId: req.auth.userId,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || null,
  };
}

export async function listByCustomer(req, res) {
  const data = await cardService.listCustomerCards(req.auth.tenantId, req.params.id, req.query);
  return ok(res, data);
}

export async function detail(req, res) {
  const data = await cardService.getCard(req.auth.tenantId, req.params.id);
  return ok(res, data);
}

export async function create(req, res) {
  const data = await cardService.createCard(req.auth.tenantId, req.body, ctxOf(req));
  return ok(res, data, '开卡成功');
}

export async function consume(req, res) {
  const data = await cardService.consumeCard(req.auth.tenantId, req.params.id, req.body, ctxOf(req));
  return ok(res, data, '核销成功');
}

export async function recharge(req, res) {
  const data = await cardService.rechargeCard(req.auth.tenantId, req.params.id, req.body, ctxOf(req));
  return ok(res, data, '充值成功');
}

export async function adjust(req, res) {
  const data = await cardService.adjustCard(req.auth.tenantId, req.params.id, req.body, ctxOf(req));
  return ok(res, data, '调整已记录');
}

export async function transactions(req, res) {
  const data = await cardService.listTransactions(req.auth.tenantId, req.params.id, req.query);
  return ok(res, data);
}

export async function alerts(req, res) {
  const data = await cardService.listAlerts(req.auth.tenantId, req.query);
  return ok(res, data);
}
