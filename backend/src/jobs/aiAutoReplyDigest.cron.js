/**
 * @file 每日 18:00 向租户管理员企微推送「今日 AI 自动回复」摘要。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { sendAiAutoReplyEveningDigestAllTenants } from '../services/aiAutoReplyDigest.service.js';

export function registerAiAutoReplyDigestCron() {
  if (!env.enableAiAutoReplyDigestCron) {
    console.log('[aiAutoReplyDigest] cron disabled (set ENABLE_AI_AUTO_REPLY_DIGEST_CRON=1)');
    return;
  }

  cron.schedule('0 18 * * *', async () => {
    try {
      const r = await sendAiAutoReplyEveningDigestAllTenants();
      if (r.messages > 0) {
        console.log('[aiAutoReplyDigest] evening digest sent', r);
      }
    } catch (e) {
      console.error('[aiAutoReplyDigest] cron failed', e);
    }
  });
  console.log('[aiAutoReplyDigest] cron enabled (daily 18:00, tenants with auto-sent today)');
}
