/**
 * @file 每日入队：昨日全租户预聚合（rollup_daily_batch）。
 */
import cron from 'node-cron';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { enqueueJob } from '../services/backgroundJob.service.js';

export function registerAggregationNightlyCron() {
  if (!env.aggregation.nightlyCron) {
    return;
  }
  cron.schedule('15 1 * * *', async () => {
    const statDate = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    try {
      await enqueueJob('rollup_daily_batch', { stat_date: statDate });
      console.log('[aggregation-nightly] enqueued rollup_daily_batch', statDate);
    } catch (e) {
      console.error('[aggregation-nightly] enqueue failed', e);
    }
  });
  console.log('[aggregation-nightly] cron enabled (01:15 daily, Asia server TZ recommended)');
}
