/**
 * @file AI 收件箱自动发送后，企微提醒会话负责人抽查。
 */
import { InboxThread, Customer, User, Tenant } from '../models/index.js';
import { env } from '../config/env.js';
import { sendAgentTextMessage } from './wework.service.js';

const KIND_LABEL = {
  faq: '资料类',
  pricing: '询价类',
};

/**
 * @param {number} tenantId
 * @param {number} threadId
 * @param {{ kind?: string; preview?: string; logId?: number }} [opts]
 */
export async function notifyAssigneeOnInboxAiAutoSend(tenantId, threadId, opts = {}) {
  if (env.inboxAiAutoSendNotify === false) {
    return { sent: false, skipped: 'platform_disabled' };
  }

  const tenant = await Tenant.findByPk(tenantId, {
    attributes: [
      'id',
      'name',
      'wework_corp_id',
      'wework_secret',
      'wework_agent_id',
      'inbox_ai_notify_assignee_on_auto_send',
    ],
  });
  if (!tenant?.wework_corp_id || !tenant?.wework_secret) {
    return { sent: false, skipped: 'no_wework' };
  }
  if (!tenant.inbox_ai_notify_assignee_on_auto_send) {
    return { sent: false, skipped: 'tenant_disabled' };
  }

  const thread = await InboxThread.findOne({
    where: { id: threadId, tenant_id: tenantId },
    include: [
      {
        model: Customer,
        attributes: ['id', 'name', 'nickname', 'phone', 'owner_id'],
        include: [{ model: User, as: 'owner', attributes: ['id', 'wework_userid', 'real_name', 'username'] }],
      },
      { model: User, as: 'assignee', attributes: ['id', 'wework_userid', 'real_name', 'username'] },
    ],
  });
  if (!thread) return { sent: false, skipped: 'no_thread' };

  const assignee = thread.assignee;
  const owner = thread.Customer?.owner;
  const targetUser = assignee?.wework_userid
    ? assignee
    : owner?.wework_userid
      ? owner
      : null;
  if (!targetUser?.wework_userid) {
    return { sent: false, skipped: 'no_assignee_wework' };
  }

  const custLabel =
    thread.Customer?.name ||
    thread.Customer?.nickname ||
    thread.Customer?.phone ||
    `客户#${thread.customer_id || thread.id}`;
  const kind = KIND_LABEL[opts.kind] || KIND_LABEL.faq;
  const preview = String(opts.preview || '').trim().slice(0, 120);
  const base = String(env.appUrl || '').replace(/\/$/, '');
  const inboxUrl = `${base}/app/inbox?thread_id=${thread.id}`;

  const content = [
    '【AI 已自动回复客户】',
    `客户：${custLabel}`,
    `类型：${kind}`,
    preview ? `内容：${preview}${preview.length >= 120 ? '…' : ''}` : '',
    '请抽查是否准确，必要时人工跟进。',
    `打开会话：${inboxUrl}`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    await sendAgentTextMessage(tenant, {
      touser: String(targetUser.wework_userid).trim(),
      content,
    });
    return { sent: true, user_id: targetUser.id };
  } catch (e) {
    console.error('[inbox-ai-auto-notify] send failed', threadId, e?.message || e);
    return { sent: false, skipped: 'send_failed' };
  }
}
