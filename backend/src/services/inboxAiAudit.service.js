/**
 * @file 收件箱 AI 自动发送审计留痕。
 */
import { writeAuditLog } from './auditLog.service.js';

/**
 * @param {object} auth
 * @param {string} action
 * @param {Record<string, unknown>} detail
 * @param {{ system?: boolean }} [opts]
 */
export async function auditInboxAiEvent(auth, action, detail, opts = {}) {
  const system = opts.system === true;
  await writeAuditLog(
    {
      tenantId: auth.tenantId,
      userId: system ? null : auth.userId,
    },
    {
      action: String(action).slice(0, 64),
      targetType: 'ai_reply_log',
      targetId: detail.log_id ?? detail.thread_id ?? null,
      detail,
    },
  );
}

/**
 * @param {object} auth
 * @param {object} detail
 */
export function auditInboxAiAutoSent(auth, detail) {
  return auditInboxAiEvent(auth, 'inbox_ai_auto_sent', detail, { system: true });
}

/**
 * @param {object} auth
 * @param {object} detail
 */
export function auditInboxAiAutoSendSkipped(auth, detail) {
  return auditInboxAiEvent(auth, 'inbox_ai_auto_send_skipped', detail, { system: true });
}
