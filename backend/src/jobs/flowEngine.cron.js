/**
 * @file 流程延迟节点恢复（默认关闭：ENABLE_FLOW_ENGINE_CRON=1）。
 */
import cron from 'node-cron';
import { env } from '../config/env.js';
import { processWaitingFlowRuns } from '../services/flowEngine.service.js';

export function registerFlowEngineCron() {
  if (!env.enableFlowEngineCron) {
    console.log('[flow-engine] cron disabled (set ENABLE_FLOW_ENGINE_CRON=1)');
    return;
  }

  cron.schedule('* * * * *', async () => {
    try {
      await processWaitingFlowRuns();
    } catch (e) {
      console.error('[flow-engine] tick failed', e);
    }
  });
}
