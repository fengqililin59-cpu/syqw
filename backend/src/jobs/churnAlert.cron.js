/**
 * @file 每日 10:00 扫描租户活跃流失风险并企微通知管理员。
 */
import cron from 'node-cron';
import { runChurnAlertsForAllTenants } from '../services/churnRisk.service.js';

export function registerChurnAlertCron() {
  if (process.env.ENABLE_CHURN_ALERT_CRON !== '1') {
    console.log('[churnRisk] churn alert cron disabled (set ENABLE_CHURN_ALERT_CRON=1)');
    return;
  }

  cron.schedule('0 10 * * *', async () => {
    try {
      const r = await runChurnAlertsForAllTenants();
      console.log('[churnRisk] daily scan done', r);
    } catch (e) {
      console.error('[churnRisk] cron failed', e);
    }
  });
  console.log('[churnRisk] churn alert cron enabled (daily 10:00)');
}
