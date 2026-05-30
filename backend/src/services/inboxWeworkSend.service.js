/**
 * @file 收件箱回复 → 企微外部联系人发文本。
 */
import { Tenant, Customer, User, OmniChannel, WeworkCustomerMessage } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { sendExternalTextMessage, tryConsumeAutoSendSlot } from './weworkMessage.service.js';

/**
 * @param {number} tenantId
 * @param {import('../models/inboxThread.model.js').InboxThread | object} thread Sequelize 实例或 plain
 * @param {string} text
 * @param {{ userId: number; force?: boolean }} opts
 */
export async function dispatchWeworkReplyForThread(tenantId, thread, text, opts) {
  const channel = await OmniChannel.findByPk(thread.channel_id, { attributes: ['code'] });
  if (!channel || channel.code !== 'wework') {
    return { sent: false, skipped: true, reason: 'not_wework_channel' };
  }

  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant?.wework_corp_id || !tenant?.wework_secret) {
    return { sent: false, skipped: true, reason: 'wework_not_configured' };
  }

  const meta =
    thread.metadata_json && typeof thread.metadata_json === 'object' ? thread.metadata_json : {};

  let externalUserid = meta.external_userid ? String(meta.external_userid) : null;
  if (!externalUserid && thread.customer_id) {
    const c = await Customer.findByPk(thread.customer_id, { attributes: ['external_userid'] });
    externalUserid = c?.external_userid ? String(c.external_userid) : null;
  }
  if (!externalUserid) {
    return { sent: false, skipped: true, reason: 'no_external_userid' };
  }

  let senderUserid = meta.staff_userid ? String(meta.staff_userid) : null;
  if (!senderUserid) {
    const assigneeId = thread.assignee_id || opts.userId;
    const u = await User.findByPk(assigneeId, { attributes: ['wework_userid'] });
    senderUserid = u?.wework_userid ? String(u.wework_userid) : null;
  }
  if (!senderUserid && thread.customer_id) {
    const c = await Customer.findByPk(thread.customer_id, {
      attributes: ['owner_id'],
      include: [{ model: User, as: 'owner', attributes: ['wework_userid'] }],
    });
    senderUserid = c?.owner?.wework_userid ? String(c.owner.wework_userid) : null;
  }
  if (!senderUserid) {
    return { sent: false, skipped: true, reason: 'no_sender_userid' };
  }

  const rate = tryConsumeAutoSendSlot(tenantId);
  if (!rate.ok) {
    throw new HttpError(429, `发送过于频繁，请稍后再试（每分钟上限 ${rate.limit} 条）`, 429);
  }

  const result = await sendExternalTextMessage(tenant, {
    externalUserid,
    text: String(text).trim(),
    senderUserid,
  });

  if (result.errcode !== 0) {
    throw new HttpError(
      502,
      `企微发送失败：${result.errmsg || 'unknown'}（errcode=${result.errcode}，via=${result.via || 'n/a'}）`,
      502,
      { wework: result },
    );
  }

  return {
    sent: true,
    skipped: false,
    via: result.via ?? 'message_send',
    msgid: result.msgid ?? null,
    external_userid: externalUserid,
    sender_userid: senderUserid,
  };
}

/**
 * 出站消息写入企微消息表，便于客户详情页会话历史一致。
 * @param {object} opts
 */
export async function mirrorOutboundToWeworkMessages(opts) {
  const {
    tenantId,
    customerId,
    externalUserid,
    staffUserid,
    content,
    channelMessageId,
    msgTime = new Date(),
  } = opts;
  if (!tenantId || !content) return;
  const msgId = `outbox:${channelMessageId}`;
  try {
    await WeworkCustomerMessage.create({
      tenant_id: tenantId,
      customer_id: customerId ?? null,
      msg_id: msgId,
      external_userid: externalUserid ?? null,
      staff_userid: staffUserid ?? null,
      direction: 'staff',
      msg_type: 'text',
      content: String(content).slice(0, 8000),
      msg_time: msgTime,
    });
  } catch (e) {
    if (e?.name !== 'SequelizeUniqueConstraintError') {
      // eslint-disable-next-line no-console
      console.error('[inbox] mirror wework message', e);
    }
  }
}
