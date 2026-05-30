/**
 * @file 定时从腾讯广告拉取昨日及近几日消耗（单租户，由环境变量指定）。
 * @description 需：TENCENT_ADS_SPEND_SYNC_CRON=1、TENCENT_ADS_SPEND_SYNC_TENANT_ID、TOKEN、ACCOUNT_ID。
 * 建议生产设置 TZ=Asia/Shanghai。
 */
import cron from 'node-cron';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { syncTencentSpendToAdSpendTable } from '../services/tencentAdsSpendSync.service.js';

export function registerTencentAdsSpendSyncCron() {
  if (!env.tencentAds.spendSyncCronEnabled) {
    return;
  }
  if (!env.tencentAds.spendSyncCronTenantId) {
    console.log('[tencent-ads-spend] cron skipped: set TENCENT_ADS_SPEND_SYNC_TENANT_ID');
    return;
  }
  if (!env.tencentAds.accessToken || !env.tencentAds.accountId) {
    console.log('[tencent-ads-spend] cron skipped: missing TENCENT_ADS_ACCESS_TOKEN or ACCOUNT_ID');
    return;
  }

  const gran =
    env.tencentAds.spendSyncGranularity === 'campaign' ? 'campaign' : 'advertiser';

  cron.schedule('30 6 * * *', async () => {
    const endDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const startDate = dayjs().subtract(4, 'day').format('YYYY-MM-DD');
    const started = new Date().toISOString();
    console.log('[tencent-ads-spend] cron start', started, { startDate, endDate, gran });
    try {
      const r = await syncTencentSpendToAdSpendTable({
        tenantId: env.tencentAds.spendSyncCronTenantId,
        startDate,
        endDate,
        granularity: gran,
      });
      console.log('[tencent-ads-spend] cron ok', r);
    } catch (e) {
      console.error('[tencent-ads-spend] cron failed', e);
    }
  });
  console.log('[tencent-ads-spend] cron registered (06:30 daily, last 4 days + yesterday)');
}
