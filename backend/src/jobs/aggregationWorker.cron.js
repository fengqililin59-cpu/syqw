/**
 * @file 每分钟消费后台任务队列（预聚合等）。
 */
import os from 'os';
import cron from 'node-cron';
import { env } from '../config/env.js';
import { processJobQueueOnce } from '../services/aggregationWorker.service.js';

export function registerAggregationWorkerCron() {
  if (!env.aggregation.workerCron) {
    return;
  }
  const workerId = `${os.hostname()}-${process.pid}`;
  cron.schedule('* * * * *', async () => {
    try {
      await processJobQueueOnce(workerId, env.aggregation.workerBatchSize);
    } catch (e) {
      console.error('[aggregation-worker]', e);
    }
  });
  console.log('[aggregation-worker] cron enabled (every minute)');
}
