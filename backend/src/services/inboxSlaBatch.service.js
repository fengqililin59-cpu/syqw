/**
 * @file 收件箱 SLA 批量处理：汇总、认领、标待人工、暂缓提醒。
 */
import { Op } from 'sequelize';
import { InboxThread, Customer, User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { customerWhereScope, isAdmin } from '../utils/permissions.js';
import {
  enrichThreads,
  filterEnrichedThreads,
  inboxSlaMinutes,
  isThreadSlaSnoozed,
} from './inboxThreadEnrich.service.js';

async function customerIdsForUser(auth) {
  const list = await Customer.findAll({
    where: customerWhereScope(auth),
    attributes: ['id'],
    limit: 5000,
  });
  return list.map((c) => c.id);
}

async function threadScopeWhere(auth) {
  const where = { tenant_id: auth.tenantId, status: { [Op.in]: ['open', 'pending_human'] } };
  if (!isAdmin(auth)) {
    const ids = await customerIdsForUser(auth);
    const or = [{ assignee_id: auth.userId }, { assignee_id: null }];
    if (ids.length) or.push({ customer_id: { [Op.in]: ids } });
    where[Op.or] = or;
  }
  return where;
}

async function loadEnrichedSlaThreads(auth, limit = 500) {
  const rows = await InboxThread.findAll({
    where: await threadScopeWhere(auth),
    limit,
    order: [['last_customer_message_at', 'ASC']],
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone'] },
      { model: User, as: 'assignee', attributes: ['id', 'real_name', 'username'], required: false },
    ],
  });
  const plain = rows.map((r) => r.get({ plain: true }));
  const enriched = await enrichThreads(plain, auth.tenantId);
  return filterEnrichedThreads(enriched, 'sla_overdue');
}

export async function getInboxSlaBatchSummary(auth) {
  const all = await loadEnrichedSlaThreads(auth);
  const active = all.filter((t) => !isThreadSlaSnoozed(t));
  const snoozed = all.length - active.length;
  return {
    sla_minutes: inboxSlaMinutes(),
    sla_overdue_total: all.length,
    sla_overdue_active: active.length,
    sla_snoozed: snoozed,
    needs_action: active.length,
  };
}

async function assertThreadsInScope(auth, threadIds) {
  const ids = [...new Set(threadIds.map((id) => Number(id)).filter((id) => id > 0))];
  if (!ids.length) throw new HttpError(400, '请选择会话', 400);

  const where = await threadScopeWhere(auth);
  where.id = { [Op.in]: ids };

  const rows = await InboxThread.findAll({ where, attributes: ['id'] });
  if (rows.length !== ids.length) {
    throw new HttpError(403, '部分会话无权操作或不存在', 403);
  }
  return ids;
}

/**
 * @param {object} auth
 * @param {{ action: string; thread_ids: number[]; assignee_id?: number; snooze_hours?: number }} body
 */
export async function runInboxSlaBatchAction(auth, body) {
  const action = String(body.action || '').trim();
  const allowed = new Set(['pending_human', 'assign', 'snooze', 'clear_snooze']);
  if (!allowed.has(action)) throw new HttpError(400, '不支持的操作', 400);

  const threadIds = await assertThreadsInScope(auth, body.thread_ids || []);

  let updated = 0;
  const results = [];

  for (const threadId of threadIds) {
    // eslint-disable-next-line no-await-in-loop
    const thread = await InboxThread.findOne({
      where: { id: threadId, tenant_id: auth.tenantId },
    });
    if (!thread) continue;

    if (action === 'pending_human') {
      // eslint-disable-next-line no-await-in-loop
      await thread.update({ status: 'pending_human' });
      updated += 1;
      results.push({ thread_id: threadId, ok: true });
      continue;
    }

    if (action === 'assign') {
      const assigneeId =
        body.assignee_id != null ? Number(body.assignee_id) : Number(auth.userId);
      if (!Number.isFinite(assigneeId) || assigneeId <= 0) {
        throw new HttpError(400, '指派人无效', 400);
      }
      if (!isAdmin(auth) && assigneeId !== Number(auth.userId)) {
        throw new HttpError(403, '仅可将会话认领给自己', 403);
      }
      // eslint-disable-next-line no-await-in-loop
      await thread.update({ assignee_id: assigneeId });
      updated += 1;
      results.push({ thread_id: threadId, ok: true, assignee_id: assigneeId });
      continue;
    }

    if (action === 'snooze') {
      const hours = Math.min(72, Math.max(1, Number(body.snooze_hours) || 2));
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      const meta =
        thread.metadata_json && typeof thread.metadata_json === 'object'
          ? { ...thread.metadata_json }
          : {};
      meta.sla_snooze_until = until.toISOString();
      meta.sla_snooze_by = auth.userId;
      // eslint-disable-next-line no-await-in-loop
      await thread.update({ metadata_json: meta });
      updated += 1;
      results.push({ thread_id: threadId, ok: true, snooze_until: until.toISOString() });
      continue;
    }

    if (action === 'clear_snooze') {
      const meta =
        thread.metadata_json && typeof thread.metadata_json === 'object'
          ? { ...thread.metadata_json }
          : {};
      delete meta.sla_snooze_until;
      delete meta.sla_snooze_by;
      // eslint-disable-next-line no-await-in-loop
      await thread.update({ metadata_json: meta });
      updated += 1;
      results.push({ thread_id: threadId, ok: true });
    }
  }

  return { action, updated, total: threadIds.length, results };
}
