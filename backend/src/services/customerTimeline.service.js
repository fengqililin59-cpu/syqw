/**
 * @file 客户 360° 统一时间线：聚合跟进、企微、收件箱、工单、订单、通话、短信。
 */
import { Op } from 'sequelize';
import {
  AuditLog,
  AiGenerationLog,
  AiReplyLog,
  CustomerFollowUp,
  WeworkCustomerMessage,
  InboxMessage,
  InboxThread,
  OmniChannel,
  ServiceTicket,
  CustomerOrder,
  CallRecord,
  SmsSendLog,
  IntentAlert,
  User,
} from '../models/index.js';
import { getCustomer } from './customer.service.js';

const PER_SOURCE = 60;

const STAGE_LABELS = {
  new: '新线索',
  intent_confirm: '意向确认',
  contacted: '意向确认',
  intent: '意向确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  deal: '成交',
  won: '成交',
  lost: '流失',
};

const AI_KIND_LABELS = {
  reply_suggestions: 'AI 话术建议',
  intent_score: 'AI 意向评分',
  follow_up_draft: 'AI 跟进草稿',
  script: 'AI 文案',
};

const STAGE_AUDIT_ACTIONS = [
  'customer_stage_change',
  'customer_stage_auto_change',
  'customer_stage_rollback',
];

function truncateText(s, max = 160) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function stageLabel(code) {
  return STAGE_LABELS[String(code || '').trim()] || code || '—';
}

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

function mapCustomerCreated(customer) {
  const at = pickTime(customer.created_at);
  if (!at) return null;
  return {
    id: `customer_created:${customer.id}`,
    type: 'customer_created',
    at: at.toISOString(),
    title: '客户建档',
    summary: customer.source ? `来源：${customer.source}` : '客户已加入 CRM',
    meta: { source: customer.source || null },
  };
}

function mapAuditStage(row) {
  const plain = row.get({ plain: true });
  if (!STAGE_AUDIT_ACTIONS.includes(plain.action)) return null;
  const at = pickTime(plain.created_at);
  if (!at) return null;
  const d = plain.detail_json || {};
  const from = stageLabel(d.from_stage);
  const to = stageLabel(d.to_stage);
  const sourceMap = {
    manual: '手动调整',
    flow: '自动化流程',
    order: '订单成交',
  };
  const source = sourceMap[d.source] || d.source || '';
  const title =
    plain.action === 'customer_stage_rollback'
      ? '阶段回滚'
      : plain.action === 'customer_stage_auto_change'
        ? '阶段自动变更'
        : '阶段变更';
  return {
    id: `audit:${plain.id}`,
    type: 'stage_change',
    at: at.toISOString(),
    title,
    summary: `${from} → ${to}${source ? ` · ${source}` : ''}`,
    meta: {
      from_stage: d.from_stage,
      to_stage: d.to_stage,
      source: d.source,
      author: plain.actor?.real_name || plain.actor?.username,
    },
  };
}

function mapAiGeneration(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.created_at);
  if (!at) return null;
  const kindLabel = AI_KIND_LABELS[plain.kind] || 'AI 辅助';
  let snippet = truncateText(plain.input_message, 120);
  if (!snippet && plain.output_json) {
    const o = plain.output_json;
    if (typeof o.suggestion === 'string') snippet = truncateText(o.suggestion, 120);
    else if (Array.isArray(o.suggestions) && o.suggestions[0]) {
      snippet = truncateText(String(o.suggestions[0]), 120);
    }
  }
  return {
    id: `ai_generation:${plain.id}`,
    type: 'ai',
    at: at.toISOString(),
    title: kindLabel,
    summary: snippet || '已生成 AI 内容',
    meta: {
      kind: plain.kind,
      author: plain.User?.real_name || plain.User?.username,
    },
  };
}

function mapIntentAlert(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.created_at, plain.sent_at);
  if (!at) return null;
  return {
    id: `intent_alert:${plain.id}`,
    type: 'intent_alert',
    at: at.toISOString(),
    title: '意向分跃升',
    summary: `${plain.score_before} → ${plain.score_after}（+${plain.score_delta}）`,
    meta: {
      score_before: plain.score_before,
      score_after: plain.score_after,
      status: plain.status,
    },
  };
}

function mapAiReply(row) {
  const plain = row.get({ plain: true });
  const at = pickTime(plain.updated_at, plain.created_at);
  if (!at) return null;
  const statusLabel =
    plain.status === 'approved' || plain.status === 'sent'
      ? 'AI 草稿已采纳'
      : plain.status === 'rejected'
        ? 'AI 草稿已驳回'
        : 'AI 回复草稿';
  const content = plain.final_content || plain.draft_content;
  return {
    id: `ai_reply:${plain.id}`,
    type: 'ai',
    at: at.toISOString(),
    title: statusLabel,
    summary: truncateText(content, 160),
    meta: {
      thread_id: plain.thread_id,
      status: plain.status,
      risk_level: plain.risk_level,
      author: plain.approver?.real_name || plain.approver?.username,
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
function buildTimelineSummary(items, customer) {
  const lastAt = items[0]?.at || customer.created_at;
  const lastMs = lastAt ? new Date(lastAt).getTime() : null;
  const daysSince =
    lastMs && !Number.isNaN(lastMs)
      ? Math.max(0, Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000)))
      : null;
  const counts = {};
  for (const it of items) {
    counts[it.type] = (counts[it.type] || 0) + 1;
  }
  return {
    last_touch_at: lastAt ? new Date(lastAt).toISOString() : null,
    days_since_touch: daysSince,
    counts,
    total_events: items.length,
    customer_created_at: customer.created_at,
    current_stage: customer.stage,
  };
}

export async function getCustomerTimeline(auth, customerId, query = {}) {
  const customer = await getCustomer(auth, customerId);
  const cid = Number(customerId);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 80));
  const typeFilter = query.types
    ? String(query.types)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null;
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
    auditLogs,
    aiGenerations,
    intentAlerts,
    aiReplies,
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
    AuditLog.findAll({
      where: {
        tenant_id: tenantId,
        target_type: 'customer',
        target_id: String(cid),
        action: STAGE_AUDIT_ACTIONS,
      },
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
      include: [{ model: User, as: 'actor', attributes: ['id', 'username', 'real_name'] }],
    }).catch(() => []),
    AiGenerationLog.findAll({
      where: { tenant_id: tenantId, customer_id: cid },
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
      include: [{ model: User, attributes: ['id', 'username', 'real_name'] }],
    }).catch(() => []),
    IntentAlert.findAll({
      where: { tenant_id: tenantId, customer_id: cid },
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
    }).catch(() => []),
    AiReplyLog.findAll({
      order: [['created_at', 'DESC']],
      limit: PER_SOURCE,
      include: [
        {
          model: InboxThread,
          required: true,
          where: { tenant_id: tenantId, customer_id: cid },
          attributes: ['id'],
        },
        { model: User, as: 'approver', attributes: ['id', 'username', 'real_name'], required: false },
      ],
    }).catch(() => []),
  ]);

  const merged = [
    mapCustomerCreated(customer),
    ...followUps.map(mapFollowUp),
    ...weworkMsgs.map(mapWeworkMsg),
    ...inboxMsgs.map(mapInboxMsg),
    ...tickets.map(mapTicket),
    ...orders.map(mapOrder),
    ...calls.map(mapCall),
    ...smsLogs.map(mapSms),
    ...auditLogs.map(mapAuditStage),
    ...aiGenerations.map(mapAiGeneration),
    ...intentAlerts.map(mapIntentAlert),
    ...aiReplies.map(mapAiReply),
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const summary = buildTimelineSummary(merged, customer);

  let items = merged;
  if (typeFilter?.length) {
    items = items.filter((it) => typeFilter.includes(it.type));
  }
  items = items.slice(0, limit);

  return { list: items, total: items.length, summary };
}
