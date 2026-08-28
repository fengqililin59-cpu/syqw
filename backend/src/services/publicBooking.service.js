/**
 * @file 客户自助预约（公开接口）：按手机号匹配或新建客户，再创建预约。
 */
import Joi from 'joi';
import { Customer, Tenant } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { resolveLeadOwnerId, notifyOwnerNewLead } from './leadAssignment.service.js';
import * as billingService from './billing.service.js';
import { dispatchNewCustomerFlows } from './flowEngine.service.js';
import { createAppointment, getAvailableSlots } from './appointment.service.js';

const bookingSchema = Joi.object({
  name: Joi.string().trim().max(50).required(),
  phone: Joi.string().trim().pattern(/^1\d{10}$/).required().messages({
    'string.pattern.base': '请输入正确的 11 位手机号',
  }),
  start_at: Joi.date().required(),
  staff_id: Joi.number().integer().positive().allow(null).optional(),
  product_id: Joi.number().integer().positive().allow(null).optional(),
  title: Joi.string().trim().max(200).allow('', null).optional(),
  duration_min: Joi.number().integer().min(5).max(720).default(60),
  remark: Joi.string().trim().max(500).allow('', null).optional(),
  utm_source: Joi.string().trim().max(64).optional(),
}).unknown(false);

async function assertTenantActive(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant || tenant.status !== 1) {
    throw new HttpError(404, '门店不存在或已停用', 404);
  }
  return tenant;
}

/**
 * 可约档期（公开）。
 */
export async function publicSlots(tenantId, dateStr) {
  await assertTenantActive(tenantId);
  return getAvailableSlots(tenantId, dateStr);
}

/**
 * 提交自助预约（公开）。
 * @param {number} tenantId
 * @param {object} body
 */
export async function submitPublicBooking(tenantId, body) {
  const { error, value } = bookingSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  await assertTenantActive(tenantId);

  if (new Date(value.start_at) <= new Date()) {
    throw new HttpError(400, '请选择将来的时间', 400);
  }

  let customer = await Customer.findOne({
    where: { tenant_id: tenantId, phone: value.phone },
    paranoid: false,
  });
  if (customer?.deleted_at) await customer.restore();

  if (!customer) {
    const resolved = await resolveLeadOwnerId(tenantId, {
      utm_source: value.utm_source,
      channel_key: value.utm_source,
      prefer_wework_follow: false,
    });
    const ownerId = resolved?.owner_id ?? null;
    if (!ownerId) throw new HttpError(503, '该门店尚未配置员工账号，暂无法接收预约', 503);

    const quota = await billingService.checkQuota(tenantId, 'customers');
    if (!quota.allowed) throw new HttpError(402, '客户数量已达套餐上限，请联系门店管理员', 402);

    customer = await Customer.create({
      tenant_id: tenantId,
      owner_id: ownerId,
      name: value.name,
      phone: value.phone,
      source: '自助预约',
      stage: 'new',
    });

    billingService.incrementUsage(tenantId, 'customers').catch((err) =>
      console.error('[billing] public booking increment', err),
    );
    dispatchNewCustomerFlows(tenantId, customer.id).catch((err) =>
      console.error('[flow-engine] public booking dispatch', err),
    );
    notifyOwnerNewLead(tenantId, ownerId, {
      customer_id: customer.id,
      name: value.name,
      phone: value.phone,
      source: '自助预约',
    }).catch((err) => console.error('[lead-assign] booking notify', err));
  } else if (!customer.name && value.name) {
    await customer.update({ name: value.name });
  }

  const appointment = await createAppointment(
    tenantId,
    {
      customer_id: customer.id,
      staff_id: value.staff_id ?? null,
      product_id: value.product_id ?? null,
      title: value.title || null,
      start_at: value.start_at,
      duration_min: value.duration_min,
      remark: value.remark || null,
    },
    { source: '自助预约' },
  );

  return {
    appointment_id: appointment.id,
    customer_id: customer.id,
    start_at: appointment.start_at,
    message: '预约成功，我们将在到店前提醒您',
  };
}
