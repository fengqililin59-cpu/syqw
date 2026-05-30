/**
 * @file 每日同步 customers/seats 用量到 usage_stats（凌晨 02:00）。
 */
import cron from 'node-cron';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { sequelize, Tenant } from '../models/index.js';

async function syncTenantUsage(tenantId, statMonth) {
  await sequelize.query(
    `INSERT INTO usage_stats
      (tenant_id, stat_month, customers_count)
     VALUES (?, ?, (
       SELECT COUNT(*) FROM customers
       WHERE tenant_id = ? AND deleted_at IS NULL
     ))
     ON DUPLICATE KEY UPDATE
       customers_count = VALUES(customers_count),
       updated_at = NOW()`,
    { replacements: [tenantId, statMonth, tenantId] },
  );

  // users 表当前使用 status 标识启用状态（无 deleted_at）
  await sequelize.query(
    `INSERT INTO usage_stats
      (tenant_id, stat_month, seats_count)
     VALUES (?, ?, (
       SELECT COUNT(*) FROM users
       WHERE tenant_id = ? AND status = 1
     ))
     ON DUPLICATE KEY UPDATE
       seats_count = VALUES(seats_count),
       updated_at = NOW()`,
    { replacements: [tenantId, statMonth, tenantId] },
  );
}

export function registerUsageSyncCron() {
  if (!env.enableUsageSyncCron) {
    console.log('[billing] usage sync cron disabled (set ENABLE_USAGE_SYNC_CRON=1)');
    return;
  }

  cron.schedule('0 2 * * *', async () => {
    const statMonth = dayjs().format('YYYY-MM');
    try {
      const tenants = await Tenant.findAll({ attributes: ['id'] });
      for (const t of tenants) {
        try {
          await syncTenantUsage(Number(t.id), statMonth);
        } catch (e) {
          console.error('[billing] usage sync tenant failed', t.id, e);
        }
      }
      if (tenants.length) console.log('[billing] usage sync done', { tenants: tenants.length, statMonth });
    } catch (e) {
      console.error('[billing] usage sync failed', e);
    }
  });
  console.log('[billing] usage sync cron enabled (02:00 daily)');
}
