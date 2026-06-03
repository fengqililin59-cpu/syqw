/**
 * @file 客户新消息后延迟自动生成 AI 草稿并尝试自动发送（需 INBOX_AUTO_DRAFT=1 或租户级开关）。
 */
import { env } from '../config/env.js';
import { InboxThread, InboxMessage, Tenant } from '../models/index.js';
import { createReplyDraft } from './aiEmployee.service.js';

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const pendingTimers = new Map();

function timerKey(tenantId, threadId) {
  return `${tenantId}:${threadId}`;
}

function clearPending(tenantId, threadId) {
  const key = timerKey(tenantId, threadId);
  const t = pendingTimers.get(key);
  if (t) {
    clearTimeout(t);
    pendingTimers.delete(key);
  }
}

/**
 * @param {number} tenantId
 * @param {number} threadId
 * @param {string | null | undefined} messageContent
 * @param {number | null | undefined} triggerMessageId
 */
export function maybeQueueInboxAutoDraft(tenantId, threadId, messageContent, triggerMessageId = null) {
  // 先做轻量检查，避免不必要的 DB 查询
  const text = messageContent ? String(messageContent).trim() : '';
  if (!text) return;

  // 全局开关优先：环境变量 INBOX_AUTO_DRAFT=1 时对所有租户生效
  if (env.inboxAutoDraft === true) {
    scheduleAutoDraft(tenantId, threadId, text, triggerMessageId);
    return;
  }

  // 降级到租户级开关：异步查询，不阻塞调用方
  Tenant.findByPk(tenantId, { attributes: ['inbox_auto_draft_enabled'] })
    .then((tenant) => {
      if (tenant && tenant.inbox_auto_draft_enabled) {
        scheduleAutoDraft(tenantId, threadId, text, triggerMessageId);
      }
    })
    .catch((e) => {
      console.error('[inbox] auto draft tenant lookup failed', e?.message || e);
    });
}

function scheduleAutoDraft(tenantId, threadId, text, triggerMessageId) {
  const delayMs = Math.max(0, Number(env.inboxAutoDraftDelaySec) || 0) * 1000;
  clearPending(tenantId, threadId);

  const run = () => {
    pendingTimers.delete(timerKey(tenantId, threadId));
    runInboxAutoDraft(tenantId, threadId, text, triggerMessageId).catch((e) => {
      console.error('[inbox] auto draft failed', e?.message || e);
    });
  };

  if (delayMs <= 0) {
    setImmediate(run);
    return;
  }

  pendingTimers.set(timerKey(tenantId, threadId), setTimeout(run, delayMs));
}

/**
 * @param {number} tenantId
 * @param {number} threadId
 * @param {string} messageContent
 * @param {number | null | undefined} triggerMessageId
 */
async function runInboxAutoDraft(tenantId, threadId, messageContent, triggerMessageId) {
  const thread = await InboxThread.findOne({
    where: { id: threadId, tenant_id: tenantId },
  });
  if (!thread || thread.status === 'closed' || thread.status === 'pending_human') {
    return;
  }

  const last = await InboxMessage.findOne({
    where: { thread_id: threadId, tenant_id: tenantId },
    order: [['created_at', 'DESC'], ['id', 'DESC']],
  });
  if (!last || last.direction !== 'customer') {
    return;
  }
  if (triggerMessageId && Number(last.id) !== Number(triggerMessageId)) {
    return;
  }

  const auth = {
    tenantId,
    userId: Number(thread.assignee_id) || 1,
    roleName: '管理员',
  };

  const result = await createReplyDraft(auth, {
    thread_id: threadId,
    message: messageContent.slice(0, 2000),
    trigger_message_id: triggerMessageId ?? last.id,
  });

  if (result.auto_sent) {
    console.info(
      `[inbox] auto draft+send thread=${threadId} kind=${result.auto_sent_kind || 'faq'}`,
    );
  }
}

export function cancelInboxAutoDraft(tenantId, threadId) {
  clearPending(tenantId, threadId);
}

/** 供联调/文档 */
export function getInboxAutoDraftStatus() {
  return {
    enabled: env.inboxAutoDraft === true,
    delay_seconds: Number(env.inboxAutoDraftDelaySec) || 0,
    pending_threads: pendingTimers.size,
  };
}
