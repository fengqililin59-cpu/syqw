import Joi from 'joi';
import { Op, fn, col, literal } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { customerWhereScope } from '../utils/permissions.js';
import {
  SmsTemplate,
  SmsTask,
  SmsSendLog,
  Tenant,
  Customer,
  User,
  CustomerFollowUp,
} from '../models/index.js';
import * as aliyunSms from './aliyunSms.service.js';

const SAFE_CUSTOMER_FIELDS = new Set(['name', 'phone', 'company', 'position', 'remark']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function resolveParams(templateParams, customer) {
  const resolved = {};
  for (const [k, v] of Object.entries(templateParams || {})) {
    if (typeof v === 'string' && v.startsWith('${customer.')) {
      const field = v.replace('${customer.', '').replace('}', '').trim();
      resolved[k] = SAFE_CUSTOMER_FIELDS.has(field) ? customer?.[field] ?? v : v;
    } else {
      resolved[k] = v;
    }
  }
  return resolved;
}

async function findCustomersByFilter(authLike, filterJson = {}, options = {}) {
  const where = { ...customerWhereScope(authLike), deleted_at: null };
  if (filterJson?.stage) where.stage = String(filterJson.stage);
  if (options.hasPhone) {
    where.phone = { [Op.ne]: null };
    where[Op.and] = [literal("TRIM(COALESCE(phone, '')) <> ''")];
  }
  if (filterJson?.keyword) {
    const kw = String(filterJson.keyword).trim();
    if (kw) where.name = { [Op.like]: `%${kw}%` };
  }
  const query = {
    where,
    attributes: ['id', 'name', 'phone', 'company', 'remark'],
  };
  const tagIds = Array.isArray(filterJson?.tag_ids)
    ? filterJson.tag_ids.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  if (tagIds.length > 0) {
    const { Tag } = await import('../models/index.js');
    query.include = [
      {
        model: Tag,
        as: 'tags',
        attributes: [],
        required: true,
        where: { id: { [Op.in]: tagIds }, tenant_id: Number(authLike.tenantId) },
        through: { attributes: [] },
      },
    ];
  }
  if (options.countOnly) {
    return Customer.count({
      where: query.where,
      include: query.include,
      distinct: true,
      col: 'id',
    });
  }
  return Customer.findAll(query);
}

export async function createTemplate(tenantId, createdBy, data) {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    aliyun_template_code: Joi.string().trim().min(1).max(50).required(),
    content_preview: Joi.string().trim().min(1).required(),
    variables: Joi.array().items(Joi.string().trim().min(1).max(40)).default([]),
    sign_name: Joi.string().trim().min(1).max(50).required(),
  }).unknown(false);
  const { error, value } = schema.validate(data || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  return SmsTemplate.create({
    tenant_id: Number(tenantId),
    created_by: Number(createdBy),
    ...value,
    status: 'active',
  });
}

export async function updateTemplate(tenantId, id, data) {
  const row = await SmsTemplate.findOne({ where: { id: Number(id), tenant_id: Number(tenantId) } });
  if (!row) throw new HttpError(404, '模板不存在', 404);
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    content_preview: Joi.string().trim().min(1).optional(),
    variables: Joi.array().items(Joi.string().trim().min(1).max(40)).optional(),
    sign_name: Joi.string().trim().min(1).max(50).optional(),
    status: Joi.string().valid('active', 'disabled').optional(),
  }).unknown(false);
  const { error, value } = schema.validate(data || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  await row.update(value);
  return row;
}

export async function deleteTemplate(tenantId, id) {
  const row = await SmsTemplate.findOne({ where: { id: Number(id), tenant_id: Number(tenantId) } });
  if (!row) throw new HttpError(404, '模板不存在', 404);
  await row.update({ status: 'disabled' });
  return row;
}

export async function listTemplates(tenantId) {
  return SmsTemplate.findAll({
    where: { tenant_id: Number(tenantId), status: 'active' },
    order: [['id', 'DESC']],
  });
}

export async function createSmsTask(auth, data) {
  const schema = Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    template_id: Joi.number().integer().positive().required(),
    template_params: Joi.object().default({}),
    filter_json: Joi.object().default({}),
    scheduled_at: Joi.date().allow(null).optional(),
    run_now: Joi.boolean().default(true),
  }).unknown(false);
  const { error, value } = schema.validate(data || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const template = await SmsTemplate.findOne({
    where: { id: Number(value.template_id), tenant_id: Number(auth.tenantId), status: 'active' },
  });
  if (!template) throw new HttpError(404, '短信模板不存在', 404);

  const total = await findCustomersByFilter(auth, value.filter_json, { hasPhone: true, countOnly: true });
  const now = new Date();
  const scheduled = value.scheduled_at ? new Date(value.scheduled_at) : null;
  const shouldRun = value.run_now || !scheduled || scheduled <= now;
  const task = await SmsTask.create({
    tenant_id: Number(auth.tenantId),
    name: value.name,
    template_id: Number(value.template_id),
    template_params: value.template_params || {},
    filter_json: value.filter_json || {},
    total_count: Number(total || 0),
    status: shouldRun ? 'sending' : 'scheduled',
    scheduled_at: scheduled,
    created_by: Number(auth.userId),
  });

  if (shouldRun) {
    setImmediate(() => {
      executeSmsTask(task.id).catch((e) => console.error('[sms] execute task failed', e));
    });
  }
  return task;
}

export async function executeSmsTask(taskId) {
  const task = await SmsTask.findByPk(Number(taskId), {
    include: [
      { model: SmsTemplate, as: 'template' },
    ],
  });
  if (!task) return;
  if (task.status === 'cancelled') return;

  const tenant = await Tenant.findByPk(Number(task.tenant_id));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);
  const authLike = { tenantId: Number(task.tenant_id), userId: Number(task.created_by), roleName: '管理员', permissions: ['*'] };

  await task.update({ status: 'sending', started_at: task.started_at || new Date() });
  let sent = 0;
  let success = 0;
  let failed = 0;
  try {
    const customers = await findCustomersByFilter(authLike, task.filter_json || {}, { hasPhone: true });
    for (const c of customers) {
      const resolvedParams = resolveParams(task.template_params || {}, c.get({ plain: true }));
      let resp;
      try {
        resp = await aliyunSms.sendSms(tenant, {
          phone: c.phone,
          signName: task.template?.sign_name || tenant.sms_default_sign || '',
          templateCode: task.template?.aliyun_template_code,
          templateParam: resolvedParams,
        });
      } catch (e) {
        resp = { Code: 'ERROR', Message: e instanceof Error ? e.message : '发送失败' };
      }
      const ok = resp?.Code === 'OK';
      await SmsSendLog.create({
        tenant_id: Number(task.tenant_id),
        task_id: Number(task.id),
        customer_id: Number(c.id),
        phone: String(c.phone || ''),
        template_code: String(task.template?.aliyun_template_code || ''),
        template_params: resolvedParams,
        sign_name: String(task.template?.sign_name || tenant.sms_default_sign || ''),
        aliyun_biz_id: resp?.BizId || null,
        status: ok ? 'success' : 'failed',
        error_msg: ok ? null : String(resp?.Message || '发送失败').slice(0, 500),
        sent_at: new Date(),
      });
      await CustomerFollowUp.create({
        customer_id: Number(c.id),
        user_id: Number(task.created_by),
        type: 'other',
        content: `短信跟进 · ${task.template?.name || '模板短信'}`,
      });
      sent += 1;
      if (ok) success += 1;
      else failed += 1;
      if (sent % 10 === 0) {
        await task.update({ sent_count: sent, success_count: success, failed_count: failed });
      }
      await sleep(50);
    }
    await task.update({
      sent_count: sent,
      success_count: success,
      failed_count: failed,
      status: 'done',
      finished_at: new Date(),
    });
  } catch (e) {
    await task.update({
      sent_count: sent,
      success_count: success,
      failed_count: failed,
      status: 'failed',
      finished_at: new Date(),
    });
    throw e;
  }
}

export async function sendSingleSms(auth, customerId, templateId, extraParams = {}) {
  const template = await SmsTemplate.findOne({
    where: { id: Number(templateId), tenant_id: Number(auth.tenantId), status: 'active' },
  });
  if (!template) throw new HttpError(404, '短信模板不存在', 404);
  const tenant = await Tenant.findByPk(Number(auth.tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);

  let customer = null;
  let phone = String(extraParams.phone || '').trim();
  if (customerId != null) {
    customer = await Customer.findOne({
      where: { id: Number(customerId), tenant_id: Number(auth.tenantId), deleted_at: null },
    });
    if (!customer) throw new HttpError(404, '客户不存在', 404);
    phone = String(customer.phone || '').trim();
  }
  if (!phone) throw new HttpError(400, '手机号不能为空', 400);

  const params = resolveParams(extraParams || {}, customer?.get({ plain: true }) || {});
  const resp = await aliyunSms.sendSms(tenant, {
    phone,
    signName: template.sign_name || tenant.sms_default_sign || '',
    templateCode: template.aliyun_template_code,
    templateParam: params,
  });
  const ok = resp?.Code === 'OK';
  const log = await SmsSendLog.create({
    tenant_id: Number(auth.tenantId),
    task_id: null,
    customer_id: customer ? Number(customer.id) : null,
    phone,
    template_code: template.aliyun_template_code,
    template_params: params,
    sign_name: template.sign_name || tenant.sms_default_sign || '',
    aliyun_biz_id: resp?.BizId || null,
    status: ok ? 'success' : 'failed',
    error_msg: ok ? null : String(resp?.Message || '发送失败').slice(0, 500),
    sent_at: new Date(),
  });
  if (customer) {
    await CustomerFollowUp.create({
      customer_id: Number(customer.id),
      user_id: Number(auth.userId),
      type: 'other',
      content: `短信跟进 · ${template.name}`,
    });
  }
  return { log, response: resp };
}

export async function listSmsTasks(tenantId, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: Number(tenantId) };
  if (query.status) where.status = String(query.status);
  const { rows, count } = await SmsTask.findAndCountAll({
    where,
    include: [
      { model: SmsTemplate, as: 'template', attributes: ['id', 'name', 'content_preview', 'variables', 'sign_name'] },
      { model: User, as: 'creator', attributes: ['id', 'username', 'real_name'] },
    ],
    order: [['created_at', 'DESC']],
    offset: (page - 1) * size,
    limit: size,
  });
  return { list: rows, total: count, page, size };
}

export async function getSmsTask(tenantId, id) {
  const row = await SmsTask.findOne({
    where: { id: Number(id), tenant_id: Number(tenantId) },
    include: [
      { model: SmsTemplate, as: 'template', attributes: ['id', 'name', 'content_preview', 'variables', 'sign_name'] },
      { model: User, as: 'creator', attributes: ['id', 'username', 'real_name'] },
    ],
  });
  if (!row) throw new HttpError(404, '短信任务不存在', 404);
  return row;
}

export async function cancelSmsTask(tenantId, id) {
  const row = await SmsTask.findOne({ where: { id: Number(id), tenant_id: Number(tenantId) } });
  if (!row) throw new HttpError(404, '短信任务不存在', 404);
  if (!['draft', 'scheduled', 'sending'].includes(row.status)) {
    throw new HttpError(400, '当前状态不可取消', 400);
  }
  await row.update({ status: 'cancelled', finished_at: new Date() });
  return row;
}

export async function getSmsStats(tenantId, query = {}) {
  const where = { tenant_id: Number(tenantId) };
  if (query.start_date || query.end_date) {
    where.created_at = {};
    if (query.start_date) where.created_at[Op.gte] = new Date(String(query.start_date));
    if (query.end_date) where.created_at[Op.lte] = new Date(String(query.end_date));
  }
  const [totalSent, totalSuccess] = await Promise.all([
    SmsSendLog.count({ where }),
    SmsSendLog.count({ where: { ...where, status: 'success' } }),
  ]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySent = await SmsSendLog.count({
    where: { tenant_id: Number(tenantId), created_at: { [Op.gte]: today } },
  });
  const byTemplate = await SmsSendLog.findAll({
    where,
    attributes: [
      'template_code',
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal("CASE WHEN status='success' THEN 1 ELSE 0 END")), 'success'],
    ],
    group: ['template_code'],
    order: [[literal('total'), 'DESC']],
    raw: true,
  });
  const successRate = totalSent > 0 ? `${((totalSuccess / totalSent) * 100).toFixed(1)}%` : '0.0%';
  return {
    total_sent: totalSent,
    total_success: totalSuccess,
    success_rate: successRate,
    today_sent: todaySent,
    by_template: byTemplate.map((x) => ({
      template_code: x.template_code,
      total: Number(x.total || 0),
      success: Number(x.success || 0),
    })),
  };
}

export async function listSendLogs(tenantId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(200, Math.max(1, Number(query.size) || 20));
  const where = { tenant_id: Number(tenantId) };
  if (query.task_id) where.task_id = Number(query.task_id);
  if (query.customer_id) where.customer_id = Number(query.customer_id);
  const { rows, count } = await SmsSendLog.findAndCountAll({
    where,
    include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'], required: false }],
    order: [['id', 'DESC']],
    offset: (page - 1) * size,
    limit: size,
  });
  return { list: rows, total: count, page, size };
}

export async function saveSmsConfig(tenantId, config = {}) {
  const tenant = await Tenant.findByPk(Number(tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);
  await tenant.update({
    sms_access_key_id: String(config.accessKeyId || '').trim() || null,
    sms_access_key_secret: String(config.accessKeySecret || '').trim() || null,
    sms_default_sign: String(config.defaultSign || '').trim() || null,
  });
  return getSmsConfig(tenant);
}

export function getSmsConfig(tenant) {
  return {
    configured: Boolean(tenant?.sms_access_key_id && tenant?.sms_access_key_secret),
    accessKeyId: tenant?.sms_access_key_id ? '***已配置***' : '',
    defaultSign: tenant?.sms_default_sign || '',
  };
}
