/**
 * @file 数据同步：企微客户等（管理员）。
 */
import * as weworkSyncService from '../services/wework-sync.service.js';
import { ok } from '../utils/response.js';

/**
 * POST /sync/customers
 */
export async function syncCustomers(req, res) {
  const data = await weworkSyncService.syncExternalCustomersForTenant(req.auth.tenantId);
  return ok(res, data, '同步完成');
}
