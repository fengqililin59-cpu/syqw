import dayjs from 'dayjs';
import Joi from 'joi';
import { Op, UniqueConstraintError } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { IntentAlert, Customer, User } from '../models/index.js';

const listAlertsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(200).default(20),
  status: Joi.string().valid('pending', 'sent', 'failed', '').allow(null).optional(),
  start_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow('', null)
    .optional(),
  end_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow('', null)
    .optional(),
}).unknown(false);

/**
 * 当客户意向分单次上升达到阈值时创建预警（同客户同日仅一条）。
 * @param {{ id: number; tenant_id: number; owner_id: number }} customer
 * @param {number} scoreBefore
 * @param {number} scoreAfter
 */
export async function checkAndCreateIntentAlert(customer, scoreBefore, scoreAfter) {
  const delta = Number(scoreAfter) - Number(scoreBefore);
  if (delta < 15) return;
  const dayStart = dayjs().startOf('day').toDate();
  const exists = await IntentAlert.findOne({
    where: {
      customer_id: Number(customer.id),
      created_at: { [Op.gte]: dayStart },
      status: { [Op.in]: ['pending', 'sent'] },
    },
    attributes: ['id'],
  });
  if (exists) return;
  try {
    await IntentAlert.create(
      {
        tenant_id: Number(customer.tenant_id),
        customer_id: Number(customer.id),
        owner_id: Number(customer.owner_id),
        score_before: Number(scoreBefore),
        score_after: Number(scoreAfter),
        score_delta: delta,
        status: 'pending',
        created_at: new Date(),
      },
      {
        fields: [
          'tenant_id',
          'customer_id',
          'owner_id',
          'score_before',
          'score_after',
          'score_delta',
          'status',
          'created_at',
        ],
      },
    );
  } catch (e) {
    if (e instanceof UniqueConstraintError) return;
    const code = e?.parent?.code || e?.original?.code;
    if (code === 'ER_DUP_ENTRY') return;
    throw e;
  }
}

/**
 * @param {number} tenantId
 * @param {Record<string, unknown>} query
 */
export async function listAlerts(tenantId, query) {
  const { error, value } = listAlertsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const page = Number(value.page);
  const size = Number(value.size);
  const where = { tenant_id: Number(tenantId) };

  if (value.status) {
    where.status = value.status;
  }

  if (value.start_date || value.end_date) {
    const s = value.start_date ? `${value.start_date} 00:00:00` : '1970-01-01 00:00:00';
    const e = value.end_date ? `${value.end_date} 23:59:59` : '2999-12-31 23:59:59';
    where.created_at = { [Op.between]: [new Date(s), new Date(e)] };
  }

  const { rows, count } = await IntentAlert.findAndCountAll({
    where,
    include: [
      { model: Customer, attributes: ['id', 'name'], required: false },
      { model: User, as: 'owner', attributes: ['id', 'username', 'real_name'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
    distinct: true,
  });

  const list = rows.map((r) => {
    const plain = r.get({ plain: true });
    return {
      id: plain.id,
      created_at: plain.created_at,
      sent_at: plain.sent_at,
      status: plain.status,
      score_before: plain.score_before,
      score_after: plain.score_after,
      score_delta: plain.score_delta,
      ai_script: plain.ai_script,
      customer: plain.Customer ? { id: plain.Customer.id, name: plain.Customer.name } : { id: plain.customer_id, name: null },
      owner: plain.owner
        ? { id: plain.owner.id, username: plain.owner.username, real_name: plain.owner.real_name ?? null }
        : { id: plain.owner_id, username: '', real_name: null },
    };
  });

  return { list, total: count, page, size };
}
