/**
 * @file 租户公开品牌接口。
 */
import * as publicTenantService from '../services/publicTenant.service.js';
import { ok } from '../utils/response.js';

export async function branding(req, res) {
  const tenantId = Number(req.params.tenantId);
  if (!Number.isFinite(tenantId) || tenantId <= 0) {
    return res.status(400).json({ code: 400, message: '无效的租户 ID', data: null });
  }
  try {
    const data = await publicTenantService.getPublicBranding(tenantId);
    return ok(res, data);
  } catch (err) {
    const status = err.status === 404 ? 404 : 500;
    return res.status(status).json({ code: status, message: err.message, data: null });
  }
}
