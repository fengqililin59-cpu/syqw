/**
 * @file 统一营销事件：公开上报与管理端报表。
 */
import * as marketingEventService from '../services/marketingEvent.service.js';
import { ok } from '../utils/response.js';

export async function ingest(req, res) {
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const data = await marketingEventService.ingestMarketingEvent(req.body, {
    ip: String(ip),
    userAgent: String(userAgent),
  });
  return ok(res, data, 'ok');
}

export async function report(req, res) {
  const data = await marketingEventService.getMarketingEventReport({
    tenantId: req.auth.tenantId,
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
  });
  return ok(res, data);
}

export async function funnelReport(req, res) {
  const data = await marketingEventService.getAcquisitionFunnelReport({
    tenantId: req.auth.tenantId,
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
  });
  return ok(res, data);
}
