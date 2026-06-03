/**
 * @file 通知规则评估器（每 2 分钟）— 评估所有启用的 schedule/cron 类型规则
 */
import cron from 'node-cron';
import { createRequire } from 'module';
import { NotificationRule } from '../models/index.js';

const require = createRequire(import.meta.url);
const notificationDispatcher = require('../services/notificationDispatcher.service.cjs');

let cronTask = null;
const cronExpression = '*/2 * * * *'; // 每 2 分钟

async function runEvaluationOnce() {
  const summary = { total: 0, triggered: 0, skipped: 0, errors: 0 };

  try {
    const scheduleRules = await NotificationRule.sequelize.query(
      `SELECT * FROM notification_rules WHERE enabled = 1 AND trigger_type IN ('schedule', 'cron')`,
      { model: NotificationRule, mapToModel: true },
    );

    summary.total = scheduleRules.length;

    for (const rule of scheduleRules) {
      try {
        const result = await notificationDispatcher.dispatch(rule);
        if (result.skipped) {
          summary.skipped++;
        } else {
          summary.triggered++;
        }
      } catch (e) {
        summary.errors++;
        console.error(`[notification-rule] Rule ${rule.id} failed:`, e.message);
      }
    }
  } catch (e) {
    console.error('[notification-rule] Evaluator failed:', e.message);
  }

  if (summary.triggered > 0 || summary.errors > 0) {
    console.log(`[notification-rule] Evaluated ${summary.total} rules: ${summary.triggered} triggered, ${summary.skipped} skipped, ${summary.errors} errors`);
  }

  return summary;
}

export function registerNotificationRuleEvaluatorCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }

  console.log(`[notification-rule] Cron enabled: ${cronExpression}`);
  cronTask = cron.schedule(cronExpression, async () => {
    await runEvaluationOnce().catch(() => {});
  });

  return cronTask;
}

export { runEvaluationOnce };
