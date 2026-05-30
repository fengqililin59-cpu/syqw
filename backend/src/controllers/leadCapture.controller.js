/**
 * @file H5 留资公开接口。
 */
import * as leadCaptureService from '../services/leadCapture.service.js';
import { ok } from '../utils/response.js';

export async function submit(req, res) {
  const data = await leadCaptureService.submitPublicLead(
    Number(req.params.tenantId),
    req.body,
    { ip: req.ip, userAgent: req.headers['user-agent'] || null },
  );
  return ok(res, data, data.message);
}
