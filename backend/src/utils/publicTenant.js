/**
 * @file 公开接口租户解析（仅 id + name，不暴露密钥）。
 */
import { Tenant } from '../models/index.js';

export function parsePublicTenantId(req) {
  const raw =
    req.query?.tenant ??
    req.query?.tenant_id ??
    req.params?.tenantId ??
    req.params?.id;
  const tid = Number(raw);
  if (!Number.isFinite(tid) || tid <= 0) {
    const err = new Error('缺少有效租户 ID（参数 tenant）');
    err.status = 400;
    throw err;
  }
  return tid;
}

/** @returns {Promise<import('../models/tenant.model.js').Tenant>} */
export async function assertPublicTenant(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'name', 'status'],
  });
  if (!tenant || tenant.status !== 1) {
    const err = new Error('租户不存在或不可用');
    err.status = 404;
    throw err;
  }
  return tenant;
}
