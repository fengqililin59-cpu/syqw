/**
 * @file 广告监测公开入口（302 跳转，无需登录）。
 */
import * as adTrackingService from '../services/adTracking.service.js';
import { ok } from '../utils/response.js';

export async function redirect(req, res) {
  const data = await adTrackingService.handleAdRedirect(req);
  return res.redirect(302, data.redirectUrl);
}

export async function conversion(req, res) {
  const data = await adTrackingService.reportConversion(req.body || {});
  return ok(res, data);
}

export async function conversionPlatforms(req, res) {
  return ok(res, adTrackingService.getSupportedConversionPlatforms());
}

/** 公开：根据 ad_hit 生成企微活码 state（用于投流落地页绑定活码） */
export async function weworkState(req, res) {
  const tenantId = Number(req.query.tenant_id || req.query.tenant);
  const adHit = Number(req.query.ad_hit);
  const data = await adTrackingService.getWeworkStateForAdHit({ tenantId, adHit });
  return ok(res, data);
}

export async function roi(req, res) {
  const data = await adTrackingService.getRoiSummary({
    tenantId: req.auth?.tenantId || null,
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
  });
  return ok(res, data);
}

export async function roiTrend(req, res) {
  const data = await adTrackingService.getRoiTrend({
    tenantId: req.auth?.tenantId || null,
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
    platform: String(req.query.platform || 'all'),
  });
  return ok(res, data);
}

export async function roiDetails(req, res) {
  const data = await adTrackingService.getRoiDetails({
    tenantId: req.auth?.tenantId || null,
    startDate: String(req.query.start_date || ''),
    endDate: String(req.query.end_date || ''),
    platform: String(req.query.platform || 'all'),
    limit: Number(req.query.limit || 100),
  });
  return ok(res, data);
}
