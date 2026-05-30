/**
 * @file 预聚合与任务队列（管理端）。
 */
import * as backgroundJob from '../services/backgroundJob.service.js';
import * as rollup from '../services/aggregationRollup.service.js';
import { ok } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';

const allowedJobTypes = new Set(backgroundJob.AGGREGATION_JOB_TYPES);

export async function enqueueJob(req, res) {
  const body = req.body || {};
  const jobType = String(body.job_type || '').trim();
  if (!jobType) throw new HttpError(400, '缺少 job_type', 400);
  if (!allowedJobTypes.has(jobType)) {
    throw new HttpError(400, `不支持的 job_type，可选: ${[...allowedJobTypes].join(', ')}`, 400);
  }
  const payload = { ...body };
  delete payload.job_type;
  const job = await backgroundJob.enqueueJob(jobType, payload);
  return ok(res, { id: Number(job.id), job_type: job.job_type, status: job.status });
}

/** 队列状态（管理端排障） */
export async function jobQueueSummary(_req, res) {
  const [counts, oldest_pending] = await Promise.all([
    backgroundJob.countJobsByStatus(),
    backgroundJob.getOldestPendingSnapshot(),
  ]);
  return ok(res, { counts, oldest_pending });
}

/** 同步执行一日全量租户预聚合（慎用长区间） */
export async function runRollupDailySync(req, res) {
  const statDate = String(req.body?.stat_date || req.query.stat_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(statDate)) {
    throw new HttpError(400, 'stat_date 须为 YYYY-MM-DD', 400);
  }
  const data = await rollup.rollupDailyBatchForDate(statDate);
  return ok(res, data);
}
