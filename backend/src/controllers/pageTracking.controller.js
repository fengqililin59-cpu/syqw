/**
 * @file 落地页追踪控制器（公开接口）。
 */
import * as pageTrackingService from '../services/pageTracking.service.js';
import { ok } from '../utils/response.js';

export async function visit(req, res) {
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '';
  const userAgent = req.headers['user-agent'] || '';
  const data = await pageTrackingService.trackVisit(req.body, { ip: String(ip), userAgent: String(userAgent) });
  return ok(res, data, 'ok');
}

export async function report(req, res) {
  const data = await pageTrackingService.getChannelReport({
    tenantId: req.auth.tenantId,
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
  });
  return ok(res, data);
}

export async function reportDetails(req, res) {
  const data = await pageTrackingService.getChannelSourceDetails({
    tenantId: req.auth.tenantId,
    source: String(req.query.source || ''),
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
    limit: Number(req.query.limit || 50),
  });
  return ok(res, data);
}
