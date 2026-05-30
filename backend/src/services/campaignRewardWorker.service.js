/**
 * @file 裂变奖励队列消费器。
 */
import { Customer, Campaign, CampaignEnrollment } from '../models/index.js';
import {
  claimNextCampaignRewardJob,
  markCampaignRewardJobDone,
  markCampaignRewardJobRetryOrFail,
  reclaimStaleCampaignRewardJobs,
} from './campaignRewardJob.service.js';

function rewardDescription(jobPlain, campaignPlain) {
  const cfg = jobPlain.reward_payload || {};
  const desc = cfg.description ?? cfg.text ?? campaignPlain.reward_type;
  return String(desc || '').slice(0, 200);
}

async function dispatchReward(job) {
  const plain = job.get({ plain: true });
  const [campaign, customer] = await Promise.all([
    Campaign.findByPk(plain.campaign_id),
    Customer.findByPk(plain.customer_id),
  ]);
  if (!campaign || !customer) {
    throw new Error('campaign_or_customer_not_found');
  }
  // 当前仍为最小可用链路：记录可追踪日志，后续接入券码/红包平台。
  // eslint-disable-next-line no-console
  console.log(
    `[campaign-reward] done tenant=${plain.tenant_id} campaign=${plain.campaign_id} customer=${plain.customer_id} milestone=${plain.milestone_index} reward=${rewardDescription(plain, campaign.get({ plain: true }))}`,
  );
}

export async function processCampaignRewardQueueOnce(workerId, max = 10) {
  await reclaimStaleCampaignRewardJobs();
  for (let i = 0; i < max; i += 1) {
    const job = await claimNextCampaignRewardJob(workerId);
    if (!job) break;
    try {
      await dispatchReward(job);
      await markCampaignRewardJobDone(job.id);
      await CampaignEnrollment.update(
        { reward_sent_at: new Date() },
        {
          where: {
            id: Number(job.enrollment_id),
            reward_sent_at: null,
          },
        },
      );
    } catch (error) {
      const latest = await job.reload();
      await markCampaignRewardJobRetryOrFail(latest, error);
    }
  }
}
