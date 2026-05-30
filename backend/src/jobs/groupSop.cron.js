import cron from 'node-cron';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { GroupSopTask, GroupSopTarget } from '../models/index.js';
import { executeSopTask } from '../services/customerGroup.service.js';
import { env } from '../config/env.js';

const RECURRING_PRESETS = {
  daily_9: { hour: 9, minute: 0, days: null },
  daily_12: { hour: 12, minute: 0, days: null },
  daily_18: { hour: 18, minute: 0, days: null },
  weekly_mon_9: { hour: 9, minute: 0, days: [1] },
  weekly_fri_18: { hour: 18, minute: 0, days: [5] },
};

function shouldTriggerRecurring(preset) {
  const now = dayjs();
  const cfg = RECURRING_PRESETS[preset];
  if (!cfg) return false;
  if (now.hour() !== cfg.hour) return false;
  if (now.minute() > 5) return false;
  if (cfg.days && !cfg.days.includes(now.day())) return false;
  return true;
}

export async function runGroupSopTick() {
  const now = dayjs();

  const scheduledTasks = await GroupSopTask.findAll({
    where: {
      status: 'active',
      trigger_type: 'scheduled',
      scheduled_at: {
        [Op.between]: [now.subtract(10, 'minute').toDate(), now.toDate()],
      },
    },
  });

  for (const task of scheduledTasks) {
    try {
      await executeSopTask(task.id);
      await task.update({ status: 'done' });
    } catch (err) {
      console.error(`[GroupSOP] task ${task.id} failed:`, err);
    }
  }

  const recurringTasks = await GroupSopTask.findAll({
    where: {
      status: 'active',
      trigger_type: 'recurring',
    },
  });

  for (const task of recurringTasks) {
    if (!shouldTriggerRecurring(task.recurring_cron)) continue;

    const target = await GroupSopTarget.findOne({
      where: { sop_task_id: task.id },
      order: [['last_sent_at', 'DESC']],
    });
    if (target?.last_sent_at) {
      const diffHours = now.diff(dayjs(target.last_sent_at), 'hour');
      if (diffHours < 1) continue;
    }

    try {
      await executeSopTask(task.id);
    } catch (err) {
      console.error(`[GroupSOP] recurring task ${task.id} failed:`, err);
    }
  }
}

export function registerGroupSopCron() {
  if (!env.enableGroupSopCron) return;
  cron.schedule('*/5 * * * *', async () => {
    try {
      await runGroupSopTick();
    } catch (err) {
      console.error('[GroupSOP cron]', err);
    }
  });
  console.log('[cron] GroupSOP cron registered');
}

