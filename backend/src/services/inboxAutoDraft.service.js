/**
 * @file 客户新消息后可选自动生成 AI 回复草稿（需 INBOX_AUTO_DRAFT=1）。
 */
import { env } from '../config/env.js';
import { InboxThread } from '../models/index.js';
import { createReplyDraft } from './aiEmployee.service.js';

/**
 * @param {number} tenantId
 * @param {number} threadId
 * @param {string | null | undefined} messageContent
 */
export function maybeQueueInboxAutoDraft(tenantId, threadId, messageContent) {
  if (env.inboxAutoDraft !== true) return;

  setImmediate(() => {
    (async () => {
      const thread = await InboxThread.findOne({
        where: { id: threadId, tenant_id: tenantId },
      });
      if (!thread || thread.status === 'closed' || thread.status === 'pending_human') {
        return;
      }
      const text = messageContent ? String(messageContent).trim() : '';
      if (!text) return;

      const auth = {
        tenantId,
        userId: Number(thread.assignee_id) || 1,
        roleName: '管理员',
      };
      await createReplyDraft(auth, {
        thread_id: threadId,
        message: text.slice(0, 2000),
      });
    })().catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[inbox] auto draft failed', e?.message || e);
    });
  });
}
