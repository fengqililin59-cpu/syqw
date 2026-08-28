/**
 * @file 预约到店：档期查询、创建改期（含服务人员时间冲突校验）、到店/完成/爽约/取消状态机。
 * 状态流转：booked → arrived → completed；booked/arrived → no_show/cancelled。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { Appointment, Customer, User, Product, StaffSchedule } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { FLOW_TRIGGER_TYPES } from '../constants/flowTriggers.js';
import { dispatchFlowsByTrigger } from './flowEngine.service.js';

export const APPOINTMENT_STATUS = {
  BOOKED: 'booked',
  ARRIVED: 'arrived',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
  CANCELLED: 'cancelled',
};

/** 允许的状态流转 */
const STATUS_TRANSITIONS = {
  [APPOINTMENT_STATUS.BOOKED]: [
    APPOINTMENT_STATUS.ARRIVED,
    APPOINTMENT_STATUS.NO_SHOW,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.ARRIVED]: [
    APPOINTMENT_STATUS.COMPLETED,
    APPOINTMENT_STATUS.CANCELLED,
  ],
  [APPOINTMENT_STATUS.COMPLETED]: [],
  [APPOINTMENT_STATUS.NO_SHOW]: [APPOINTMENT_STATUS.BOOKED],
  [APPOINTMENT_STATUS.CANCELLED]: [],
};

const STATUS_LABEL = {
  booked: '已预约',
  arrived: '已到店',
  completed: '已完成',
  no_show: '已爽约',
  cancelled: '已取消',
};

/** 占用档期的状态（用于冲突校验） */
const OCCUPYING_STATUSES = [APPOINTMENT_STATUS.BOOKED, APPOINTMENT_STATUS.ARRIVED];

const createSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  staff_id: Joi.number().integer().positive().allow(null).optional(),
  product_id: Joi.number().integer().positive().allow(null).optional(),
  title: Joi.string().trim().max(200).allow('', null).optional(),
  start_at: Joi.date().required(),
  duration_min: Joi.number().integer().min(5).max(720).default(60),
  source: Joi.string().trim().max(50).allow('', null).optional(),
  remark: Joi.string().trim().max(500).allow('', null).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
});

const updateSchema = Joi.object({
  staff_id: Joi.number().integer().positive().allow(null).optional(),
  product_id: Joi.number().integer().positive().allow(null).optional(),
  title: Joi.string().trim().max(200).optional(),
  start_at: Joi.date().optional(),
  duration_min: Joi.number().integer().min(5).max(720).optional(),
  remark: Joi.string().trim().max(500).allow('', null).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
}).min(1);

function endOf(startAt, durationMin) {
  return new Date(new Date(startAt).getTime() + Number(durationMin) * 60_000);
}

/**
 * 同一服务人员时间段重叠校验。区间按 [start, end) 处理，紧邻不算冲突。
 */
async function assertNoStaffConflict(tenantId, { staffId, startAt, durationMin, excludeId }) {
  if (!staffId) return;
  const start = new Date(startAt);
  const end = endOf(start, durationMin);

  const where = {
    tenant_id: tenantId,
    staff_id: staffId,
    status: { [Op.in]: OCCUPYING_STATUSES },
    // 已有预约的开始时间落在新区间之前，且结束时间在新区间开始之后即为重叠。
    start_at: { [Op.lt]: end },
  };
  if (excludeId) where.id = { [Op.ne]: excludeId };

  const candidates = await Appointment.findAll({ where });
  const conflict = candidates.find((a) => endOf(a.start_at, a.duration_min) > start);
  if (conflict) {
    throw new HttpError(
      409,
      `该服务人员在此时间段已有预约（${new Date(conflict.start_at).toLocaleString('zh-CN')}·${conflict.title}）`,
      409,
    );
  }
}

async function assertCustomerExists(tenantId, customerId) {
  const customer = await Customer.findOne({ where: { id: customerId, tenant_id: tenantId } });
  if (!customer) throw new HttpError(404, '客户不存在', 404);
  return customer;
}

/**
 * 重算客户的「下次到店时间」缓存字段。
 * @param {number} tenantId
 * @param {number} customerId
 */
async function refreshNextAppointment(tenantId, customerId) {
  const next = await Appointment.findOne({
    where: {
      tenant_id: tenantId,
      customer_id: customerId,
      status: APPOINTMENT_STATUS.BOOKED,
      start_at: { [Op.gte]: new Date() },
    },
    order: [['start_at', 'ASC']],
    attributes: ['start_at'],
  });
  await Customer.update(
    { next_appointment_at: next ? next.start_at : null },
    { where: { id: customerId, tenant_id: tenantId } },
  );
}

const INCLUDE_RELATIONS = [
  { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'stage'], required: false },
  { model: User, as: 'staff', attributes: ['id', 'real_name', 'username'], required: false },
  { model: Product, as: 'product', attributes: ['id', 'name'], required: false },
];

/**
 * 预约列表。支持日期区间、员工、状态、客户筛选与分页。
 */
export async function listAppointments(tenantId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(200, Math.max(1, Number(query.page_size) || 20));

  const where = { tenant_id: tenantId };
  if (query.start_date || query.end_date) {
    where.start_at = {};
    if (query.start_date) where.start_at[Op.gte] = new Date(`${query.start_date}T00:00:00`);
    if (query.end_date) where.start_at[Op.lte] = new Date(`${query.end_date}T23:59:59`);
  }
  if (query.staff_id) where.staff_id = Number(query.staff_id);
  if (query.customer_id) where.customer_id = Number(query.customer_id);
  if (query.status) {
    const list = String(query.status).split(',').map((s) => s.trim()).filter(Boolean);
    where.status = list.length > 1 ? { [Op.in]: list } : list[0];
  }

  const { rows, count } = await Appointment.findAndCountAll({
    where,
    include: INCLUDE_RELATIONS,
    order: [['start_at', 'ASC']],
    limit: size,
    offset: (page - 1) * size,
    distinct: true,
  });

  return { list: rows, total: count, page, size };
}

/**
 * 档期视图：返回指定区间内全部预约 + 参与排班的服务人员，供日/周视图渲染。
 */
export async function getCalendar(tenantId, query = {}) {
  const startDate = query.start_date || new Date().toISOString().slice(0, 10);
  const endDate = query.end_date || startDate;

  const where = {
    tenant_id: tenantId,
    start_at: {
      [Op.gte]: new Date(`${startDate}T00:00:00`),
      [Op.lte]: new Date(`${endDate}T23:59:59`),
    },
    status: { [Op.ne]: APPOINTMENT_STATUS.CANCELLED },
  };
  if (query.staff_id) where.staff_id = Number(query.staff_id);

  const [appointments, staff] = await Promise.all([
    Appointment.findAll({ where, include: INCLUDE_RELATIONS, order: [['start_at', 'ASC']] }),
    User.findAll({
      where: { tenant_id: tenantId, status: 1 },
      attributes: ['id', 'real_name', 'username'],
      order: [['id', 'ASC']],
    }),
  ]);

  return { start_date: startDate, end_date: endDate, staff, appointments };
}

export async function getAppointment(tenantId, id) {
  const row = await Appointment.findOne({
    where: { id, tenant_id: tenantId },
    include: INCLUDE_RELATIONS,
  });
  if (!row) throw new HttpError(404, '预约不存在', 404);
  return row;
}

/**
 * 创建预约。
 * @param {number} tenantId
 * @param {object} body
 * @param {{ userId?: number, source?: string }} ctx
 */
export async function createAppointment(tenantId, body, ctx = {}) {
  const { error, value } = createSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  await assertCustomerExists(tenantId, value.customer_id);

  let title = value.title?.trim();
  if (!title && value.product_id) {
    const product = await Product.findOne({ where: { id: value.product_id, tenant_id: tenantId } });
    title = product?.name;
  }
  if (!title) title = '到店服务';

  await assertNoStaffConflict(tenantId, {
    staffId: value.staff_id,
    startAt: value.start_at,
    durationMin: value.duration_min,
  });

  const row = await Appointment.create({
    tenant_id: tenantId,
    customer_id: value.customer_id,
    staff_id: value.staff_id ?? null,
    product_id: value.product_id ?? null,
    title,
    start_at: value.start_at,
    duration_min: value.duration_min,
    status: APPOINTMENT_STATUS.BOOKED,
    source: value.source || ctx.source || '员工代约',
    remark: value.remark || null,
    metadata: value.metadata || null,
    created_by: ctx.userId ?? null,
  });

  await refreshNextAppointment(tenantId, value.customer_id);
  dispatchFlowsByTrigger(tenantId, value.customer_id, FLOW_TRIGGER_TYPES.APPOINTMENT_BOOKED).catch((e) =>
    console.error('[appointment] booked flow dispatch', e),
  );

  return getAppointment(tenantId, row.id);
}

/**
 * 修改预约（改期/换人/换项目）。已结束的预约不可修改。
 */
export async function updateAppointment(tenantId, id, body) {
  const { error, value } = updateSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const row = await Appointment.findOne({ where: { id, tenant_id: tenantId } });
  if (!row) throw new HttpError(404, '预约不存在', 404);
  if ([APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED].includes(row.status)) {
    throw new HttpError(400, `预约${STATUS_LABEL[row.status]}，不可修改`, 400);
  }

  const staffId = value.staff_id !== undefined ? value.staff_id : row.staff_id;
  const startAt = value.start_at !== undefined ? value.start_at : row.start_at;
  const durationMin = value.duration_min !== undefined ? value.duration_min : row.duration_min;

  await assertNoStaffConflict(tenantId, { staffId, startAt, durationMin, excludeId: row.id });

  await row.update(value);
  await refreshNextAppointment(tenantId, row.customer_id);
  return getAppointment(tenantId, row.id);
}

function assertTransition(from, to) {
  const allowed = STATUS_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new HttpError(400, `预约当前为「${STATUS_LABEL[from]}」，不能变更为「${STATUS_LABEL[to]}」`, 400);
  }
}

/**
 * 状态流转统一入口。
 * @param {number} tenantId
 * @param {number} id
 * @param {string} nextStatus
 * @param {{ reason?: string }} [opts]
 */
export async function changeStatus(tenantId, id, nextStatus, opts = {}) {
  const row = await Appointment.findOne({ where: { id, tenant_id: tenantId } });
  if (!row) throw new HttpError(404, '预约不存在', 404);
  assertTransition(row.status, nextStatus);

  const now = new Date();
  const patch = { status: nextStatus };

  if (nextStatus === APPOINTMENT_STATUS.ARRIVED) {
    patch.arrived_at = now;
  } else if (nextStatus === APPOINTMENT_STATUS.COMPLETED) {
    patch.completed_at = now;
    if (!row.arrived_at) patch.arrived_at = now;
  } else if (nextStatus === APPOINTMENT_STATUS.CANCELLED) {
    patch.cancel_reason = opts.reason || null;
  }

  await row.update(patch);

  if (nextStatus === APPOINTMENT_STATUS.ARRIVED) {
    const scope = { where: { id: row.customer_id, tenant_id: tenantId } };
    await Customer.update({ last_visit_at: now }, scope);
    await Customer.increment('visit_count', { by: 1, ...scope });
  }

  await refreshNextAppointment(tenantId, row.customer_id);

  const triggerMap = {
    [APPOINTMENT_STATUS.ARRIVED]: FLOW_TRIGGER_TYPES.APPOINTMENT_ARRIVED,
    [APPOINTMENT_STATUS.COMPLETED]: FLOW_TRIGGER_TYPES.SERVICE_COMPLETED,
    [APPOINTMENT_STATUS.NO_SHOW]: FLOW_TRIGGER_TYPES.APPOINTMENT_NO_SHOW,
  };
  const trigger = triggerMap[nextStatus];
  if (trigger) {
    dispatchFlowsByTrigger(tenantId, row.customer_id, trigger).catch((e) =>
      console.error('[appointment] status flow dispatch', trigger, e),
    );
  }

  return getAppointment(tenantId, row.id);
}

/**
 * 今日到店看板：前台高频页的数据源。
 */
export async function getTodayBoard(tenantId, dateStr) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const rows = await Appointment.findAll({
    where: {
      tenant_id: tenantId,
      start_at: {
        [Op.gte]: new Date(`${date}T00:00:00`),
        [Op.lte]: new Date(`${date}T23:59:59`),
      },
    },
    include: INCLUDE_RELATIONS,
    order: [['start_at', 'ASC']],
  });

  const stats = { total: rows.length, booked: 0, arrived: 0, completed: 0, no_show: 0, cancelled: 0 };
  for (const r of rows) {
    if (stats[r.status] !== undefined) stats[r.status] += 1;
  }
  const effective = stats.total - stats.cancelled;
  stats.arrival_rate = effective > 0
    ? Math.round(((stats.arrived + stats.completed) / effective) * 1000) / 10
    : null;

  return { date, stats, list: rows };
}

/**
 * 可约档期：按服务人员排班扣除已占用时段，供自助预约页展示。
 * @param {number} tenantId
 * @param {string} dateStr YYYY-MM-DD
 * @param {number} [slotMin] 时段粒度
 */
export async function getAvailableSlots(tenantId, dateStr, slotMin = 30) {
  const date = dateStr || new Date().toISOString().slice(0, 10);
  const weekday = new Date(`${date}T00:00:00`).getDay();

  const schedules = await StaffSchedule.findAll({
    where: {
      tenant_id: tenantId,
      [Op.or]: [{ work_date: date }, { weekday, work_date: null }],
    },
  });

  // 指定日期的排班覆盖同一员工的周期性排班
  const byStaff = new Map();
  for (const s of schedules) {
    const prev = byStaff.get(String(s.staff_id));
    if (!prev || (s.work_date && !prev.work_date)) byStaff.set(String(s.staff_id), s);
  }

  const staffIds = [...byStaff.values()].filter((s) => !s.is_off).map((s) => s.staff_id);
  if (staffIds.length === 0) return { date, slots: [] };

  const booked = await Appointment.findAll({
    where: {
      tenant_id: tenantId,
      staff_id: { [Op.in]: staffIds },
      status: { [Op.in]: OCCUPYING_STATUSES },
      start_at: {
        [Op.gte]: new Date(`${date}T00:00:00`),
        [Op.lte]: new Date(`${date}T23:59:59`),
      },
    },
    attributes: ['staff_id', 'start_at', 'duration_min'],
  });

  const staffRows = await User.findAll({
    where: { id: { [Op.in]: staffIds }, tenant_id: tenantId },
    attributes: ['id', 'real_name', 'username'],
  });
  const nameById = new Map(staffRows.map((u) => [String(u.id), u.real_name || u.username]));

  const now = new Date();
  const slots = [];

  for (const staffId of staffIds) {
    const sch = byStaff.get(String(staffId));
    const dayStart = new Date(`${date}T${sch.start_time}`);
    const dayEnd = new Date(`${date}T${sch.end_time}`);
    const taken = booked
      .filter((b) => String(b.staff_id) === String(staffId))
      .map((b) => [new Date(b.start_at), endOf(b.start_at, b.duration_min)]);

    for (let t = new Date(dayStart); t < dayEnd; t = new Date(t.getTime() + slotMin * 60_000)) {
      const slotEnd = new Date(t.getTime() + slotMin * 60_000);
      if (slotEnd > dayEnd || t <= now) continue;
      const overlapped = taken.some(([bs, be]) => t < be && slotEnd > bs);
      if (overlapped) continue;
      slots.push({
        staff_id: Number(staffId),
        staff_name: nameById.get(String(staffId)) || null,
        start_at: t.toISOString(),
        duration_min: slotMin,
      });
    }
  }

  slots.sort((a, b) => a.start_at.localeCompare(b.start_at));
  return { date, slots };
}
