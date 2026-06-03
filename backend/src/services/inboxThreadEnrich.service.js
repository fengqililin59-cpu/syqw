/**
 * @file 收件箱会话列表：待回复 / SLA 标记与优先排序。
 */
import { Op, QueryTypes } from 'sequelize';
import { InboxMessage, AiReplyLog } from '../models/index.js';
import { env } from '../config/env.js';

export function inboxSlaMinutes() {
  return Math.max(5, Number(env.inboxSlaMinutes) || 30);
}

/**
 * @param {object} thread plain thread
 * @param {string | undefined} lastDirection
 */
export function threadNeedsReply(thread, lastDirection) {
  if (!['open', 'pending_human'].includes(String(thread.status || ''))) return false;
  return lastDirection === 'customer';
}

/**
 * @param {object} thread
 * @param {string | undefined} lastDirection
 */
export function threadSlaOverdue(thread, lastDirection) {
  if (!threadNeedsReply(thread, lastDirection)) return false;
  if (isThreadSlaSnoozed(thread)) return false;
  if (!thread.last_customer_message_at) return false;
  const deadline = Date.now() - inboxSlaMinutes() * 60 * 1000;
  return new Date(thread.last_customer_message_at).getTime() <= deadline;
}

export function isThreadSlaSnoozed(thread) {
  const meta =
    thread.metadata_json && typeof thread.metadata_json === 'object' ? thread.metadata_json : {};
  const until = meta.sla_snooze_until ? new Date(meta.sla_snooze_until).getTime() : 0;
  return until > Date.now();
}

/**
 * @param {number} tenantId
 * @param {number[]} threadIds
 * @returns {Promise<Map<number, string>>}
 */
export async function lastMessageDirectionByThreadId(tenantId, threadIds) {
  const map = new Map();
  if (!threadIds.length) return map;

  const rows = await InboxMessage.sequelize.query(
    `SELECT m.thread_id AS thread_id, m.direction AS direction
     FROM inbox_messages m
     INNER JOIN (
       SELECT thread_id, MAX(id) AS mid
       FROM inbox_messages
       WHERE tenant_id = :tenantId AND thread_id IN (:threadIds)
       GROUP BY thread_id
     ) x ON m.id = x.mid`,
    {
      replacements: { tenantId, threadIds },
      type: QueryTypes.SELECT,
    },
  );

  for (const row of rows) {
    map.set(Number(row.thread_id), String(row.direction));
  }
  return map;
}

/**
 * @param {number} tenantId
 * @param {number[]} threadIds
 * @returns {Promise<Map<number, { count: number; last_at: string | null }>>}
 */
export async function aiAutoSentByThreadId(tenantId, threadIds) {
  const map = new Map();
  if (!threadIds.length) return map;

  const rows = await AiReplyLog.findAll({
    attributes: [
      'thread_id',
      [AiReplyLog.sequelize.fn('COUNT', AiReplyLog.sequelize.col('id')), 'cnt'],
      [AiReplyLog.sequelize.fn('MAX', AiReplyLog.sequelize.col('created_at')), 'last_at'],
    ],
    where: {
      tenant_id: tenantId,
      thread_id: { [Op.in]: threadIds },
      status: 'approved',
      approved_by: null,
    },
    group: ['thread_id'],
    raw: true,
  });

  for (const row of rows) {
    map.set(Number(row.thread_id), {
      count: Number(row.cnt) || 0,
      last_at: row.last_at ? String(row.last_at) : null,
    });
  }
  return map;
}

/**
 * @param {object} thread
 * @param {string | undefined} lastDirection
 */
export function threadPriorityScore(thread, lastDirection) {
  let score = 0;
  if (thread.status === 'pending_human') score += 1_000_000;
  if (threadSlaOverdue(thread, lastDirection)) score += 100_000;
  if (threadNeedsReply(thread, lastDirection)) score += 10_000;
  const ts = thread.last_message_at ? new Date(thread.last_message_at).getTime() : 0;
  return score + ts / 1_000_000_000_000;
}

/**
 * @param {object[]} plainThreads
 * @param {number} tenantId
 */
export async function enrichThreads(plainThreads, tenantId) {
  const ids = plainThreads.map((t) => t.id);
  const [dirMap, autoMap] = await Promise.all([
    lastMessageDirectionByThreadId(tenantId, ids),
    aiAutoSentByThreadId(tenantId, ids),
  ]);
  return plainThreads.map((t) => {
    const last_direction = dirMap.get(t.id);
    const auto = autoMap.get(t.id);
    const ai_auto_sent_count = auto?.count ?? 0;
    return {
      ...t,
      last_direction: last_direction ?? null,
      needs_reply: threadNeedsReply(t, last_direction),
      sla_overdue: threadSlaOverdue(t, last_direction),
      ai_auto_sent_count,
      has_ai_auto_sent: ai_auto_sent_count > 0,
      ai_auto_sent_at: auto?.last_at ?? null,
    };
  });
}

/**
 * @param {object[]} enriched
 * @param {string} [filter] all | needs_reply | sla_overdue | pending_human | ai_auto_sent
 */
export function filterEnrichedThreads(enriched, filter) {
  const f = String(filter || 'all');
  if (f === 'needs_reply') return enriched.filter((t) => t.needs_reply);
  if (f === 'sla_overdue') return enriched.filter((t) => t.sla_overdue);
  if (f === 'pending_human') return enriched.filter((t) => t.status === 'pending_human');
  if (f === 'ai_auto_sent') return enriched.filter((t) => t.has_ai_auto_sent);
  return enriched;
}

export function sortEnrichedThreads(enriched, sort) {
  const s = String(sort || 'priority');
  const list = [...enriched];
  if (s === 'recent') {
    list.sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
    return list;
  }
  list.sort((a, b) => threadPriorityScore(b, b.last_direction) - threadPriorityScore(a, a.last_direction));
  return list;
}
