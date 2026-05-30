/**
 * @file 将企微消息同步到统一收件箱（线程 + 消息）。
 */
import { Op } from 'sequelize';
import {
  OmniChannel,
  InboxThread,
  InboxMessage,
  WeworkCustomerMessage,
  Customer,
  CustomerScore,
} from '../models/index.js';
import { maybeQueueInboxAutoDraft } from './inboxAutoDraft.service.js';
import { crmStageToInboxStage } from './salesStageSync.service.js';

const WEWORK_CHANNEL_CODE = 'wework';

function mapCustomerStageToSales(stage) {
  return crmStageToInboxStage(stage);
}

/**
 * @param {number} tenantId
 */
export async function ensureWeworkChannel(tenantId) {
  const [row] = await OmniChannel.findOrCreate({
    where: { tenant_id: tenantId, code: WEWORK_CHANNEL_CODE },
    defaults: {
      tenant_id: tenantId,
      code: WEWORK_CHANNEL_CODE,
      name: '企业微信',
      status: 1,
      config_json: {},
    },
  });
  return row;
}

function buildThreadKey(externalUserid, staffUserid) {
  const ext = externalUserid || 'unknown';
  const staff = staffUserid || 'default';
  return `${ext}:${staff}`;
}

/**
 * @param {{
 *   tenant_id: number;
 *   customer_id?: number | null;
 *   external_userid?: string | null;
 *   staff_userid?: string | null;
 *   direction: string;
 *   msg_type: string;
 *   content?: string | null;
 *   msg_id: string;
 *   msg_time: Date;
 * }} payload
 */
export async function upsertFromWeworkMessage(payload) {
  if (!payload?.tenant_id || !payload.msg_id) {
    return { synced: false, reason: 'invalid_payload' };
  }
  if (payload.msg_type === 'event') {
    return { synced: false, reason: 'skip_event' };
  }

  const channel = await ensureWeworkChannel(payload.tenant_id);
  const threadKey = buildThreadKey(payload.external_userid, payload.staff_userid);

  let thread = await InboxThread.findOne({
    where: {
      tenant_id: payload.tenant_id,
      channel_id: channel.id,
      external_thread_key: threadKey,
    },
  });

  const msgTime = payload.msg_time instanceof Date ? payload.msg_time : new Date(payload.msg_time);
  const isCustomer = payload.direction === 'customer';

  if (!thread) {
    let assigneeId = null;
    if (payload.customer_id) {
      const c = await Customer.findByPk(payload.customer_id, { attributes: ['owner_id'] });
      assigneeId = c?.owner_id ?? null;
    }
    let salesStage = 'new';
    let leadScore = 0;
    if (payload.customer_id) {
      const c = await Customer.findByPk(payload.customer_id, { attributes: ['stage'] });
      if (c?.stage) salesStage = mapCustomerStageToSales(c.stage);
      const latestScore = await CustomerScore.findOne({
        where: { tenant_id: payload.tenant_id, customer_id: payload.customer_id },
        order: [['created_at', 'DESC']],
        attributes: ['final_score'],
      });
      if (latestScore?.final_score != null) leadScore = latestScore.final_score;
    }
    thread = await InboxThread.create({
      tenant_id: payload.tenant_id,
      channel_id: channel.id,
      customer_id: payload.customer_id ?? null,
      external_thread_key: threadKey,
      assignee_id: assigneeId,
      sales_stage: salesStage,
      status: 'open',
      lead_score: leadScore,
      last_message_at: msgTime,
      last_customer_message_at: isCustomer ? msgTime : null,
      metadata_json: {
        external_userid: payload.external_userid,
        staff_userid: payload.staff_userid,
      },
    });
  } else {
    const patch = { last_message_at: msgTime };
    if (payload.customer_id && !thread.customer_id) {
      patch.customer_id = payload.customer_id;
    }
    if (isCustomer) {
      patch.last_customer_message_at = msgTime;
      if (thread.status === 'closed') {
        patch.status = 'open';
      }
    }
    if (payload.customer_id && thread.customer_id !== payload.customer_id) {
      const c = await Customer.findByPk(payload.customer_id, { attributes: ['stage'] });
      if (c?.stage) {
        patch.sales_stage = mapCustomerStageToSales(c.stage);
      }
      const latestScore = await CustomerScore.findOne({
        where: { tenant_id: payload.tenant_id, customer_id: payload.customer_id },
        order: [['created_at', 'DESC']],
        attributes: ['final_score'],
      });
      if (latestScore?.final_score != null) {
        patch.lead_score = latestScore.final_score;
      }
    }
    await thread.update(patch);
    await thread.reload();
  }

  const direction =
    payload.direction === 'customer'
      ? 'customer'
      : payload.direction === 'staff'
        ? 'staff'
        : 'system';

  try {
    await InboxMessage.create({
      tenant_id: payload.tenant_id,
      thread_id: thread.id,
      channel_message_id: `wework:${payload.msg_id}`,
      direction,
      sender_role: direction,
      content: payload.content ?? null,
      msg_type: payload.msg_type || 'text',
      risk_level: 'p0',
      raw_payload: { source: 'wework_customer_messages' },
    });
  } catch (e) {
    if (e?.name === 'SequelizeUniqueConstraintError') {
      return { synced: false, reason: 'duplicate', thread_id: thread.id };
    }
    throw e;
  }

  if (isCustomer && payload.content) {
    maybeQueueInboxAutoDraft(payload.tenant_id, thread.id, payload.content);
  }

  return { synced: true, thread_id: thread.id };
}

/**
 * 历史企微消息批量同步到收件箱（管理员联调 / 首次开通）。
 * @param {number} tenantId
 * @param {{ limit?: number }} opts
 */
export async function syncWeworkHistory(tenantId, opts = {}) {
  const limit = Math.min(2000, Math.max(1, Number(opts.limit) || 500));
  const rows = await WeworkCustomerMessage.findAll({
    where: { tenant_id: tenantId, msg_type: { [Op.ne]: 'event' } },
    order: [['msg_time', 'ASC']],
    limit,
  });
  let synced = 0;
  let skipped = 0;
  for (const r of rows) {
    const res = await upsertFromWeworkMessage({
      tenant_id: tenantId,
      customer_id: r.customer_id,
      external_userid: r.external_userid,
      staff_userid: r.staff_userid,
      direction: r.direction,
      msg_type: r.msg_type,
      content: r.content,
      msg_id: r.msg_id,
      msg_time: r.msg_time,
    });
    if (res.synced) synced += 1;
    else skipped += 1;
  }
  return { scanned: rows.length, synced, skipped };
}
