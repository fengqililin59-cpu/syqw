/**
 * @file 服务人员排班：周期排班（weekday）与指定日期覆盖（work_date）。
 * 同一员工在同一天，work_date 记录优先于 weekday 记录。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { StaffSchedule, User } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const baseFields = {
  staff_id: Joi.number().integer().positive().required(),
  weekday: Joi.number().integer().min(0).max(6).allow(null),
  work_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null),
  start_time: Joi.string().pattern(TIME_PATTERN).required().messages({
    'string.pattern.base': '开始时间格式应为 HH:mm',
  }),
  end_time: Joi.string().pattern(TIME_PATTERN).required().messages({
    'string.pattern.base': '结束时间格式应为 HH:mm',
  }),
  is_off: Joi.boolean().default(false),
};

const createSchema = Joi.object(baseFields)
  .xor('weekday', 'work_date')
  .messages({
    'object.xor': '周期排班与指定日期只能二选一',
    'object.missing': '请指定星期几或具体日期',
  });

const updateSchema = Joi.object({
  weekday: Joi.number().integer().min(0).max(6).allow(null).optional(),
  work_date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null).optional(),
  start_time: Joi.string().pattern(TIME_PATTERN).optional(),
  end_time: Joi.string().pattern(TIME_PATTERN).optional(),
  is_off: Joi.boolean().optional(),
}).min(1);

function normalizeTime(t) {
  return t.length === 5 ? `${t}:00` : t;
}

function assertTimeOrder(startTime, endTime, isOff) {
  if (isOff) return;
  if (normalizeTime(startTime) >= normalizeTime(endTime)) {
    throw new HttpError(400, '结束时间必须晚于开始时间', 400);
  }
}

async function assertStaffExists(tenantId, staffId) {
  const user = await User.findOne({ where: { id: staffId, tenant_id: tenantId } });
  if (!user) throw new HttpError(404, '员工不存在', 404);
  return user;
}

const STAFF_INCLUDE = {
  model: User,
  as: 'staff',
  attributes: ['id', 'real_name', 'username'],
  required: false,
};

/**
 * 排班列表。可按员工筛选，或只看某日期之后的日期覆盖记录。
 * 一并返回可排班的员工名册，供前端下拉选择。
 */
export async function listSchedules(tenantId, query = {}) {
  const where = { tenant_id: tenantId };
  if (query.staff_id) where.staff_id = Number(query.staff_id);
  if (query.from_date) {
    where[Op.or] = [
      { work_date: { [Op.gte]: query.from_date } },
      { work_date: null },
    ];
  }

  const [rows, staff] = await Promise.all([
    StaffSchedule.findAll({
      where,
      include: [STAFF_INCLUDE],
      order: [
        ['staff_id', 'ASC'],
        ['work_date', 'ASC'],
        ['weekday', 'ASC'],
        ['start_time', 'ASC'],
      ],
    }),
    User.findAll({
      where: { tenant_id: tenantId, status: 1 },
      attributes: ['id', 'real_name', 'username'],
      order: [['id', 'ASC']],
    }),
  ]);
  return { list: rows, staff };
}

export async function createSchedule(tenantId, body) {
  const { error, value } = createSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  await assertStaffExists(tenantId, value.staff_id);
  assertTimeOrder(value.start_time, value.end_time, value.is_off);

  return StaffSchedule.create({
    tenant_id: tenantId,
    staff_id: value.staff_id,
    weekday: value.weekday ?? null,
    work_date: value.work_date ?? null,
    start_time: normalizeTime(value.start_time),
    end_time: normalizeTime(value.end_time),
    is_off: value.is_off,
  });
}

export async function updateSchedule(tenantId, id, body) {
  const { error, value } = updateSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  const row = await StaffSchedule.findOne({ where: { id, tenant_id: tenantId } });
  if (!row) throw new HttpError(404, '排班不存在', 404);

  const startTime = value.start_time ?? row.start_time;
  const endTime = value.end_time ?? row.end_time;
  const isOff = value.is_off ?? row.is_off;
  assertTimeOrder(startTime, endTime, isOff);

  const patch = { ...value };
  if (patch.start_time) patch.start_time = normalizeTime(patch.start_time);
  if (patch.end_time) patch.end_time = normalizeTime(patch.end_time);

  await row.update(patch);
  return row;
}

export async function deleteSchedule(tenantId, id) {
  const row = await StaffSchedule.findOne({ where: { id, tenant_id: tenantId } });
  if (!row) throw new HttpError(404, '排班不存在', 404);
  await row.destroy();
  return { deleted: true };
}

const weeklySchema = Joi.object({
  staff_id: Joi.number().integer().positive().required(),
  days: Joi.array()
    .items(
      Joi.object({
        weekday: Joi.number().integer().min(0).max(6).required(),
        start_time: Joi.string().pattern(TIME_PATTERN).required(),
        end_time: Joi.string().pattern(TIME_PATTERN).required(),
        is_off: Joi.boolean().default(false),
      }),
    )
    .max(7)
    .required(),
});

/**
 * 整体替换某员工的周期排班（日期覆盖记录不受影响）。
 * @param {number} tenantId
 * @param {object} body
 */
export async function replaceWeekly(tenantId, body) {
  const { error, value } = weeklySchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  await assertStaffExists(tenantId, value.staff_id);

  const seen = new Set();
  for (const d of value.days) {
    if (seen.has(d.weekday)) throw new HttpError(400, '同一星期几只能配置一条排班', 400);
    seen.add(d.weekday);
    assertTimeOrder(d.start_time, d.end_time, d.is_off);
  }

  await StaffSchedule.destroy({
    where: { tenant_id: tenantId, staff_id: value.staff_id, work_date: null },
  });

  if (value.days.length) {
    await StaffSchedule.bulkCreate(
      value.days.map((d) => ({
        tenant_id: tenantId,
        staff_id: value.staff_id,
        weekday: d.weekday,
        work_date: null,
        start_time: normalizeTime(d.start_time),
        end_time: normalizeTime(d.end_time),
        is_off: d.is_off,
      })),
    );
  }

  return listSchedules(tenantId, { staff_id: value.staff_id });
}
