/**
 * @file 外呼业务服务：发起通话、回调落库、通话记录与统计、外呼配置。
 */
import Joi from 'joi';
import { Op, fn, col, literal } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import {
  CallRecord,
  Customer,
  CustomerFollowUp,
  Tenant,
  User,
  UserCallSetting,
} from '../models/index.js';
import * as tcccService from './tccc.service.js';

const DEFAULT_SETTING = {
  dial_mode: 'phone',
  phone_number: null,
  is_available: true,
};

const listSchema = Joi.object({
  customer_id: Joi.number().integer().positive().optional(),
  caller_user_id: Joi.number().integer().positive().optional(),
  status: Joi.string()
    .valid('initiating', 'calling', 'connected', 'completed', 'failed', 'cancelled')
    .optional(),
  start_date: Joi.date().optional(),
  end_date: Joi.date().optional(),
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(20),
}).unknown(false);

const settingSchema = Joi.object({
  dial_mode: Joi.string().valid('phone', 'webrtc').required(),
  phone_number: Joi.string().trim().allow('', null).optional(),
  is_available: Joi.boolean().optional(),
}).unknown(false);

async function updateLatestCallFollowUp(callRecord, durationSeconds) {
  const follow = await CustomerFollowUp.findOne({
    where: {
      customer_id: Number(callRecord.customer_id),
      user_id: Number(callRecord.caller_user_id),
      type: 'call',
    },
    order: [['id', 'DESC']],
  });
  if (!follow) return;
  const d = Number(durationSeconds || 0);
  const content = d > 0 ? `电话跟进 · 通话 ${d} 秒` : '电话跟进 · 未接通';
  await follow.update({ content });
}

function normalizeDateRange(startDate, endDate) {
  const where = {};
  if (startDate || endDate) {
    where.created_at = {};
    if (startDate) where.created_at[Op.gte] = new Date(startDate);
    if (endDate) {
      const d = new Date(endDate);
      d.setHours(23, 59, 59, 999);
      where.created_at[Op.lte] = d;
    }
  }
  return where;
}

export async function initiateCall(tenantId, callerUserId, customerId) {
  const tenant = await Tenant.findByPk(Number(tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);

  const customer = await Customer.findOne({
    where: { id: Number(customerId), tenant_id: Number(tenantId), deleted_at: null },
  });
  if (!customer) throw new HttpError(404, '客户不存在', 404);
  const customerPhone = String(customer.phone || '').trim();
  if (!customerPhone) throw new HttpError(400, '该客户未填写手机号', 400);

  const caller = await User.findOne({
    where: { id: Number(callerUserId), tenant_id: Number(tenantId), status: 1 },
  });
  if (!caller) throw new HttpError(404, '当前用户不存在', 404);

  const setting = await UserCallSetting.findByPk(Number(callerUserId));
  const dialMode = setting?.dial_mode || DEFAULT_SETTING.dial_mode;
  const callerPhone = setting?.phone_number || DEFAULT_SETTING.phone_number;
  if (dialMode === 'phone' && !String(callerPhone || '').trim()) {
    throw new HttpError(400, '请先在设置中填写您的手机号', 400);
  }

  const callRecord = await CallRecord.create({
    tenant_id: Number(tenantId),
    customer_id: Number(customerId),
    caller_user_id: Number(callerUserId),
    call_type: 'outbound',
    dial_mode: dialMode,
    status: 'initiating',
    customer_phone: customerPhone,
    caller_phone: dialMode === 'phone' ? String(callerPhone).trim() : null,
  });

  await CustomerFollowUp.create({
    customer_id: Number(customerId),
    user_id: Number(callerUserId),
    type: 'call',
    content: '电话跟进（进行中）',
  });

  try {
    const tcccResp =
      dialMode === 'webrtc'
        ? await tcccService.initiateWebRtcCall(tenant, caller.wework_userid || caller.username, customerPhone)
        : await tcccService.initiatePhoneCall(tenant, String(callerPhone).trim(), customerPhone);
    await callRecord.update({
      tccc_session_id: tcccResp?.SessionId || null,
      status: 'calling',
      started_at: new Date(),
      failure_reason: null,
    });
  } catch (e) {
    await callRecord.update({
      status: 'failed',
      failure_reason: e instanceof Error ? e.message.slice(0, 200) : '发起外呼失败',
      ended_at: new Date(),
    });
  }

  const finalRecord = await CallRecord.findByPk(callRecord.id, {
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: User, as: 'caller', attributes: ['id', 'username', 'real_name'] },
    ],
  });
  return finalRecord;
}

export async function handleCallCallback(payload) {
  const sessionId = String(payload?.SessionId || '').trim();
  if (!sessionId) return { ignored: true };
  const callRecord = await CallRecord.findOne({
    where: { tccc_session_id: sessionId },
    order: [['id', 'DESC']],
  });
  if (!callRecord) return { ignored: true };

  const duration = Math.max(0, Number(payload?.Duration || 0));
  const ok = Number(payload?.EndStatus) === 0;
  const endedAt = payload?.Timestamp ? new Date(Number(payload.Timestamp) * 1000) : new Date();
  await callRecord.update({
    status: ok ? 'completed' : 'failed',
    duration_seconds: duration,
    recording_url: payload?.RecordURL || null,
    connected_at: duration > 0 ? callRecord.connected_at || callRecord.started_at || endedAt : callRecord.connected_at,
    ended_at: endedAt,
    failure_reason: ok ? null : String(payload?.EndStatus || 'unknown'),
  });
  await updateLatestCallFollowUp(callRecord, duration);
  return { updated: true };
}

export async function listCallRecords(tenantId, query) {
  const { error, value } = listSchema.validate(query, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const { page, size, customer_id, caller_user_id, status, start_date, end_date } = value;

  const where = {
    tenant_id: Number(tenantId),
    ...normalizeDateRange(start_date, end_date),
  };
  if (customer_id) where.customer_id = Number(customer_id);
  if (caller_user_id) where.caller_user_id = Number(caller_user_id);
  if (status) where.status = status;

  const { count, rows } = await CallRecord.findAndCountAll({
    where,
    include: [
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: User, as: 'caller', attributes: ['id', 'username', 'real_name'] },
    ],
    order: [['created_at', 'DESC']],
    offset: (page - 1) * size,
    limit: size,
  });

  return {
    list: rows,
    total: count,
    page,
    size,
  };
}

export async function getCallStats(tenantId, query) {
  const { error, value } = listSchema.validate(query, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const { start_date, end_date } = value;
  const where = {
    tenant_id: Number(tenantId),
    ...normalizeDateRange(start_date, end_date),
  };

  const [total, connected, avgRow] = await Promise.all([
    CallRecord.count({ where }),
    CallRecord.count({ where: { ...where, status: 'completed' } }),
    CallRecord.findOne({
      where,
      attributes: [[fn('AVG', col('duration_seconds')), 'avg_duration']],
      raw: true,
    }),
  ]);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const todayTotal = await CallRecord.count({
    where: {
      tenant_id: Number(tenantId),
      created_at: { [Op.gte]: startToday },
    },
  });

  const byUserRows = await CallRecord.findAll({
    where,
    attributes: [
      'caller_user_id',
      [fn('COUNT', col('CallRecord.id')), 'total'],
      [fn('SUM', literal("CASE WHEN `CallRecord`.`status`='completed' THEN 1 ELSE 0 END")), 'connected'],
    ],
    include: [{ model: User, as: 'caller', attributes: ['id', 'username', 'real_name'] }],
    group: ['caller_user_id', 'caller.id'],
    order: [[literal('total'), 'DESC']],
    raw: false,
  });

  const byUser = byUserRows.map((r) => {
    const p = r.get({ plain: true });
    return {
      user_id: Number(p.caller_user_id),
      username: p.caller?.real_name || p.caller?.username || `用户${p.caller_user_id}`,
      total: Number(p.total || 0),
      connected: Number(p.connected || 0),
    };
  });

  const rate = total > 0 ? ((connected / total) * 100).toFixed(1) : '0.0';
  return {
    total,
    connected,
    connect_rate: `${rate}%`,
    avg_duration: Number(avgRow?.avg_duration || 0),
    today_total: todayTotal,
    by_user: byUser,
  };
}

export async function getUserCallSetting(userId) {
  const setting = await UserCallSetting.findByPk(Number(userId));
  if (!setting) return { ...DEFAULT_SETTING };
  const p = setting.get({ plain: true });
  return {
    dial_mode: p.dial_mode || DEFAULT_SETTING.dial_mode,
    phone_number: p.phone_number || null,
    is_available: Boolean(p.is_available),
  };
}

export async function updateUserCallSetting(userId, tenantId, data) {
  const { error, value } = settingSchema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);
  const [row] = await UserCallSetting.upsert({
    user_id: Number(userId),
    tenant_id: Number(tenantId),
    dial_mode: value.dial_mode,
    phone_number: value.phone_number ? String(value.phone_number).trim() : null,
    is_available: value.is_available == null ? true : Boolean(value.is_available),
  });
  return row;
}

export function getTcccConfig(tenant) {
  const cfg = {
    sdkAppId: tenant?.tccc_sdk_app_id || '',
    secretId: tenant?.tccc_secret_id || '',
    secretKey: tenant?.tccc_secret_key || '',
    serverNumber: tenant?.tccc_server_number || '',
  };
  return {
    ...cfg,
    configured: Boolean(cfg.sdkAppId && cfg.secretId && cfg.secretKey && cfg.serverNumber),
  };
}

export async function saveTcccConfig(tenantId, config) {
  const tenant = await Tenant.findByPk(Number(tenantId));
  if (!tenant) throw new HttpError(404, '租户不存在', 404);
  await tenant.update({
    tccc_sdk_app_id: String(config?.sdkAppId || '').trim() || null,
    tccc_secret_id: String(config?.secretId || '').trim() || null,
    tccc_secret_key: String(config?.secretKey || '').trim() || null,
    tccc_server_number: String(config?.serverNumber || '').trim() || null,
  });
  return getTcccConfig(tenant);
}
