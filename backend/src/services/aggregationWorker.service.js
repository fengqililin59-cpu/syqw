/**
 * @file 队列消费：每次从 background_jobs 拉取并执行。
 */
import {
  claimNextJob,
  markJobDone,
  markJobRetryOrFail,
  reclaimStaleProcessingJobs,
} from './backgroundJob.service.js';
import { processAggregationJob } from './aggregationJobRunner.service.js';

export async function processJobQueueOnce(workerId, max = 5) {
  await reclaimStaleProcessingJobs();
  for (let i = 0; i < max; i += 1) {
    const job = await claimNextJob(workerId);
    if (!job) break;
    try {
      await processAggregationJob(job);
      await markJobDone(job.id);
    } catch (e) {
      const j = await job.reload();
      await markJobRetryOrFail(j, e);
    }
  }
}
