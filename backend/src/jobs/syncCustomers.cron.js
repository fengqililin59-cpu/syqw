/**
 * @file 每日凌晨拉取企微客户（多租户，已配置企微凭据的租户才执行）。
 * @description 依赖进程时区；生产环境建议设置 `TZ=Asia/Shanghai`。可用 `ENABLE_SYNC_CRON=0` 关闭。
 */
import cron from 'node-cron';
import { Tenant } from '../models/index.js';
import { env } from '../config/env.js';
import { syncExternalCustomersForTenant } from '../services/wework-sync.service.js';

export function registerSyncCustomersCron() {
  if (!env.enableSyncCustomersCron) {
    console.log('[sync-customers] cron disabled (set ENABLE_SYNC_CRON=0)');
    return;
  }

  cron.schedule('0 2 * * *', async () => {
    const started = new Date().toISOString();
    console.log('[sync-customers] cron start', started);
    const tenants = await Tenant.findAll({
      attributes: ['id', 'wework_corp_id', 'wework_secret'],
    });
    for (const t of tenants) {
      if (!t.wework_corp_id || !t.wework_secret) continue;
      try {
        const r = await syncExternalCustomersForTenant(t.id);
        console.log(`[sync-customers] tenant ${t.id}`, r);
      } catch (e) {
        console.error(`[sync-customers] tenant ${t.id} failed`, e);
      }
    }
  });
}
