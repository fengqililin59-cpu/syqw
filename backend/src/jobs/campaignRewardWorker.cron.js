/**
 * @file 裂变奖励队列消费（每分钟）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { processCampaignRewardQueueOnce } from '../services/campaignRewardWorker.service.js';

export function registerCampaignRewardWorkerCron() {
  if (!env.campaignReward.workerCron) {
    console.log('[campaign-reward] cron disabled (set ENABLE_CAMPAIGN_REWARD_CRON=1)');
    return;
  }
  const workerId = `campaign-reward-${process.pid}`;
  cron.schedule('* * * * *', async () => {
    try {
      await processCampaignRewardQueueOnce(workerId, env.campaignReward.workerBatchSize);
    } catch (e) {
      console.error('[campaign-reward]', e);
    }
  });
  console.log('[campaign-reward] cron enabled (every minute)');
}
