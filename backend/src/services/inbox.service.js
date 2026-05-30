/**
 * @file 统一收件箱：会话列表、消息、人工回复、Webhook 入站。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import {
  InboxThread,
  InboxMessage,
  OmniChannel,
  Customer,
  User,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { paginated } from '../utils/response.js';
import { customerWhereScope, isAdmin } from '../utils/permissions.js';
import { ensureWeworkChannel, syncWeworkHistory } from './inboxSync.service.js';
import { dispatchWeworkReplyForThread, mirrorOutboundToWeworkMessages } from './inboxWeworkSend.service.js';
import {
  enrichThreads,
  filterEnrichedThreads,
  sortEnrichedThreads,
} from './inboxThreadEnrich.service.js';
import {
  syncCustomerStageFromInboxThread,
  crmStageLabel,
} from './salesStageSync.service.js';

async function getThreadScoped(auth, threadId) {
  const thread = await InboxThread.findOne({
    where: { id: threadId, tenant_id: auth.tenantId },
    include: [
      { model: OmniChannel, as: 'channel', attributes: ['id', 'code', 'name'] },
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone', 'stage', 'external_userid'] },
      { model: User, as: 'assignee', attributes: ['id', 'username', 'real_name'] },
    ],
  });
  if (!thread) {
    throw new HttpError(404, '会话不存在', 404);
  }
  if (!isAdmin(auth) && thread.assignee_id && Number(thread.assignee_id) !== Number(auth.userId)) {
    const cust = thread.customer_id
      ? await Customer.findOne({
          where: { id: thread.customer_id, ...customerWhereScope(auth) },
        })
      : null;
    if (!cust) {
      throw new HttpError(403, '无权访问该会话', 403);
    }
  }
  return thread;
}

export async function listThreads(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const sort = String(query.sort || 'priority');
  const filter = String(query.filter || 'all');

  const where = { tenant_id: auth.tenantId };
  if (query.status) where.status = String(query.status);
  if (filter === 'pending_human') where.status = 'pending_human';
  if (query.customer_id) {
    where.customer_id = Number(query.customer_id);
  }
  if (query.channel_code) {
    const ch = await OmniChannel.findOne({
      where: { tenant_id: auth.tenantId, code: String(query.channel_code) },
    });
    if (ch) where.channel_id = ch.id;
  }
  if (!isAdmin(auth)) {
    const ids = await customerIdsForUser(auth);
    const or = [{ assignee_id: auth.userId }, { assignee_id: null }];
    if (ids.length) or.push({ customer_id: { [Op.in]: ids } });
    where[Op.or] = or;
  }

  const usePriority = sort === 'priority' || filter !== 'all';
  const fetchCap = usePriority ? Math.min(500, Math.max(size * 5, 100)) : size;
  const fetchOffset = usePriority ? 0 : (page - 1) * size;

  const { rows, count: dbCount } = await InboxThread.findAndCountAll({
    where,
    limit: fetchCap,
    offset: fetchOffset,
    order: [['last_message_at', 'DESC']],
    include: [
      { model: OmniChannel, as: 'channel', attributes: ['code', 'name'] },
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone', 'stage'] },
    ],
  });

  let plain = rows.map((r) => r.get({ plain: true }));
  plain = await enrichThreads(plain, auth.tenantId);
  plain = filterEnrichedThreads(plain, filter);
  plain = sortEnrichedThreads(plain, sort);

  const total = usePriority ? plain.length : dbCount;
  const list = usePriority ? plain.slice((page - 1) * size, page * size) : plain;

  return paginated(list, total, page, size);
}

async function customerIdsForUser(auth) {
  const list = await Customer.findAll({
    where: customerWhereScope(auth),
    attributes: ['id'],
    limit: 5000,
  });
  return list.map((c) => c.id);
}

export async function getThreadMessages(auth, threadId, query) {
  await getThreadScoped(auth, threadId);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const rows = await InboxMessage.findAll({
    where: { tenant_id: auth.tenantId, thread_id: threadId },
    order: [['created_at', 'DESC']],
    limit,
  });
  return { list: rows.map((r) => r.get({ plain: true })).reverse() };
}

const replySchema = Joi.object({
  content: Joi.string().trim().min(1).max(4000).required(),
}).unknown(false);

export async function replyThread(auth, threadId, body) {
  const { error, value } = replySchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const thread = await getThreadScoped(auth, threadId);
  const now = new Date();
  const channelMsgId = `staff:${auth.userId}:${now.getTime()}`;
  let weworkSend = null;
  try {
    weworkSend = await dispatchWeworkReplyForThread(auth.tenantId, thread, value.content, {
      userId: auth.userId,
    });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(502, e instanceof Error ? e.message : '企微发送失败', 502);
  }

  const msg = await InboxMessage.create({
    tenant_id: auth.tenantId,
    thread_id: thread.id,
    channel_message_id: channelMsgId,
    direction: 'staff',
    sender_role: 'staff',
    content: value.content,
    msg_type: 'text',
    risk_level: 'p0',
    raw_payload: { user_id: auth.userId, manual: true, wework_send: weworkSend },
  });
  await thread.update({
    last_message_at: now,
    assignee_id: thread.assignee_id || auth.userId,
  });
  if (weworkSend?.sent) {
    const meta =
      thread.metadata_json && typeof thread.metadata_json === 'object' ? thread.metadata_json : {};
    await mirrorOutboundToWeworkMessages({
      tenantId: auth.tenantId,
      customerId: thread.customer_id,
      externalUserid: weworkSend.external_userid ?? meta.external_userid,
      staffUserid: weworkSend.sender_userid ?? meta.staff_userid,
      content: value.content,
      channelMessageId,
      msgTime: now,
    });
  }

  const plain = msg.get({ plain: true });
  return { ...plain, wework_send: weworkSend };
}

const webhookSchema = Joi.object({
  external_thread_key: Joi.string().trim().min(1).max(128).required(),
  customer_id: Joi.number().integer().positive().optional(),
  external_userid: Joi.string().trim().max(64).allow('', null).optional(),
  direction: Joi.string().valid('customer', 'staff', 'system').default('customer'),
  content: Joi.string().trim().max(8000).allow('', null).optional(),
  msg_type: Joi.string().trim().max(32).default('text'),
  channel_message_id: Joi.string().trim().max(96).optional(),
}).unknown(false);

export async function ingestWebhook(auth, channelCode, body) {
  const { error, value } = webhookSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const code = String(channelCode || 'custom').toLowerCase();
  const channelLabels = {
    douyin: '抖音私信',
    xiaohongshu: '小红书',
    wechat_mp: '微信公众号',
    wework: '企业微信',
  };
  const [channel] = await OmniChannel.findOrCreate({
    where: { tenant_id: auth.tenantId, code },
    defaults: {
      tenant_id: auth.tenantId,
      code,
      name: channelLabels[code] || code,
      status: 1,
    },
  });

  let thread = await InboxThread.findOne({
    where: {
      tenant_id: auth.tenantId,
      channel_id: channel.id,
      external_thread_key: value.external_thread_key,
    },
  });
  const now = new Date();
  if (!thread) {
    thread = await InboxThread.create({
      tenant_id: auth.tenantId,
      channel_id: channel.id,
      customer_id: value.customer_id ?? null,
      external_thread_key: value.external_thread_key,
      assignee_id: auth.userId ?? null,
      last_message_at: now,
      last_customer_message_at: value.direction === 'customer' ? now : null,
      metadata_json: { external_userid: value.external_userid },
    });
  } else {
    await thread.update({
      last_message_at: now,
      ...(value.direction === 'customer' ? { last_customer_message_at: now } : {}),
    });
  }

  const msgId =
    value.channel_message_id || `webhook:${code}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`;

  if (value.channel_message_id) {
    const existing = await InboxMessage.findOne({
      where: {
        tenant_id: auth.tenantId,
        thread_id: thread.id,
        channel_message_id: String(value.channel_message_id),
      },
    });
    if (existing) {
      return {
        thread: thread.get({ plain: true }),
        message: existing.get({ plain: true }),
        deduplicated: true,
      };
    }
  }

  const msg = await InboxMessage.create({
    tenant_id: auth.tenantId,
    thread_id: thread.id,
    channel_message_id: msgId,
    direction: value.direction,
    sender_role: value.direction,
    content: value.content ?? null,
    msg_type: value.msg_type,
    risk_level: 'p0',
    raw_payload: body,
  });
  return { thread: thread.get({ plain: true }), message: msg.get({ plain: true }) };
}

export async function runWeworkSync(auth, body) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  await ensureWeworkChannel(auth.tenantId);
  return syncWeworkHistory(auth.tenantId, { limit: body?.limit });
}

export async function updateThread(auth, threadId, body) {
  const thread = await getThreadScoped(auth, threadId);
  const patch = {};
  if (body.status) patch.status = body.status;
  if (body.sales_stage) patch.sales_stage = body.sales_stage;
  if (body.assignee_id != null) patch.assignee_id = body.assignee_id;
  if (Object.keys(patch).length === 0) {
    throw new HttpError(400, '无有效更新字段', 400);
  }
  await thread.update(patch);

  let stageSync = null;
  if (body.sales_stage && thread.customer_id) {
    stageSync = await syncCustomerStageFromInboxThread(thread);
  }

  const reloaded = await InboxThread.findByPk(thread.id, {
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone', 'stage', 'external_userid'] },
    ],
  });
  const plain = reloaded?.get({ plain: true }) || thread.get({ plain: true });
  if (plain.Customer?.stage) {
    plain.crm_stage_label = crmStageLabel(plain.Customer.stage);
  }
  if (stageSync) plain.stage_sync = stageSync;
  return plain;
}
