/**
 * @file 收件箱 SLA：客户消息后超时未回复，企微应用消息提醒负责人。
 */
import { Op } from 'sequelize';
import { InboxThread, InboxMessage, User, Customer, Tenant } from '../models/index.js';
import { env } from '../config/env.js';
import { sendAgentTextMessage } from './wework.service.js';
import { isThreadSlaSnoozed } from './inboxThreadEnrich.service.js';

function slaMinutes() {
  return Math.max(5, Number(env.inboxSlaMinutes) || 30);
}

/**
 * @param {import('../models/inboxThread.model.js').InboxThread} thread
 * @param {Date} customerMsgAt
 */
function alreadyNotifiedFor(thread, customerMsgAt) {
  const meta =
    thread.metadata_json && typeof thread.metadata_json === 'object' ? thread.metadata_json : {};
  const key = customerMsgAt.toISOString();
  return meta.sla_notified_for === key;
}

/**
 * @param {import('../models/inboxThread.model.js').InboxThread} thread
 * @param {Date} customerMsgAt
 */
async function markNotified(thread, customerMsgAt) {
  const meta =
    thread.metadata_json && typeof thread.metadata_json === 'object'
      ? { ...thread.metadata_json }
      : {};
  meta.sla_notified_for = customerMsgAt.toISOString();
  meta.sla_notified_at = new Date().toISOString();
  await thread.update({ metadata_json: meta });
}

/**
 * @param {number} [limitPerRun]
 */
export async function runInboxSlaReminderOnce(limitPerRun = 20) {
  const minutes = slaMinutes();
  const deadline = new Date(Date.now() - minutes * 60 * 1000);

  const threads = await InboxThread.findAll({
    where: {
      status: { [Op.in]: ['open', 'pending_human'] },
      last_customer_message_at: { [Op.ne]: null, [Op.lte]: deadline },
    },
    order: [['last_customer_message_at', 'ASC']],
    limit: Math.min(100, Math.max(1, limitPerRun * 3)),
    include: [
      {
        model: Customer,
        attributes: ['id', 'name', 'nickname', 'phone', 'owner_id'],
        include: [{ model: User, as: 'owner', attributes: ['id', 'wework_userid', 'real_name', 'username'] }],
      },
      { model: User, as: 'assignee', attributes: ['id', 'wework_userid', 'real_name', 'username'] },
    ],
  });

  let scanned = 0;
  let notified = 0;
  let skipped = 0;

  for (const thread of threads) {
    if (notified >= limitPerRun) break;
    scanned += 1;

    if (isThreadSlaSnoozed(thread.get ? thread.get({ plain: true }) : thread)) {
      skipped += 1;
      continue;
    }

    const customerAt = new Date(thread.last_customer_message_at);
    if (alreadyNotifiedFor(thread, customerAt)) {
      skipped += 1;
      continue;
    }

    const lastMsg = await InboxMessage.findOne({
      where: { thread_id: thread.id },
      order: [['created_at', 'DESC']],
      attributes: ['direction', 'created_at'],
    });
    if (!lastMsg || lastMsg.direction !== 'customer') {
      skipped += 1;
      continue;
    }

    const assignee = thread.assignee;
    const owner = thread.Customer?.owner;
    const targetUser = assignee?.wework_userid
      ? assignee
      : owner?.wework_userid
        ? owner
        : null;
    if (!targetUser?.wework_userid) {
      skipped += 1;
      continue;
    }

    const tenant = await Tenant.findByPk(thread.tenant_id);
    if (!tenant?.wework_corp_id || !tenant?.wework_secret || !tenant?.wework_agent_id) {
      skipped += 1;
      continue;
    }

    const custLabel =
      thread.Customer?.name ||
      thread.Customer?.nickname ||
      thread.Customer?.phone ||
      `客户#${thread.customer_id || thread.id}`;
    const waitMin = Math.round((Date.now() - customerAt.getTime()) / 60000);
    const inboxUrl = `${env.appUrl.replace(/\/$/, '')}/app/inbox?customer_id=${thread.customer_id || ''}`;
    const content = [
      '【收件箱提醒】客户等待回复',
      `客户：${custLabel}`,
      `已等待约 ${waitMin} 分钟（阈值 ${minutes} 分钟）`,
      `请尽快在统一收件箱回复：${inboxUrl}`,
    ].join('\n');

    try {
      await sendAgentTextMessage(tenant, {
        touser: targetUser.wework_userid,
        content,
      });
      await markNotified(thread, customerAt);
      notified += 1;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[inbox-sla] notify failed', thread.id, e?.message || e);
      skipped += 1;
    }
  }

  return { scanned, notified, skipped, sla_minutes: minutes };
}

/**
 * 统计当前超时未回复会话数（供看板）。
 * @param {number} tenantId
 */
export async function countSlaOverdueThreads(tenantId) {
  const minutes = slaMinutes();
  const deadline = new Date(Date.now() - minutes * 60 * 1000);
  const threads = await InboxThread.findAll({
    where: {
      tenant_id: tenantId,
      status: { [Op.in]: ['open', 'pending_human'] },
      last_customer_message_at: { [Op.ne]: null, [Op.lte]: deadline },
    },
    attributes: ['id', 'metadata_json', 'last_customer_message_at'],
    limit: 500,
  });
  let count = 0;
  for (const t of threads) {
    const customerAt = new Date(t.last_customer_message_at);
    if (alreadyNotifiedFor(t, customerAt)) {
      /* 仍算超时待处理 */
    }
    const lastMsg = await InboxMessage.findOne({
      where: { thread_id: t.id },
      order: [['created_at', 'DESC']],
      attributes: ['direction'],
    });
    if (lastMsg?.direction === 'customer') count += 1;
  }
  return count;
}
