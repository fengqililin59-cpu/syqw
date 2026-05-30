/**
 * @file AI 员工：回复草稿、审核发送、运营统计。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import {
  AiReplyLog,
  InboxThread,
  InboxMessage,
  InboxFollowupTask,
  Customer,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import * as aiContentService from './aiContent.service.js';
import { env } from '../config/env.js';
import { replyThread } from './inbox.service.js';
import { countSlaOverdueThreads } from './inboxSlaReminder.service.js';
import { countOpenTickets } from './ticket.service.js';
import { formatKbContext } from './kbSearch.service.js';

const CONFIDENCE_AUTO_THRESHOLD = 0.75;

function classifyRisk(text) {
  const t = String(text || '').toLowerCase();
  if (/退款|投诉|举报|律师|工商|诈骗|违法/.test(t)) {
    return { risk: 'p2', intent: 'complaint' };
  }
  if (/价格|多少钱|优惠|折扣|合同|报价|底价|返点/.test(t)) {
    return { risk: 'p1', intent: 'pricing' };
  }
  if (/资料|介绍|怎么用|是什么|有没有/.test(t)) {
    return { risk: 'p0', intent: 'faq' };
  }
  return { risk: 'p1', intent: 'general' };
}

async function kbSnippet(tenantId, queryText, limit = 3) {
  return formatKbContext(tenantId, queryText, limit);
}

const draftSchema = Joi.object({
  thread_id: Joi.number().integer().positive().required(),
  message: Joi.string().trim().min(1).max(2000).optional(),
  trigger_message_id: Joi.number().integer().positive().optional(),
}).unknown(false);

export async function createReplyDraft(auth, body) {
  const { error, value } = draftSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const thread = await InboxThread.findOne({
    where: { id: value.thread_id, tenant_id: auth.tenantId },
    include: [
      {
        model: Customer,
        attributes: ['id', 'name', 'nickname', 'stage', 'intent_score', 'intent_tier', 'phone', 'source'],
      },
    ],
  });
  if (!thread) {
    throw new HttpError(404, '会话不存在', 404);
  }

  let triggerText = value.message?.trim() || '';
  let triggerMsgId = value.trigger_message_id ?? null;
  if (!triggerText) {
    const last = await InboxMessage.findOne({
      where: { thread_id: thread.id, direction: 'customer' },
      order: [['created_at', 'DESC']],
    });
    triggerText = last?.content ? String(last.content) : '你好';
    triggerMsgId = triggerMsgId ?? last?.id ?? null;
  }

  const { risk, intent } = classifyRisk(triggerText);
  const kb = await kbSnippet(auth.tenantId, triggerText);
  let draft = '';
  let confidence = 0.72;
  let model = 'template';

  if (thread.customer_id) {
    const cust = thread.Customer;
    const profileHint = [
      cust?.name || cust?.nickname ? `称呼：${cust.name || cust.nickname}` : null,
      cust?.stage ? `阶段：${cust.stage}` : null,
      cust?.intent_score != null ? `意向分：${cust.intent_score}` : null,
      cust?.intent_tier ? `意向层级：${cust.intent_tier}` : null,
      cust?.source ? `来源：${cust.source}` : null,
    ]
      .filter(Boolean)
      .join('；');

    try {
      const data = await aiContentService.generateSalesReplySuggestions(auth, {
        customer_id: Number(thread.customer_id),
        message: profileHint ? `${triggerText}\n（客户画像：${profileHint}）` : triggerText,
      });
      draft = data.replies?.[1] || data.replies?.[0] || '';
      confidence = 0.82;
      model = 'sales_reply_suggestions';
    } catch {
      draft = `您好，收到您的消息「${triggerText.slice(0, 40)}」。我这边为您整理一下方案，方便留个常用联系方式吗？`;
      confidence = 0.55;
    }
  } else {
    draft = `您好，已收到您的咨询。${kb ? `参考说明：${kb.slice(0, 120)}…` : '稍后由顾问为您详细解答。'}`;
    confidence = 0.6;
  }

  if (kb && draft.length < 400) {
    draft = `${draft}\n\n（知识库参考）\n${kb.slice(0, 400)}`;
  }

  const requiresApproval = risk !== 'p0' || confidence < CONFIDENCE_AUTO_THRESHOLD;
  if (risk === 'p2') {
    await thread.update({ status: 'pending_human' });
  }

  const log = await AiReplyLog.create({
    tenant_id: auth.tenantId,
    thread_id: thread.id,
    trigger_message_id: triggerMsgId,
    intent,
    confidence,
    risk_level: risk,
    draft_content: draft,
    status: requiresApproval ? 'draft' : 'draft',
    model,
  });

  return {
    log_id: log.id,
    draft_content: draft,
    intent,
    confidence,
    risk_level: risk,
    requires_approval: requiresApproval,
    thread_status: thread.status,
  };
}

const approveSchema = Joi.object({
  log_id: Joi.number().integer().positive().required(),
  action: Joi.string().valid('approve', 'reject').required(),
  edited_content: Joi.string().trim().max(4000).allow('', null).optional(),
}).unknown(false);

export async function approveReply(auth, body) {
  const { error, value } = approveSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const log = await AiReplyLog.findOne({
    where: { id: value.log_id, tenant_id: auth.tenantId },
  });
  if (!log) {
    throw new HttpError(404, '审核记录不存在', 404);
  }
  if (log.status !== 'draft') {
    throw new HttpError(400, '该记录已处理', 400);
  }

  if (value.action === 'reject') {
    await log.update({
      status: 'rejected',
      approved_by: auth.userId,
      final_content: value.edited_content || null,
    });
    return log.get({ plain: true });
  }

  const finalText = (value.edited_content || log.draft_content || '').trim();
  if (!finalText) {
    throw new HttpError(400, '回复内容为空', 400);
  }

  await log.update({
    status: 'approved',
    approved_by: auth.userId,
    final_content: finalText,
  });

  const sent = await replyThread(auth, log.thread_id, { content: finalText });
  await log.update({ status: 'approved' });

  return {
    log: log.get({ plain: true }),
    sent_message: sent,
  };
}

export async function listPendingReplies(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(50, Math.max(1, Number(query.size) || 20));
  const where = {
    tenant_id: auth.tenantId,
    status: query.status ? String(query.status) : 'draft',
  };
  const { rows, count } = await AiReplyLog.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['created_at', 'DESC']],
    include: [
      {
        model: InboxThread,
        attributes: ['id', 'customer_id', 'status', 'sales_stage'],
        include: [{ model: Customer, attributes: ['id', 'name', 'nickname'] }],
      },
    ],
  });
  return {
    list: rows.map((r) => r.get({ plain: true })),
    total: count,
    page,
    size,
  };
}

export async function getOpsStats(auth, query) {
  const days = Math.min(90, Math.max(1, Number(query.days) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [threadOpen, msgTotal, aiDraft, aiApproved, pendingHuman, followOpen] = await Promise.all([
    InboxThread.count({
      where: { tenant_id: auth.tenantId, status: 'open' },
    }),
    InboxMessage.count({
      where: { tenant_id: auth.tenantId, created_at: { [Op.gte]: since } },
    }),
    AiReplyLog.count({
      where: { tenant_id: auth.tenantId, created_at: { [Op.gte]: since } },
    }),
    AiReplyLog.count({
      where: { tenant_id: auth.tenantId, status: 'approved', created_at: { [Op.gte]: since } },
    }),
    InboxThread.count({
      where: { tenant_id: auth.tenantId, status: 'pending_human' },
    }),
    InboxFollowupTask.count({
      where: { tenant_id: auth.tenantId, status: 'open' },
    }),
  ]);

  const customerMsgs = await InboxMessage.count({
    where: {
      tenant_id: auth.tenantId,
      direction: 'customer',
      created_at: { [Op.gte]: since },
    },
  });
  const staffMsgs = await InboxMessage.count({
    where: {
      tenant_id: auth.tenantId,
      direction: { [Op.in]: ['staff', 'ai'] },
      created_at: { [Op.gte]: since },
    },
  });

  const autoReplyRate =
    msgTotal > 0 ? Math.round((aiApproved / Math.max(1, customerMsgs)) * 10000) / 100 : 0;

  const slaOverdue = await countSlaOverdueThreads(auth.tenantId);
  const openTickets = await countOpenTickets(auth.tenantId);

  return {
    days,
    sla_minutes: env.inboxSlaMinutes,
    sla_overdue_threads: slaOverdue,
    open_service_tickets: openTickets,
    open_threads: threadOpen,
    pending_human_threads: pendingHuman,
    messages_in_period: msgTotal,
    customer_messages: customerMsgs,
    staff_or_ai_replies: staffMsgs,
    ai_drafts_created: aiDraft,
    ai_replies_approved: aiApproved,
    auto_reply_rate_percent: autoReplyRate,
    open_followup_tasks: followOpen,
  };
}
