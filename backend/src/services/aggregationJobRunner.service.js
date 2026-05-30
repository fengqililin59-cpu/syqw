/**
 * @file 后台任务执行器：预聚合类 job。
 */
import * as rollup from './aggregationRollup.service.js';

/**
 * @param {import('../models/backgroundJob.model.js').BackgroundJob} job
 */
export async function processAggregationJob(job) {
  const plain = job.get({ plain: true });
  const payload = plain.payload || {};
  switch (plain.job_type) {
    case 'rollup_ads_roi': {
      const tid = Number(payload.tenant_id);
      if (!tid) throw new Error('rollup_ads_roi 需要 payload.tenant_id');
      await rollup.rollupAdsRoiDayRange(tid, String(payload.start_date), String(payload.end_date));
      return;
    }
    case 'rollup_channel': {
      const tid = Number(payload.tenant_id);
      if (!tid) throw new Error('rollup_channel 需要 payload.tenant_id');
      await rollup.rollupChannelDayRange(tid, String(payload.start_date), String(payload.end_date));
      return;
    }
    case 'rollup_daily_batch': {
      const d = String(payload.stat_date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('rollup_daily_batch 需要 payload.stat_date YYYY-MM-DD');
      await rollup.rollupDailyBatchForDate(d);
      return;
    }
    default:
      throw new Error(`未知 job_type: ${plain.job_type}`);
  }
}
