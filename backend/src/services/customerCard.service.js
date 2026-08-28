/**
 * @file 客户卡项：开卡、核销扣次/扣款、充值、手工调整、到期与续卡提醒。
 * 所有余额变动均在事务内对卡记录加行锁，并写入带变动后快照的流水，便于对账。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import { sequelize } from '../config/database.js';
import {
  CardTransaction,
  Customer,
  CustomerCard,
  Product,
  User,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { writeAuditLog } from './auditLog.service.js';

export const CARD_TYPES = { TIMES: 'times', STORED: 'stored', PERIOD: 'period' };
export const CARD_STATUS = {
  ACTIVE: 'active',
  USED_UP: 'used_up',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
  FROZEN: 'frozen',
};

const CARD_TYPE_LABEL = { times: '次卡', stored: '储值卡', period: '期限卡' };

const createSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  card_type: Joi.string().valid(...Object.values(CARD_TYPES)).required(),
  name: Joi.string().trim().max(200).required(),
  product_id: Joi.number().integer().positive().allow(null).optional(),
  order_id: Joi.number().integer().positive().allow(null).optional(),
  total_times: Joi.number().integer().min(1).allow(null).optional(),
  total_amount: Joi.number().min(0).allow(null).optional(),
  paid_amount: Joi.number().min(0).default(0),
  valid_from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, '').optional(),
  valid_until: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, '').optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
});

/**
 * 关联加载。product 额外按 tenant_id 过滤：历史数据里可能存在跨租户或已删除项目的
 * 悬空 product_id，不加这层过滤会泄露其他租户的项目名。
 */
const cardInclude = (tenantId) => [
  { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'], required: false },
  {
    model: Product,
    as: 'product',
    attributes: ['id', 'name'],
    required: false,
    where: { tenant_id: tenantId },
  },
];

/** 校验 product_id 属于本租户。product_id 可空，传空视为不关联卡项定义。 */
async function assertProductExists(tenantId, productId) {
  if (productId === undefined || productId === null) return null;
  const product = await Product.findOne({ where: { id: productId, tenant_id: tenantId } });
  if (!product) throw new HttpError(404, '卡项定义不存在', 404);
  return product;
}

function toNumber(v) {
  return v == null ? null : Number(v);
}

/** 序列化卡片，附带派生的提醒信息 */
function decorate(card) {
  const plain = typeof card.toJSON === 'function' ? card.toJSON() : { ...card };
  plain.card_type_label = CARD_TYPE_LABEL[plain.card_type] || plain.card_type;
  plain.total_amount = toNumber(plain.total_amount);
  plain.remaining_amount = toNumber(plain.remaining_amount);
  plain.paid_amount = toNumber(plain.paid_amount);

  if (plain.valid_until) {
    const days = Math.ceil(
      (new Date(`${plain.valid_until}T23:59:59`).getTime() - Date.now()) / 86_400_000,
    );
    plain.days_to_expire = days;
  } else {
    plain.days_to_expire = null;
  }
  return plain;
}

async function assertCustomerExists(tenantId, customerId) {
  const customer = await Customer.findOne({ where: { id: customerId, tenant_id: tenantId } });
  if (!customer) throw new HttpError(404, '客户不存在', 404);
  return customer;
}

/**
 * 依据剩余量与有效期推导卡片状态。冻结与退卡为人工状态，不自动覆盖。
 */
function deriveStatus(card) {
  if ([CARD_STATUS.FROZEN, CARD_STATUS.REFUNDED].includes(card.status)) return card.status;
  if (card.valid_until && new Date(`${card.valid_until}T23:59:59`).getTime() < Date.now()) {
    return CARD_STATUS.EXPIRED;
  }
  if (card.card_type === CARD_TYPES.TIMES && Number(card.remaining_times) <= 0) {
    return CARD_STATUS.USED_UP;
  }
  if (card.card_type === CARD_TYPES.STORED && Number(card.remaining_amount) <= 0) {
    return CARD_STATUS.USED_UP;
  }
  return CARD_STATUS.ACTIVE;
}

/** 重算客户累计消费金额（LTV 缓存） */
async function refreshCustomerPaidTotal(tenantId, customerId, transaction) {
  const total = await CustomerCard.sum('paid_amount', {
    where: {
      tenant_id: tenantId,
      customer_id: customerId,
      status: { [Op.ne]: CARD_STATUS.REFUNDED },
    },
    transaction,
  });
  await Customer.update(
    { total_paid_amount: Number(total) || 0 },
    { where: { id: customerId, tenant_id: tenantId }, transaction },
  );
}

/**
 * 某客户的持卡列表。
 */
export async function listCustomerCards(tenantId, customerId, query = {}) {
  const where = { tenant_id: tenantId, customer_id: Number(customerId) };
  if (query.status) where.status = query.status;

  const rows = await CustomerCard.findAll({
    where,
    include: cardInclude(tenantId),
    order: [['created_at', 'DESC']],
  });
  return { list: rows.map(decorate) };
}

export async function getCard(tenantId, id) {
  const card = await CustomerCard.findOne({
    where: { id, tenant_id: tenantId },
    include: cardInclude(tenantId),
  });
  if (!card) throw new HttpError(404, '卡项不存在', 404);
  return card;
}

/**
 * 开卡。次卡必须给总次数，储值卡必须给面值。
 */
export async function createCard(tenantId, body, ctx = {}) {
  const { error, value } = createSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  await assertCustomerExists(tenantId, value.customer_id);
  await assertProductExists(tenantId, value.product_id);

  if (value.card_type === CARD_TYPES.TIMES && !value.total_times) {
    throw new HttpError(400, '次卡必须填写总次数', 400);
  }
  if (value.card_type === CARD_TYPES.STORED && value.total_amount == null) {
    throw new HttpError(400, '储值卡必须填写面值', 400);
  }
  if (value.card_type === CARD_TYPES.PERIOD && !value.valid_until) {
    throw new HttpError(400, '期限卡必须填写有效期', 400);
  }

  const card = await CustomerCard.create({
    tenant_id: tenantId,
    customer_id: value.customer_id,
    product_id: value.product_id ?? null,
    order_id: value.order_id ?? null,
    card_type: value.card_type,
    name: value.name,
    total_times: value.total_times ?? null,
    remaining_times: value.total_times ?? null,
    total_amount: value.total_amount ?? null,
    remaining_amount: value.total_amount ?? null,
    paid_amount: value.paid_amount,
    valid_from: value.valid_from || null,
    valid_until: value.valid_until || null,
    status: CARD_STATUS.ACTIVE,
    metadata: value.metadata || null,
    created_by: ctx.userId ?? null,
  });

  await refreshCustomerPaidTotal(tenantId, value.customer_id);
  return decorate(await getCard(tenantId, card.id));
}

/**
 * 在事务内加锁读取卡片，执行变动并写流水。
 * @param {number} tenantId
 * @param {number} cardId
 * @param {(card: CustomerCard) => { times_delta?: number, amount_delta?: number, paid_delta?: number }} compute
 * @param {{ type: string, reason?: string, appointmentId?: number, operatorId?: number }} meta
 */
async function applyCardChange(tenantId, cardId, compute, meta) {
  return sequelize.transaction(async (t) => {
    const card = await CustomerCard.findOne({
      where: { id: cardId, tenant_id: tenantId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!card) throw new HttpError(404, '卡项不存在', 404);

    const delta = compute(card);
    const timesDelta = delta.times_delta ?? null;
    const amountDelta = delta.amount_delta ?? null;

    const patch = {};
    let timesAfter = card.remaining_times;
    let amountAfter = toNumber(card.remaining_amount);

    if (timesDelta != null) {
      timesAfter = Number(card.remaining_times || 0) + timesDelta;
      if (timesAfter < 0) throw new HttpError(400, '剩余次数不足', 400);
      patch.remaining_times = timesAfter;
    }
    if (amountDelta != null) {
      amountAfter = Number(card.remaining_amount || 0) + Number(amountDelta);
      if (amountAfter < 0) throw new HttpError(400, '卡内余额不足', 400);
      patch.remaining_amount = amountAfter;
    }
    if (delta.paid_delta) {
      patch.paid_amount = Number(card.paid_amount || 0) + Number(delta.paid_delta);
    }
    if (delta.total_times_delta) {
      patch.total_times = Number(card.total_times || 0) + Number(delta.total_times_delta);
    }
    if (delta.total_amount_delta) {
      patch.total_amount = Number(card.total_amount || 0) + Number(delta.total_amount_delta);
    }

    await card.update(patch, { transaction: t });
    await card.update({ status: deriveStatus(card) }, { transaction: t });

    await CardTransaction.create(
      {
        tenant_id: tenantId,
        card_id: card.id,
        customer_id: card.customer_id,
        appointment_id: meta.appointmentId ?? null,
        type: meta.type,
        times_delta: timesDelta,
        amount_delta: amountDelta,
        times_after: timesDelta != null ? timesAfter : null,
        amount_after: amountDelta != null ? amountAfter : null,
        reason: meta.reason ?? null,
        operator_id: meta.operatorId ?? null,
      },
      { transaction: t },
    );

    if (delta.paid_delta) {
      await refreshCustomerPaidTotal(tenantId, card.customer_id, t);
    }

    return card.id;
  });
}

const consumeSchema = Joi.object({
  times: Joi.number().integer().min(1).optional(),
  amount: Joi.number().positive().optional(),
  appointment_id: Joi.number().integer().positive().allow(null).optional(),
  reason: Joi.string().trim().max(200).allow('', null).optional(),
}).or('times', 'amount').messages({ 'object.missing': '请填写核销次数或金额' });

/**
 * 核销：次卡扣次，储值卡扣款。
 */
export async function consumeCard(tenantId, cardId, body, ctx = {}) {
  const { error, value } = consumeSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  const id = await applyCardChange(
    tenantId,
    cardId,
    (card) => {
      if (card.status !== CARD_STATUS.ACTIVE) {
        throw new HttpError(400, '该卡当前不可核销，请检查状态与有效期', 400);
      }
      if (card.card_type === CARD_TYPES.TIMES) {
        if (!value.times) throw new HttpError(400, '次卡请填写核销次数', 400);
        return { times_delta: -value.times };
      }
      if (card.card_type === CARD_TYPES.STORED) {
        if (!value.amount) throw new HttpError(400, '储值卡请填写核销金额', 400);
        return { amount_delta: -value.amount };
      }
      throw new HttpError(400, '期限卡无需核销，按有效期使用', 400);
    },
    {
      type: 'consume',
      reason: value.reason || null,
      appointmentId: value.appointment_id ?? null,
      operatorId: ctx.userId,
    },
  );

  return decorate(await getCard(tenantId, id));
}

const rechargeSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paid_amount: Joi.number().min(0).optional(),
  reason: Joi.string().trim().max(200).allow('', null).optional(),
});

/**
 * 储值卡充值。amount 为到账金额，paid_amount 为实付（含赠送时两者不同）。
 */
export async function rechargeCard(tenantId, cardId, body, ctx = {}) {
  const { error, value } = rechargeSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  const paid = value.paid_amount != null ? value.paid_amount : value.amount;

  const id = await applyCardChange(
    tenantId,
    cardId,
    (card) => {
      if (card.card_type !== CARD_TYPES.STORED) {
        throw new HttpError(400, '仅储值卡支持充值', 400);
      }
      return {
        amount_delta: value.amount,
        total_amount_delta: value.amount,
        paid_delta: paid,
      };
    },
    { type: 'recharge', reason: value.reason || null, operatorId: ctx.userId },
  );

  return decorate(await getCard(tenantId, id));
}

const adjustSchema = Joi.object({
  times_delta: Joi.number().integer().optional(),
  amount_delta: Joi.number().optional(),
  reason: Joi.string().trim().min(2).max(200).required().messages({
    'any.required': '手工调整必须填写原因',
    'string.empty': '手工调整必须填写原因',
  }),
}).or('times_delta', 'amount_delta').messages({ 'object.missing': '请填写要调整的次数或金额' });

/**
 * 手工调整次数或余额。需要 card:adjust 权限，且强制写入审计日志。
 */
export async function adjustCard(tenantId, cardId, body, ctx = {}) {
  const { error, value } = adjustSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, error.details?.[0]?.message || '参数校验失败', 400, error.details);

  if (value.times_delta === 0 || value.amount_delta === 0) {
    throw new HttpError(400, '调整值不能为 0', 400);
  }

  const before = await getCard(tenantId, cardId);

  const id = await applyCardChange(
    tenantId,
    cardId,
    () => ({
      times_delta: value.times_delta ?? null,
      amount_delta: value.amount_delta ?? null,
    }),
    { type: 'adjust', reason: value.reason, operatorId: ctx.userId },
  );

  const after = await getCard(tenantId, id);
  await writeAuditLog(
    { tenantId, userId: ctx.userId },
    {
      action: 'customer_card_adjust',
      targetType: 'customer_card',
      targetId: id,
      detail: {
        customer_id: after.customer_id,
        card_name: after.name,
        reason: value.reason,
        times_delta: value.times_delta ?? null,
        amount_delta: value.amount_delta ?? null,
        before: {
          remaining_times: before.remaining_times,
          remaining_amount: toNumber(before.remaining_amount),
        },
        after: {
          remaining_times: after.remaining_times,
          remaining_amount: toNumber(after.remaining_amount),
        },
      },
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    },
  );

  return decorate(after);
}

/**
 * 卡项流水。
 */
export async function listTransactions(tenantId, cardId, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.page_size) || 20));

  const { rows, count } = await CardTransaction.findAndCountAll({
    where: { tenant_id: tenantId, card_id: Number(cardId) },
    include: [
      { model: User, as: 'operator', attributes: ['id', 'real_name', 'username'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  return { list: rows, total: count, page, size };
}

/**
 * 复购提醒台：待续卡、将到期、低余额、沉睡客户。
 * 这是 P0-3 自动复购触发器的数据基础，也可供人工跟进直接使用。
 */
export async function listAlerts(tenantId, query = {}) {
  const lowTimes = Number(query.low_times) || 2;
  const expireDays = Number(query.expire_days) || 30;
  const lowAmount = Number(query.low_amount) || 200;
  const sleepDays = Number(query.sleep_days) || 60;

  const expireBefore = new Date(Date.now() + expireDays * 86_400_000).toISOString().slice(0, 10);
  const sleepBefore = new Date(Date.now() - sleepDays * 86_400_000);

  const activeBase = { tenant_id: tenantId, status: CARD_STATUS.ACTIVE };

  const [lowTimesCards, expiringCards, lowBalanceCards, sleepingCustomers] = await Promise.all([
    CustomerCard.findAll({
      where: {
        ...activeBase,
        card_type: CARD_TYPES.TIMES,
        remaining_times: { [Op.lte]: lowTimes, [Op.gt]: 0 },
      },
      include: cardInclude(tenantId),
      order: [['remaining_times', 'ASC']],
      limit: 100,
    }),
    CustomerCard.findAll({
      where: {
        ...activeBase,
        valid_until: { [Op.ne]: null, [Op.lte]: expireBefore },
      },
      include: cardInclude(tenantId),
      order: [['valid_until', 'ASC']],
      limit: 100,
    }),
    CustomerCard.findAll({
      where: {
        ...activeBase,
        card_type: CARD_TYPES.STORED,
        remaining_amount: { [Op.lte]: lowAmount, [Op.gt]: 0 },
      },
      include: cardInclude(tenantId),
      order: [['remaining_amount', 'ASC']],
      limit: 100,
    }),
    Customer.findAll({
      where: {
        tenant_id: tenantId,
        last_visit_at: { [Op.ne]: null, [Op.lte]: sleepBefore },
      },
      attributes: ['id', 'name', 'phone', 'last_visit_at', 'visit_count', 'total_paid_amount'],
      order: [['last_visit_at', 'ASC']],
      limit: 100,
    }),
  ]);

  return {
    thresholds: { low_times: lowTimes, expire_days: expireDays, low_amount: lowAmount, sleep_days: sleepDays },
    low_times: lowTimesCards.map(decorate),
    expiring: expiringCards.map(decorate),
    low_balance: lowBalanceCards.map(decorate),
    sleeping: sleepingCustomers,
  };
}
