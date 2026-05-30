/**
 * @file 群发任务：筛选客户、受众明细、mock / 企微 add_msg_template 执行。
 */
import Joi from 'joi';
import XLSX from 'xlsx';
import { Op } from 'sequelize';
import {
  sequelize,
  Tenant,
  User,
  Customer,
  Tag,
  BroadcastTask,
  BroadcastTaskRecipient,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin, customerWhereScope } from '../utils/permissions.js';
import { paginated } from '../utils/response.js';
import { addMsgTemplate } from './weworkBroadcast.service.js';
import { writeAuditLog } from './auditLog.service.js';
import * as billingService from './billing.service.js';

const CHANNELS = ['wecom_mass', 'mock'];
const STATUSES = ['draft', 'scheduled', 'sending', 'done', 'failed', 'cancelled'];

const createSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required(),
  channel: Joi.string()
    .valid(...CHANNELS)
    .required(),
  content: Joi.alternatives().try(Joi.string().min(1), Joi.object()).required(),
  filter_json: Joi.object({
    tag_ids: Joi.array().items(Joi.number().integer().positive()).default([]),
    stage: Joi.string().trim().max(32).allow('', null),
  }).default({}),
  scheduled_at: Joi.date().allow(null),
  run_now: Joi.boolean().default(true),
}).unknown(false);

function serializeContent(content) {
  if (typeof content === 'object' && content !== null) {
    return JSON.stringify(content);
  }
  return JSON.stringify({ msg_type: 'text', text: String(content) });
}

export function parseBroadcastContent(text) {
  if (!text) return { msg_type: 'text', text: '' };
  try {
    return JSON.parse(text);
  } catch {
    return { msg_type: 'text', text: String(text) };
  }
}

function deriveMsgType(parsed) {
  const t = parsed?.msg_type;
  if (t === 'image' || t === 'link' || t === 'miniprogram' || t === 'text') {
    return t;
  }
  return 'text';
}

async function findCustomersForBroadcast(auth, filterJson) {
  const tagIds = Array.isArray(filterJson?.tag_ids)
    ? filterJson.tag_ids.map((x) => Number(x)).filter((n) => !Number.isNaN(n) && n > 0)
    : [];
  const stageRaw = filterJson?.stage;
  const stage =
    stageRaw != null && String(stageRaw).trim() !== '' ? String(stageRaw).trim() : null;

  const where = {
    [Op.and]: [
      { ...customerWhereScope(auth) },
      sequelize.where(
        sequelize.fn('COALESCE', sequelize.col('external_userid'), ''),
        Op.ne,
        '',
      ),
    ],
  };
  if (stage) {
    where.stage = stage;
  }

  /** @type {object[]} */
  const includes = [{ model: User, as: 'owner', attributes: ['id', 'wework_userid'] }];
  if (tagIds.length) {
    includes.push({
      model: Tag,
      as: 'tags',
      attributes: [],
      required: true,
      where: { id: { [Op.in]: tagIds }, tenant_id: auth.tenantId },
      through: { attributes: [] },
    });
  }

  const rows = await Customer.findAll({
    where,
    include: includes,
    distinct: true,
    col: 'id',
    subQuery: false,
  });
  return rows;
}

function buildAttachmentsFromContent(parsed) {
  const attachments = [];
  const mt = parsed.msg_type || 'text';
  if (mt === 'image' && parsed.image?.media_id) {
    attachments.push({
      msgtype: 'image',
      image: { media_id: parsed.image.media_id },
    });
  } else if (mt === 'link' && parsed.link) {
    attachments.push({
      msgtype: 'link',
      link: {
        title: parsed.link.title || '',
        picurl: parsed.link.picurl || parsed.link.pic_url || '',
        desc: parsed.link.desc || '',
        url: parsed.link.url || '',
      },
    });
  } else if (mt === 'miniprogram' && parsed.miniprogram) {
    attachments.push({
      msgtype: 'miniprogram',
      miniprogram: {
        title: parsed.miniprogram.title || '',
        pic_media_id: parsed.miniprogram.pic_media_id || '',
        appid: parsed.miniprogram.appid || '',
        page: parsed.miniprogram.page || '',
      },
    });
  }
  return attachments;
}

function textFromParsed(parsed) {
  if (parsed.text && typeof parsed.text === 'string') {
    return parsed.text;
  }
  if (typeof parsed.text === 'object' && parsed.text?.content) {
    return String(parsed.text.content);
  }
  return typeof parsed.text === 'string' ? parsed.text : '';
}

/**
 * 创建任务并生成受众行；视 run_now 异步执行。
 */
export async function createBroadcastTask(auth, body, context = {}) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const { error, value } = createSchema.validate(body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }

  const customers = await findCustomersForBroadcast(auth, value.filter_json);
  if (!customers.length) {
    throw new HttpError(400, '没有符合条件的客户（需有企微 external_userid）', 400);
  }

  const now = new Date();
  const scheduled = value.scheduled_at ? new Date(value.scheduled_at) : null;
  const isFuture = scheduled && scheduled.getTime() > now.getTime() + 5000;
  let status = 'draft';
  if (isFuture) {
    status = 'scheduled';
  } else if (value.run_now) {
    status = 'sending';
  }

  const contentStr = serializeContent(value.content);
  const parsedForType = parseBroadcastContent(contentStr);
  const msgType = deriveMsgType(parsedForType);
  const task = await BroadcastTask.create({
    tenant_id: auth.tenantId,
    name: value.name,
    channel: value.channel,
    content: contentStr,
    msg_type: msgType,
    filter_json: value.filter_json,
    status,
    scheduled_at: scheduled,
    created_by: auth.userId,
    stats_json: { target: customers.length, success: 0, fail: 0 },
  });

  const recipientRows = customers.map((c) => ({
    broadcast_task_id: task.id,
    customer_id: c.id,
    send_status: 'pending',
  }));
  await BroadcastTaskRecipient.bulkCreate(recipientRows);

  const plain = task.get({ plain: true });
  if (status === 'sending' && value.run_now) {
    await writeAuditLog(auth, {
      action: 'broadcast_send',
      targetType: 'broadcast_task',
      targetId: task.id,
      detail: {
        channel: plain.channel,
        msg_type: plain.msg_type,
        recipient_count: customers.length,
        trigger: 'create_run_now',
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }
  if (status === 'sending' && value.run_now) {
    setImmediate(() => {
      runBroadcastTask(plain.id).catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[broadcast] runBroadcastTask', e);
      });
    });
  }

  return {
    ...plain,
    content: parseBroadcastContent(plain.content),
    recipient_count: customers.length,
  };
}

async function getTaskScoped(auth, id) {
  const row = await BroadcastTask.findOne({
    where: { id, tenant_id: auth.tenantId },
  });
  if (!row) {
    throw new HttpError(404, '任务不存在', 404);
  }
  return row;
}

export async function listBroadcastTasks(auth, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: auth.tenantId };
  if (query.status && STATUSES.includes(String(query.status))) {
    where.status = String(query.status);
  }
  const { rows, count } = await BroadcastTask.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['created_at', 'DESC']],
  });
  return paginated(
    rows.map((r) => {
      const p = r.get({ plain: true });
      return { ...p, content: parseBroadcastContent(p.content) };
    }),
    count,
    page,
    size,
  );
}

export async function getBroadcastTask(auth, id) {
  const row = await getTaskScoped(auth, id);
  const p = row.get({ plain: true });
  return { ...p, content: parseBroadcastContent(p.content) };
}

export async function cancelBroadcastTask(auth, id) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const row = await getTaskScoped(auth, id);
  if (!['draft', 'scheduled', 'sending'].includes(row.status)) {
    throw new HttpError(400, '当前状态不可取消', 400);
  }
  if (row.status === 'sending') {
    await row.update({
      status: 'cancelled',
      finished_at: new Date(),
      error_message: '发送中已人工取消',
    });
  } else {
    await row.update({ status: 'cancelled', error_message: '已取消' });
  }
  const p = row.get({ plain: true });
  return { ...p, content: parseBroadcastContent(p.content) };
}

export async function getBroadcastTaskRecipients(auth, id, query) {
  await getTaskScoped(auth, id);
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(200, Math.max(1, Number(query.size) || 50));
  const where = { broadcast_task_id: id };
  if (query.send_status) {
    where.send_status = String(query.send_status);
  }
  const { rows, count } = await BroadcastTaskRecipient.findAndCountAll({
    where,
    limit: size,
    offset: (page - 1) * size,
    order: [['id', 'ASC']],
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'external_userid', 'stage'] },
    ],
  });
  return paginated(
    rows.map((r) => r.get({ plain: true })),
    count,
    page,
    size,
  );
}

/**
 * 重试或启动草稿/定时任务（到达时间后由人工或此接口触发）。
 */
export async function runBroadcastTaskNow(auth, id, context = {}) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '需要管理员权限', 403);
  }
  const row = await getTaskScoped(auth, id);
  if (!['draft', 'scheduled', 'failed'].includes(row.status)) {
    throw new HttpError(400, '当前状态不可执行', 400);
  }
  await row.update({ status: 'sending', started_at: new Date(), error_message: null });
  await writeAuditLog(auth, {
    action: 'broadcast_send',
    targetType: 'broadcast_task',
    targetId: row.id,
    detail: {
      channel: row.channel,
      msg_type: row.msg_type,
      trigger: 'manual_run',
    },
    ip: context.ip,
    userAgent: context.userAgent,
  });
  setImmediate(() => {
    runBroadcastTask(row.id).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[broadcast] runBroadcastTask', e);
    });
  });
  const p = row.get({ plain: true });
  return { ...p, content: parseBroadcastContent(p.content) };
}

/**
 * 内部：按任务 ID 执行（无 HTTP auth，仅服务内与 setImmediate 调用）。
 * @param {number} taskId
 */
export async function runBroadcastTask(taskId) {
  const task = await BroadcastTask.findByPk(taskId);
  if (!task) {
    return;
  }
  if (!['sending'].includes(task.status)) {
    return;
  }
  billingService.incrementUsage(task.tenant_id, 'broadcasts').catch((e) =>
    console.error('[billing] increment broadcasts', e),
  );

  const tenant = await Tenant.findByPk(task.tenant_id);
  if (!tenant) {
    await task.update({
      status: 'failed',
      finished_at: new Date(),
      error_message: '租户不存在',
      is_sync_completed: true,
    });
    return;
  }

  const parsed = parseBroadcastContent(task.content);
  const textContent = textFromParsed(parsed);
  const attachments = buildAttachmentsFromContent(parsed);

  const recipients = await BroadcastTaskRecipient.findAll({
    where: { broadcast_task_id: taskId, send_status: 'pending' },
    include: [
      {
        model: Customer,
        attributes: ['id', 'external_userid', 'owner_id'],
        include: [{ model: User, as: 'owner', attributes: ['id', 'wework_userid'] }],
      },
    ],
  });

  if (!recipients.length) {
    await task.update({
      status: 'done',
      finished_at: new Date(),
      stats_json: { target: 0, success: 0, fail: 0 },
      is_sync_completed: true,
      wecom_msgid: null,
      send_fail_detail: null,
    });
    return;
  }

  if (task.channel === 'mock') {
    await sequelize.transaction(async (t) => {
      await BroadcastTaskRecipient.update(
        { send_status: 'sent', sent_at: new Date() },
        { where: { broadcast_task_id: taskId }, transaction: t },
      );
      const total = recipients.length;
      await task.update(
        {
          status: 'done',
          finished_at: new Date(),
          stats_json: { target: total, success: total, fail: 0 },
          is_sync_completed: true,
          wecom_msgid: null,
          send_fail_detail: null,
        },
        { transaction: t },
      );
    });
    return;
  }

  let firstMsgid = null;
  /** @type {object[]} */
  const batchResults = [];

  /** @type {Map<string, { customerIds: number[]; externalIds: string[] }>} */
  const bySender = new Map();
  for (const rec of recipients) {
    const c = rec.Customer;
    const sender = c?.owner?.wework_userid;
    const ext = c?.external_userid;
    if (!sender || !ext) {
      await rec.update({
        send_status: 'failed',
        error_message: !sender ? '负责人未绑定企微 userid' : '客户缺少 external_userid',
      });
      continue;
    }
    if (!bySender.has(sender)) {
      bySender.set(sender, { customerIds: [], externalIds: [] });
    }
    const bucket = bySender.get(sender);
    bucket.customerIds.push(Number(c.id));
    bucket.externalIds.push(ext);
  }

  let success = 0;
  let fail = 0;

  const BATCH = 1000;
  for (const [sender, bucket] of bySender) {
    for (let i = 0; i < bucket.externalIds.length; i += BATCH) {
      const batchExt = bucket.externalIds.slice(i, i + BATCH);
      const batchCust = bucket.customerIds.slice(i, i + BATCH);
      try {
        const res = await addMsgTemplate(tenant, {
          sender,
          externalUserids: batchExt,
          textContent,
          attachments,
        });
        if (res.errcode === 0) {
          if (!firstMsgid && res.msgid) {
            firstMsgid = String(res.msgid);
          }
          batchResults.push({
            sender,
            msgid: res.msgid ?? null,
            fail_list: res.fail_list || [],
            errcode: 0,
          });
          const failedSet = new Set(res.fail_list || []);
          for (let j = 0; j < batchExt.length; j += 1) {
            const ext = batchExt[j];
            const cid = batchCust[j];
            if (failedSet.has(ext)) {
              fail += 1;
              await BroadcastTaskRecipient.update(
                { send_status: 'failed', error_message: res.errmsg || 'fail_list' },
                { where: { broadcast_task_id: taskId, customer_id: cid } },
              );
            } else {
              success += 1;
              await BroadcastTaskRecipient.update(
                { send_status: 'sent', sent_at: new Date() },
                { where: { broadcast_task_id: taskId, customer_id: cid } },
              );
            }
          }
        } else {
          fail += batchExt.length;
          batchResults.push({
            sender,
            msgid: null,
            fail_list: [],
            errcode: res.errcode,
            errmsg: res.errmsg,
          });
          await BroadcastTaskRecipient.update(
            {
              send_status: 'failed',
              error_message: res.errmsg || `errcode ${res.errcode}`,
            },
            {
              where: {
                broadcast_task_id: taskId,
                customer_id: { [Op.in]: batchCust },
              },
            },
          );
        }
      } catch (e) {
        fail += batchExt.length;
        const msg = e instanceof Error ? e.message : String(e);
        batchResults.push({
          sender,
          errcode: -1,
          errmsg: msg.slice(0, 200),
        });
        await BroadcastTaskRecipient.update(
          { send_status: 'failed', error_message: msg.slice(0, 250) },
          { where: { broadcast_task_id: taskId, customer_id: { [Op.in]: batchCust } } },
        );
      }
    }
  }

  const pending = await BroadcastTaskRecipient.count({
    where: { broadcast_task_id: taskId, send_status: 'pending' },
  });
  const totalTarget = await BroadcastTaskRecipient.count({
    where: { broadcast_task_id: taskId },
  });

  const failExternals = new Set();
  for (const b of batchResults) {
    if (Array.isArray(b.fail_list)) {
      for (const x of b.fail_list) {
        failExternals.add(x);
      }
    }
  }

  await task.update({
    status: pending > 0 ? 'failed' : 'done',
    finished_at: new Date(),
    stats_json: {
      target: totalTarget,
      success,
      fail,
      pending,
    },
    wecom_msgid: firstMsgid,
    send_fail_detail: {
      batches: batchResults,
      fail_external_userids: [...failExternals],
    },
    is_sync_completed: true,
    error_message: pending > 0 ? '部分受众未发送（负责人缺少 userid 或仍为 pending）' : null,
  });
}

/**
 * 定时扫描：已到点的 scheduled 任务改为 sending 并执行（由 ENABLE_BROADCAST_CRON 控制）。
 */
export async function processDueScheduledBroadcastTasks() {
  const now = new Date();
  const due = await BroadcastTask.findAll({
    where: {
      status: 'scheduled',
      scheduled_at: { [Op.lte]: now },
    },
    limit: 25,
    order: [['scheduled_at', 'ASC']],
  });

  for (const row of due) {
    const [n] = await BroadcastTask.update(
      { status: 'sending', started_at: new Date(), error_message: null },
      { where: { id: row.id, status: 'scheduled' } },
    );
    if (!n) {
      continue;
    }
    try {
      await runBroadcastTask(row.id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[broadcast] scheduled run', row.id, e);
      await BroadcastTask.update(
        {
          status: 'failed',
          finished_at: new Date(),
          is_sync_completed: true,
          error_message: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        },
        { where: { id: row.id } },
      );
    }
  }
}

/**
 * 导出群发任务列表（Excel base64）。
 */
export async function exportBroadcastTasks(auth, query) {
  const where = { tenant_id: auth.tenantId };
  if (query.status && STATUSES.includes(String(query.status))) {
    where.status = String(query.status);
  }
  const rows = await BroadcastTask.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: 10000,
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'real_name'], required: false }],
  });

  const data = rows.map((r) => {
    const p = r.get({ plain: true });
    const stats = p.stats_json || {};
    return {
      任务ID: p.id,
      任务名称: p.name || '',
      通道: p.channel || '',
      状态: p.status || '',
      消息类型: p.msg_type || '',
      目标人数: Number(stats.target || 0),
      成功数: Number(stats.success || 0),
      失败数: Number(stats.fail || 0),
      定时发送时间: p.scheduled_at || '',
      开始时间: p.started_at || '',
      完成时间: p.finished_at || '',
      创建人: p.creator?.real_name || p.creator?.username || '',
      创建时间: p.created_at || '',
      错误信息: p.error_message || '',
      企微msgid: p.wecom_msgid || '',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ 任务ID: '' }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'broadcast_tasks');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  return {
    filename: `broadcast_tasks_export_${Date.now()}.xlsx`,
    file_base64: Buffer.from(out).toString('base64'),
  };
}
