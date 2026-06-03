/**
 * @file 租户公开品牌信息（供 brand.html / JSON-LD，不含密钥）。
 */
import { env } from '../config/env.js';
import { assertPublicTenant } from '../utils/publicTenant.js';

function frontendBase() {
  return String(env.appUrl || env.frontendUrl || '').replace(/\/$/, '') || null;
}

/**
 * @param {number} tenantId
 */
export async function getPublicBranding(tenantId) {
  const tenant = await assertPublicTenant(tenantId);
  const front = frontendBase();
  const origin = front || '';
  const helpCenterUrl = origin
    ? `${origin}/help-center.html?tenant=${tenant.id}`
    : `/help-center.html?tenant=${tenant.id}`;
  const brandPageUrl = origin
    ? `${origin}/brand.html?tenant=${tenant.id}`
    : `/brand.html?tenant=${tenant.id}`;

  return {
    tenant_id: Number(tenant.id),
    name: tenant.name,
    product_name: 'ZhiFlow',
    description: `${tenant.name} 使用 ZhiFlow 进行私域客户运营与增长。`,
    help_center_url: helpCenterUrl,
    brand_page_url: brandPageUrl,
    logo_url: origin ? `${origin}/favicon.ico` : null,
  };
}
