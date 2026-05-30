/**
 * @file 裂变奖励任务：入队、领取、完成、重试。
 */
import dayjs from 'dayjs';
import { Op, Transaction } from 'sequelize';
import { sequelize, CampaignRewardJob } from '../models/index.js';

export async function enqueueCampaignRewardJob(payload, options = {}) {
  const scheduledAt = options.scheduledAt || null;
  return CampaignRewardJob.create(
    {
      tenant_id: Number(payload.tenant_id),
      campaign_id: Number(payload.campaign_id),
      customer_id: Number(payload.customer_id),
      enrollment_id: Number(payload.enrollment_id),
      milestone_index: Number(payload.milestone_index),
      reward_type: String(payload.reward_type || 'unknown').slice(0, 32),
      reward_payload: payload.reward_payload || null,
      status: 'pending',
      scheduled_at: scheduledAt,
    },
    options.transaction ? { transaction: options.transaction } : undefined,
  );
}

export async function claimNextCampaignRewardJob(workerId) {
  return sequelize.transaction(async (transaction) => {
    const job = await CampaignRewardJob.findOne({
      where: {
        status: 'pending',
        [Op.or]: [{ scheduled_at: null }, { scheduled_at: { [Op.lte]: new Date() } }],
      },
      order: [['id', 'ASC']],
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!job) return null;
    await job.update(
      {
        status: 'processing',
        attempts: Number(job.attempts || 0) + 1,
        locked_at: new Date(),
        locked_by: String(workerId).slice(0, 64),
      },
      { transaction },
    );
    return job.reload({ transaction });
  });
}

export async function markCampaignRewardJobDone(jobId) {
  await CampaignRewardJob.update(
    {
      status: 'done',
      sent_at: new Date(),
      locked_at: null,
      locked_by: null,
      last_error: null,
    },
    { where: { id: Number(jobId) } },
  );
}

export async function markCampaignRewardJobRetryOrFail(job, error) {
  const msg = error instanceof Error ? error.message : String(error);
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.max_attempts || 5);
  const hardFail = attempts >= maxAttempts;
  await job.update({
    status: hardFail ? 'failed' : 'pending',
    locked_at: null,
    locked_by: null,
    last_error: msg.slice(0, 4000),
    scheduled_at: hardFail ? null : dayjs().add(Math.min(2 ** Math.min(attempts, 6), 120), 'minute').toDate(),
  });
}

export async function reclaimStaleCampaignRewardJobs(staleMinutes = 30) {
  const threshold = dayjs().subtract(staleMinutes, 'minute').toDate();
  const [affected] = await CampaignRewardJob.update(
    { status: 'pending', locked_at: null, locked_by: null },
    { where: { status: 'processing', locked_at: { [Op.lt]: threshold } } },
  );
  return affected;
}
