/**
 * @file 每日 08:30 平台运营摘要（渠道由 PLATFORM_OPS_DIGEST_DELIVERY 控制）。
 */
import cron from 'node-cron';
import { sendPlatformOpsDigestCron } from '../services/platformOpsDigest.service.js';

export function registerPlatformOpsDigestCron() {
  if (process.env.ENABLE_PLATFORM_OPS_DIGEST_CRON !== '1') {
    console.log('[platformDigest] cron disabled (set ENABLE_PLATFORM_OPS_DIGEST_CRON=1)');
    return;
  }

  cron.schedule('30 8 * * *', async () => {
    try {
      const r = await sendPlatformOpsDigestCron();
      console.log('[platformDigest] daily digest', r);
    } catch (e) {
      console.error('[platformDigest] cron failed', e);
    }
  });
  console.log('[platformDigest] cron enabled (daily 08:30)');
}
