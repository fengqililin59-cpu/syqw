import cron from 'node-cron';
import { Op } from 'sequelize';
import { SmsTask } from '../models/index.js';
import { executeSmsTask } from '../services/sms.service.js';
import { env } from '../config/env.js';

export function registerSmsSchedulerCron() {
  if (!env.enableSmsCron) return;

  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const tasks = await SmsTask.findAll({
        where: {
          status: 'scheduled',
          scheduled_at: { [Op.between]: [fiveMinAgo, now] },
        },
      });
      for (const task of tasks) {
        executeSmsTask(task.id).catch((err) => console.error('[SMS Scheduler]', err));
      }
    } catch (err) {
      console.error('[SMS Scheduler cron]', err);
    }
  });
  console.log('[cron] SMS scheduler registered');
}
