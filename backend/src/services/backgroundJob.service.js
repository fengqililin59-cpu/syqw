/**
 * @file MySQL 后台任务队列：claim / 完成 / 失败重试。
 */
import { Op, Transaction, fn, col } from 'sequelize';
import dayjs from 'dayjs';
import { sequelize, BackgroundJob } from '../models/index.js';

/** 预聚合类 job，与 aggregationJobRunner 一致 */
export const AGGREGATION_JOB_TYPES = ['rollup_ads_roi', 'rollup_channel', 'rollup_daily_batch'];

/**
 * 各状态任务数量（key 为 status 原样）
 */
export async function countJobsByStatus() {
  const rows = await BackgroundJob.findAll({
    attributes: ['status', [fn('COUNT', col('id')), 'n']],
    group: ['status'],
    raw: true,
  });
  /** @type {Record<string, number>} */
  const counts = {};
  for (const r of rows) {
    counts[String(r.status)] = Number(r.n);
  }
  return counts;
}

/**
 * 队头 pending（便于排障）
 */
export async function getOldestPendingSnapshot() {
  const row = await BackgroundJob.findOne({
    where: { status: 'pending' },
    order: [['id', 'ASC']],
    attributes: ['id', 'job_type', 'created_at', 'run_after'],
    raw: true,
  });
  if (!row) return null;
  return {
    id: Number(row.id),
    job_type: row.job_type,
    created_at: row.created_at,
    run_after: row.run_after,
  };
}

/**
 * Worker 崩溃后可能长期停留在 processing；定期打回 pending 以便重跑
 * @param {number} [staleMinutes]
 * @returns {Promise<number>} 影响行数
 */
export async function reclaimStaleProcessingJobs(staleMinutes = 30) {
  const threshold = dayjs().subtract(staleMinutes, 'minute').toDate();
  const [n] = await BackgroundJob.update(
    { status: 'pending', locked_at: null, locked_by: null },
    {
      where: {
        status: 'processing',
        locked_at: { [Op.lt]: threshold },
      },
    },
  );
  return n;
}

/**
 * @param {string} jobType
 * @param {object} [payload]
 * @param {{ runAfter?: Date | null }} [opts]
 */
export async function enqueueJob(jobType, payload = {}, opts = {}) {
  return BackgroundJob.create({
    job_type: String(jobType).slice(0, 64),
    payload: payload || null,
    status: 'pending',
    run_after: opts.runAfter || null,
  });
}

/**
 * @param {string} workerId
 */
export async function claimNextJob(workerId) {
  return sequelize.transaction(async (transaction) => {
    const job = await BackgroundJob.findOne({
      where: {
        status: 'pending',
        [Op.or]: [{ run_after: null }, { run_after: { [Op.lte]: new Date() } }],
      },
      order: [['id', 'ASC']],
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!job) return null;
    await job.update(
      {
        status: 'processing',
        locked_at: new Date(),
        locked_by: String(workerId).slice(0, 64),
        attempts: job.attempts + 1,
      },
      { transaction },
    );
    return job.reload({ transaction });
  });
}

export async function markJobDone(jobId) {
  await BackgroundJob.update(
    { status: 'done', last_error: null, locked_at: null, locked_by: null },
    { where: { id: jobId } },
  );
}

export async function markJobRetryOrFail(job, err) {
  const msg = err instanceof Error ? err.message : String(err);
  const attempts = job.attempts;
  const max = job.max_attempts || 5;
  const hardFail = attempts >= max;
  await job.update({
    status: hardFail ? 'failed' : 'pending',
    last_error: msg.slice(0, 4000),
    locked_at: null,
    locked_by: null,
    run_after: hardFail ? null : dayjs().add(Math.min(2 ** Math.min(attempts, 6), 120), 'minute').toDate(),
  });
}
