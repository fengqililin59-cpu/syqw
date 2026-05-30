/**
 * @file 客户 360° 统一时间线：聚合跟进、企微、收件箱、工单、订单、通话、短信。
 */
import { Op } from 'sequelize';
import {
  CustomerFollowUp,
  WeworkCustomerMessage,
  InboxMessage,
  InboxThread,
  OmniChannel,
  ServiceTicket,
  CustomerOrder,
  CallRecord,
  SmsSendLog,
  User,
} from '../models/index.js';
import { getCustomer } from './customer.service.js';

const PER_SOURCE = 60;

const FOLLOW_TYPE_LABELS = {
  call: '电话跟进',
  wechat: '微信跟进',
  meeting: '拜访',
  other: '备注',
};

function pickTime(...candidates) {
  for (const t of candidates) {
    if (!t) continue;
    const d = t instanceof Date ? t : new Date(t);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function mapFollowUp(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.created_at);
  if (!at) return null;
  const author = plain.author?.real_name || plain.author?.username;
  const typeLabel = FOLLOW_TYPE_LABELS[plain.type] || plain.type || '跟进';
  return {
    id: `follow_up:${plain.id}`,
    type: 'follow_up',
    at: at.toISOString(),
    title: typeLabel,
    summary: plain.content || '',
    meta: {
      follow_up_id: plain.id,
      follow_type: plain.type,
      author,
    },
  };
}

function mapWeworkMsg(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.msg_time, plain.created_at);
  if (!at) return null;
  const dir = plain.direction === 'staff' ? '员工发送' : '客户消息';
  return {
    id: `wework_message:${plain.id}`,
    type: 'wework_message',
    at: at.toISOString(),
    title: `企微 · ${dir}`,
    summary: plain.content || `（${plain.msg_type || '消息'}）`,
    meta: {
      message_id: plain.id,
      direction: plain.direction,
      msg_type: plain.msg_type,
    },
  };
}

function mapInboxMsg(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.created_at);
  if (!at) return null;
  const thread = plain.thread || plain.InboxThread;
  const channelName = thread?.channel?.name || thread?.channel?.code || '收件箱';
  const dir =
    plain.direction === 'staff'
      ? '员工回复'
      : plain.direction === 'system'
        ? '系统'
        : '客户私信';
  return {
    id: `inbox_message:${plain.id}`,
    type: 'inbox_message',
    at: at.toISOString(),
    title: `${channelName} · ${dir}`,
    summary: plain.content || `（${plain.msg_type || '消息'}）`,
    meta: {
      message_id: plain.id,
      thread_id: plain.thread_id,
      channel_code: thread?.channel?.code,
      direction: plain.direction,
    },
  };
}

const TICKET_STATUS_LABELS = {
  open: '待处理',
  in_progress: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

function mapTicket(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.created_at);
  if (!at) return null;
  const statusLabel = TICKET_STATUS_LABELS[plain.status] || plain.status;
  return {
    id: `ticket:${plain.id}`,
    type: 'ticket',
    at: at.toISOString(),
    title: `工单 · ${statusLabel}`,
    summary: plain.title || plain.description || '',
    meta: {
      ticket_id: plain.id,
      status: plain.status,
      priority: plain.priority,
    },
  };
}

const ORDER_STATUS_LABELS = {
  pending: '待支付',
  paid: '已支付',
  refunded: '已退款',
  cancelled: '已取消',
};

function mapOrder(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.paid_at, plain.created_at);
  if (!at) return null;
  const statusLabel = ORDER_STATUS_LABELS[plain.status] || plain.status;
  const amount = plain.amount != null ? Number(plain.amount).toFixed(2) : '0.00';
  return {
    id: `order:${plain.id}`,
    type: 'order',
    at: at.toISOString(),
    title: `订单 · ${statusLabel}`,
    summary: plain.order_no
      ? `${plain.order_no} · ¥${amount}`
      : `¥${amount}${plain.remark ? ` · ${plain.remark}` : ''}`,
    meta: {
      order_id: plain.id,
      order_no: plain.order_no,
      amount: plain.amount,
      status: plain.status,
    },
  };
}

const CALL_STATUS_LABELS = {
  completed: '已接通',
  failed: '未接通',
  cancelled: '已取消',
  connected: '通话中',
  calling: '呼叫中',
  initiating: '发起中',
};

function mapCall(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.started_at, plain.connected_at, plain.created_at);
  if (!at) return null;
  const statusLabel = CALL_STATUS_LABELS[plain.status] || plain.status;
  const dur =
    plain.duration_seconds > 0 ? `${plain.duration_seconds} 秒` : plain.customer_phone || '';
  return {
    id: `call:${plain.id}`,
    type: 'call',
    at: at.toISOString(),
    title: `外呼 · ${statusLabel}`,
    summary: dur,
    meta: {
      call_id: plain.id,
      status: plain.status,
      duration_seconds: plain.duration_seconds,
      phone: plain.customer_phone,
    },
  };
}

function mapSms(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.sent_at, plain.created_at);
  if (!at) return null;
  const statusLabel =
    plain.status === 'success' ? '发送成功' : plain.status === 'failed' ? '发送失败' : '待发送';
  return {
    id: `sms:${plain.id}`,
    type: 'sms',
    at: at.toISOString(),
    title: `短信 · ${statusLabel}`,
    summary: plain.phone
      ? `${plain.phone}${plain.error_msg ? ` · ${plain.error_msg}` : ''}`
      : plain.template_code || '',
    meta: {
      sms_id: plain.id,
      status: plain.status,
      phone: plain.phone,
      template_code: plain.template_code,
    },
  };
}

/**
 * @param {object} auth
 * @param {number|string} customerId
 * @param {{ limit?: number }} query
 */
export async function getCustomerTimeline(auth, customerId, query = {}) {
  const customer = await getCustomer(auth, customerId);
  const cid = Number(customerId);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 80));
  const tenantId = auth.tenantId;

  const smsWhere = { tenant_id: tenantId };
  if (customer.phone) {
    smsWhere[Op.or] = [{ customer_id: cid }, { customer_id: null, phone: String(customer.phone).trim() }];
  } else {
    smsWhere.customer_id = cid;
  }

  const [
    followUps,
    weworkMsgs,
    inboxMsgs,
    tickets,
    orders,
    calls,
    smsLogs,
  ] = await Promise.all([
    CustomerFollowUp.findAll({
      where: { customer_id: cid },
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
      include: [{ model: User, as: 'author', attributes: ['id', 'username', 'real_name'] }],
    }),
    WeworkCustomerMessage.findAll({
      where: { tenant_id: tenantId, customer_id: cid },
      order: [['msg_time', 'DESC']],
      limit: PER_SOURCE,
      attributes: ['id', 'direction', 'msg_type', 'content', 'msg_time', 'created_at'],
    }),
    InboxMessage.findAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
      include: [
        {
          model: InboxThread,
          required: true,
          where: { tenant_id: tenantId, customer_id: cid },
          attributes: ['id', 'customer_id'],
          include: [{ model: OmniChannel, as: 'channel', attributes: ['code', 'name'] }],
        },
      ],
    }),
    ServiceTicket.findAll({
      where: { tenant_id: tenantId, customer_id: cid },
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
    }),
    CustomerOrder.findAll({
      where: { tenant_id: tenantId, customer_id: cid },
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
    }),
    CallRecord.findAll({
      where: { tenant_id: tenantId, customer_id: cid },
      order: [['started_at', 'DESC']],
      limit: PER_SOURCE,
    }),
    SmsSendLog.findAll({
      where: smsWhere,
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
    }),
  ]);

  const items = [
    ...followUps.map(mapFollowUp),
    ...weworkMsgs.map(mapWeworkMsg),
    ...inboxMsgs.map(mapInboxMsg),
    ...tickets.map(mapTicket),
    ...orders.map(mapOrder),
    ...calls.map(mapCall),
    ...smsLogs.map(mapSms),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);

  return { list: items, total: items.length };
}
