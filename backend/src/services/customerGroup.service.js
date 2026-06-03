/**
 * @file 客户群管理与群 SOP 服务。
 */
import Joi from 'joi';
import { fn, col, Op } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import {
  Customer,
  CustomerGroup,
  GroupMember,
  GroupSendLog,
  GroupSopTarget,
  GroupSopTask,
  Tenant,
  User,
} from '../models/index.js';
import { getAccessToken } from './wework.service.js';

const listGroupsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(200).default(20),
  name: Joi.string().trim().allow('', null).optional(),
  status: Joi.number().integer().valid(0, 1).optional(),
}).unknown(false);

const listSopSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('draft', 'active', 'paused', 'done').optional(),
}).unknown(false);

const createSopSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  description: Joi.string().allow('', null).optional(),
  msg_type: Joi.string().valid('text', 'image', 'link', 'miniprogram', 'markdown').required(),
  content_json: Joi.object().required(),
  trigger_type: Joi.string().valid('scheduled', 'recurring').required(),
  scheduled_at: Joi.date().allow(null).optional(),
  recurring_cron: Joi.string().max(64).allow('', null).optional(),
  recurring_desc: Joi.string().max(100).allow('', null).optional(),
  status: Joi.string().valid('draft', 'active', 'paused', 'done').default('draft'),
  group_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
}).unknown(false);

const sopStatusSchema = Joi.string().valid('draft', 'active', 'paused', 'done').required();

function maskWebhook(url) {
  const s = String(url || '');
  if (!s) return '';
  if (s.length <= 20) return `${s}***`;
  return `${s.slice(0, 20)}***`;
}

async function fetchGroupChatListPage(accessToken, cursor = '') {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/list?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status_filter: 0,
      owner_filter: { type: 0 },
      cursor,
      limit: 100,
    }),
  });
  const data = await res.json();
  if (Number(data.errcode) !== 0) {
    throw new Error(`同步群列表失败: ${data.errmsg || data.errcode}`);
  }
  return data;
}

async function fetchAllGroupChats(accessToken) {
  const groups = [];
  let cursor = '';
  do {
    const data = await fetchGroupChatListPage(accessToken, cursor);
    groups.push(...(data.group_chat_list || []));
    cursor = data.next_cursor || '';
  } while (cursor);
  return groups;
}

async function fetchGroupDetail(accessToken, chatId) {
  const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/groupchat/get?access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, need_name: 1 }),
  });
  const data = await res.json();
  if (Number(data.errcode) !== 0) {
    throw new Error(`拉取群详情失败(${chatId}): ${data.errmsg || data.errcode}`);
  }
  return data.group_chat || null;
}

async function sendViaWebhook(webhookUrl, content) {
  if (!webhookUrl) {
    throw new Error('该群未配置 webhook');
  }
  const msgType = content.msg_type === 'markdown' ? 'markdown' : 'text';
  const body =
    msgType === 'markdown'
      ? { msgtype: 'markdown', markdown: { content: String(content.text || '') } }
      : { msgtype: 'text', text: { content: String(content.text || '') } };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || Number(data.errcode) !== 0) {
    throw new Error(data.errmsg || `发送失败(${res.status})`);
  }
  return data;
}

function toGroupPlain(row) {
  const p = row.get({ plain: true });
  return {
    ...p,
    webhook_url: p.webhook_url ? maskWebhook(p.webhook_url) : null,
  };
}

/**
 * 同步租户的企微客户群与成员（仅落外部客户成员）。
 * @param {number} tenantId
 */
export async function syncGroups(tenantId) {
  const tenant = await Tenant.findByPk(Number(tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);

  const accessToken = await getAccessToken(tenant);
  const list = await fetchAllGroupChats(accessToken);
  if (list.length === 0) return { synced_groups: 0, synced_members: 0 };

  const ownerUserids = new Set();
  const groupDetails = [];

  for (const item of list) {
    const chatId = String(item.chat_id || '').trim();
    if (!chatId) continue;
    const detail = await fetchGroupDetail(accessToken, chatId);
    if (!detail) continue;
    groupDetails.push(detail);
    if (detail.owner) ownerUserids.add(String(detail.owner).trim());
  }

  const ownerMap = new Map();
  if (ownerUserids.size > 0) {
    const users = await User.findAll({
      where: { tenant_id: Number(tenantId), wework_userid: { [Op.in]: [...ownerUserids] } },
      attributes: ['id', 'wework_userid'],
      raw: true,
    });
    users.forEach((u) => ownerMap.set(String(u.wework_userid), Number(u.id)));
  }

  const now = new Date();
  let syncedGroups = 0;
  let syncedMembers = 0;

  for (const detail of groupDetails) {
    const chatId = String(detail.chat_id || '').trim();
    if (!chatId) continue;
    const ownerUserid = detail.owner ? String(detail.owner).trim() : null;
    const groupName = String(detail.name || '').trim() || '未命名群';
    const memberList = Array.isArray(detail.member_list) ? detail.member_list : [];

    await CustomerGroup.upsert({
      tenant_id: Number(tenantId),
      chat_id: chatId,
      name: groupName,
      owner_userid: ownerUserid || null,
      owner_user_id: ownerUserid ? ownerMap.get(ownerUserid) || null : null,
      member_count: memberList.length,
      notice: detail.notice || null,
      raw_json: detail,
      last_synced_at: now,
      status: 1,
    });
    syncedGroups += 1;

    const groupRow = await CustomerGroup.findOne({
      where: { tenant_id: Number(tenantId), chat_id: chatId },
      attributes: ['id'],
      raw: true,
    });
    if (!groupRow?.id) continue;
    const groupId = Number(groupRow.id);

    const externalMembers = memberList.filter((m) => Number(m.type) === 1 && m.userid);
    const externalUserids = [...new Set(externalMembers.map((m) => String(m.userid).trim()).filter(Boolean))];

    const customerMap = new Map();
    if (externalUserids.length > 0) {
      const customers = await Customer.findAll({
        where: {
          tenant_id: Number(tenantId),
          external_userid: { [Op.in]: externalUserids },
        },
        attributes: ['id', 'external_userid'],
        raw: true,
      });
      customers.forEach((c) => customerMap.set(String(c.external_userid), Number(c.id)));
    }

    const memberRows = externalMembers.map((m) => {
      const ext = String(m.userid || '').trim();
      const joinTs = Number(m.join_time || 0);
      return {
        tenant_id: Number(tenantId),
        group_id: groupId,
        external_userid: ext,
        wework_userid: null,
        member_type: 1,
        customer_id: customerMap.get(ext) || null,
        join_time: Number.isFinite(joinTs) && joinTs > 0 ? new Date(joinTs * 1000) : null,
        join_scene: m.join_scene != null ? Number(m.join_scene) : null,
      };
    });

    if (memberRows.length > 0) {
      await GroupMember.bulkCreate(memberRows, {
        updateOnDuplicate: ['wework_userid', 'member_type', 'customer_id', 'join_time', 'join_scene'],
      });
      syncedMembers += memberRows.length;
    }

    // 清理本群已不在企微返回中的外部成员（避免陈旧数据）
    if (externalUserids.length > 0) {
      await GroupMember.destroy({
        where: {
          tenant_id: Number(tenantId),
          group_id: groupId,
          member_type: 1,
          external_userid: { [Op.notIn]: externalUserids },
        },
      });
    } else {
      await GroupMember.destroy({
        where: { tenant_id: Number(tenantId), group_id: groupId, member_type: 1 },
      });
    }
  }

  return { synced_groups: syncedGroups, synced_members: syncedMembers };
}

/**
 * @param {number} tenantId
 * @param {object} query
 */
export async function listGroups(tenantId, query) {
  const { error, value } = listGroupsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const where = { tenant_id: Number(tenantId) };
  if (value.name) where.name = { [Op.like]: `%${value.name}%` };
  if (value.status != null) where.status = value.status;

  const { rows, count } = await CustomerGroup.findAndCountAll({
    where,
    include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'real_name'], required: false }],
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
  });

  return {
    list: rows.map((r) => toGroupPlain(r)),
    total: count,
    page: value.page,
    size: value.size,
  };
}

/**
 * @param {number} tenantId
 * @param {number} groupId
 * @param {{ page?: number; size?: number }} query
 */
export async function getGroupDetail(tenantId, groupId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(200, Math.max(1, Number(query.size) || 20));

  const group = await CustomerGroup.findOne({
    where: { id: Number(groupId), tenant_id: Number(tenantId) },
    include: [{ model: User, as: 'owner', attributes: ['id', 'username', 'real_name'], required: false }],
  });
  if (!group) throw new HttpError(404, '群不存在', 404);

  const { rows, count } = await GroupMember.findAndCountAll({
    where: { tenant_id: Number(tenantId), group_id: Number(groupId) },
    include: [
      {
        model: Customer,
        as: 'customer',
        attributes: ['id', 'name', 'intent_score', 'stage'],
        required: false,
      },
    ],
    order: [['id', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  return {
    group: toGroupPlain(group),
    members: rows.map((r) => r.get({ plain: true })),
    members_total: count,
    page,
    size,
  };
}

/**
 * @param {number} tenantId
 * @param {number} createdBy
 * @param {object} data
 */
export async function createSopTask(tenantId, createdBy, data) {
  const { error, value } = createSopSchema.validate(data || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  if (value.trigger_type === 'scheduled' && !value.scheduled_at) {
    throw new HttpError(400, 'scheduled 任务缺少 scheduled_at', 400);
  }
  if (value.trigger_type === 'recurring' && !value.recurring_cron) {
    throw new HttpError(400, 'recurring 任务缺少 recurring_cron', 400);
  }

  const groups = await CustomerGroup.findAll({
    where: { tenant_id: Number(tenantId), id: { [Op.in]: value.group_ids } },
    attributes: ['id'],
    raw: true,
  });
  const foundIds = new Set(groups.map((g) => Number(g.id)));
  if (foundIds.size !== value.group_ids.length) {
    throw new HttpError(400, '存在无效群 ID', 400);
  }

  const task = await GroupSopTask.create({
    tenant_id: Number(tenantId),
    name: value.name,
    description: value.description || null,
    msg_type: value.msg_type === 'markdown' ? 'text' : value.msg_type,
    content_json: value.content_json,
    trigger_type: value.trigger_type,
    scheduled_at: value.scheduled_at || null,
    recurring_cron: value.recurring_cron || null,
    recurring_desc: value.recurring_desc || null,
    status: value.status,
    created_by: Number(createdBy),
  });

  await GroupSopTarget.bulkCreate(
    value.group_ids.map((gid) => ({
      sop_task_id: task.id,
      group_id: Number(gid),
      tenant_id: Number(tenantId),
      last_sent_at: null,
      send_count: 0,
    })),
    { ignoreDuplicates: true },
  );

  return GroupSopTask.findByPk(task.id, {
    include: [{ model: GroupSopTarget, as: 'targets', required: false }],
  });
}

/**
 * @param {number} tenantId
 * @param {object} query
 */
export async function listSopTasks(tenantId, query) {
  const { error, value } = listSopSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const where = { tenant_id: Number(tenantId) };
  if (value.status) where.status = value.status;

  const { rows, count } = await GroupSopTask.findAndCountAll({
    where,
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'real_name'], required: false }],
    order: [['id', 'DESC']],
    limit: value.size,
    offset: (value.page - 1) * value.size,
  });

  const ids = rows.map((r) => Number(r.id));
  let targetCountMap = new Map();
  if (ids.length > 0) {
    const grouped = await GroupSopTarget.findAll({
      where: { tenant_id: Number(tenantId), sop_task_id: { [Op.in]: ids } },
      attributes: ['sop_task_id', [fn('COUNT', col('id')), 'target_count']],
      group: ['sop_task_id'],
      raw: true,
    });
    targetCountMap = new Map(grouped.map((g) => [Number(g.sop_task_id), Number(g.target_count || 0)]));
  }

  return {
    list: rows.map((r) => {
      const p = r.get({ plain: true });
      return { ...p, target_count: targetCountMap.get(Number(p.id)) || 0 };
    }),
    total: count,
    page: value.page,
    size: value.size,
  };
}

/**
 * @param {number} tenantId
 * @param {number} sopId
 * @param {'draft'|'active'|'paused'|'done'} status
 */
export async function updateSopStatus(tenantId, sopId, status) {
  const { error, value } = sopStatusSchema.validate(status);
  if (error) throw new HttpError(400, 'SOP 状态无效', 400);

  const sop = await GroupSopTask.findOne({
    where: { id: Number(sopId), tenant_id: Number(tenantId) },
  });
  if (!sop) throw new HttpError(404, 'SOP 任务不存在', 404);
  await sop.update({ status: value });
  return sop.get({ plain: true });
}

/**
 * 删除 SOP（仅 draft/paused）。
 * @param {number} tenantId
 * @param {number} sopId
 */
export async function deleteSopTask(tenantId, sopId) {
  const sop = await GroupSopTask.findOne({
    where: { id: Number(sopId), tenant_id: Number(tenantId) },
  });
  if (!sop) throw new HttpError(404, 'SOP 任务不存在', 404);
  if (!['draft', 'paused'].includes(String(sop.status))) {
    throw new HttpError(400, '仅草稿或暂停状态允许删除', 400);
  }
  await GroupSopTarget.destroy({ where: { tenant_id: Number(tenantId), sop_task_id: Number(sopId) } });
  await sop.destroy();
  return { id: Number(sopId), deleted: true };
}

/**
 * 执行 SOP 任务发送。
 * @param {number} sopTaskId
 */
export async function executeSopTask(sopTaskId) {
  const sop = await GroupSopTask.findByPk(Number(sopTaskId), {
    include: [
      {
        model: GroupSopTarget,
        as: 'targets',
        required: false,
        include: [{ model: CustomerGroup, as: 'group', required: false }],
      },
    ],
  });
  if (!sop) throw new HttpError(404, 'SOP 任务不存在', 404);

  const contentJson = sop.content_json || {};
  const content = {
    msg_type: contentJson.msg_type || sop.msg_type || 'text',
    text: contentJson.text || contentJson.content || '',
  };

  let sent = 0;
  let failed = 0;
  const logs = [];
  for (const target of sop.targets || []) {
    const group = target.group;
    if (!group) continue;

    const log = await GroupSendLog.create({
      tenant_id: sop.tenant_id,
      group_id: group.id,
      sop_task_id: sop.id,
      msg_type: content.msg_type,
      content_json: content,
      status: 'pending',
    });

    try {
      await sendViaWebhook(group.webhook_url, content);
      await log.update({ status: 'sent', sent_at: new Date(), error_msg: null });
      await target.update({
        last_sent_at: new Date(),
        send_count: Number(target.send_count || 0) + 1,
      });
      sent += 1;
      logs.push({ group_id: group.id, status: 'sent' });
    } catch (err) {
      await log.update({
        status: 'failed',
        sent_at: new Date(),
        error_msg: String(err?.message || err).slice(0, 500),
      });
      failed += 1;
      logs.push({ group_id: group.id, status: 'failed', error: String(err?.message || err) });
    }
  }

  return {
    sop_task_id: sop.id,
    total_targets: (sop.targets || []).length,
    sent,
    failed,
    logs,
  };
}

/**
 * 立即发送到单个群（手动发送）。
 * @param {number} tenantId
 * @param {number} groupId
 * @param {{ msg_type?: string; text?: string; content?: string }} content
 */
export async function sendToGroup(tenantId, groupId, content) {
  const group = await CustomerGroup.findOne({
    where: { tenant_id: Number(tenantId), id: Number(groupId) },
  });
  if (!group) throw new HttpError(404, '群不存在', 404);

  const payload = {
    msg_type: content?.msg_type === 'markdown' ? 'markdown' : 'text',
    text: content?.text || content?.content || '',
  };
  if (!String(payload.text).trim()) {
    throw new HttpError(400, '消息内容不能为空', 400);
  }

  const log = await GroupSendLog.create({
    tenant_id: Number(tenantId),
    group_id: Number(groupId),
    sop_task_id: null,
    msg_type: payload.msg_type,
    content_json: payload,
    status: 'pending',
  });

  try {
    await sendViaWebhook(group.webhook_url, payload);
    await log.update({ status: 'sent', sent_at: new Date(), error_msg: null });
    return { status: 'sent' };
  } catch (err) {
    await log.update({
      status: 'failed',
      sent_at: new Date(),
      error_msg: String(err?.message || err).slice(0, 500),
    });
    throw new HttpError(400, String(err?.message || err), 400);
  }
}

/**
 * 更新群 webhook（可清空）。
 * @param {number} tenantId
 * @param {number} groupId
 * @param {string | null} webhookUrl
 */
export async function updateGroupWebhook(tenantId, groupId, webhookUrl) {
  const group = await CustomerGroup.findOne({
    where: { tenant_id: Number(tenantId), id: Number(groupId) },
  });
  if (!group) throw new HttpError(404, '群不存在', 404);
  const next = String(webhookUrl || '').trim();
  await group.update({ webhook_url: next || null });
  return {
    id: group.id,
    webhook_masked: next ? maskWebhook(next) : '',
  };
}
