/**
 * @file 消耗驱动的复购扫描：每日扫描卡项剩余量/有效期与到店间隔，命中则启动对应流程。
 * 同一客户在同一流程的冷却期内不会被重复触发，避免消息轰炸。
 */
import { Op } from 'sequelize';
import { Customer, CustomerCard, Flow, FlowNode, FlowRun } from '../models/index.js';
import { FLOW_TRIGGER_TYPES, SCHEDULED_TRIGGER_TYPES } from '../constants/flowTriggers.js';
import { startFlowRun } from './flowEngine.service.js';

/** 同一流程对同一客户的最小重复触发间隔（天） */
const DEFAULT_COOLDOWN_DAYS = 30;

const DEFAULTS = {
  [FLOW_TRIGGER_TYPES.CARD_TIMES_LOW]: { threshold: 2 },
  [FLOW_TRIGGER_TYPES.CARD_EXPIRING]: { days: 30 },
  [FLOW_TRIGGER_TYPES.CARD_BALANCE_LOW]: { threshold: 200 },
  [FLOW_TRIGGER_TYPES.CUSTOMER_SLEEPING]: { days: 60 },
};

/**
 * 找出命中某触发器的客户 ID。
 * @param {number} tenantId
 * @param {string} triggerType
 * @param {Record<string, unknown>} cfg
 * @returns {Promise<number[]>}
 */
async function matchCustomerIds(tenantId, triggerType, cfg) {
  if (triggerType === FLOW_TRIGGER_TYPES.CARD_TIMES_LOW) {
    const threshold = Number(cfg.threshold) || DEFAULTS[triggerType].threshold;
    const rows = await CustomerCard.findAll({
      where: {
        tenant_id: tenantId,
        status: 'active',
        card_type: 'times',
        remaining_times: { [Op.lte]: threshold, [Op.gt]: 0 },
      },
      attributes: ['customer_id'],
      group: ['customer_id'],
      raw: true,
    });
    return rows.map((r) => Number(r.customer_id));
  }

  if (triggerType === FLOW_TRIGGER_TYPES.CARD_EXPIRING) {
    const days = Number(cfg.days) || DEFAULTS[triggerType].days;
    const before = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const rows = await CustomerCard.findAll({
      where: {
        tenant_id: tenantId,
        status: 'active',
        valid_until: { [Op.gte]: today, [Op.lte]: before },
      },
      attributes: ['customer_id'],
      group: ['customer_id'],
      raw: true,
    });
    return rows.map((r) => Number(r.customer_id));
  }

  if (triggerType === FLOW_TRIGGER_TYPES.CARD_BALANCE_LOW) {
    const threshold = Number(cfg.threshold) || DEFAULTS[triggerType].threshold;
    const rows = await CustomerCard.findAll({
      where: {
        tenant_id: tenantId,
        status: 'active',
        card_type: 'stored',
        remaining_amount: { [Op.lte]: threshold, [Op.gt]: 0 },
      },
      attributes: ['customer_id'],
      group: ['customer_id'],
      raw: true,
    });
    return rows.map((r) => Number(r.customer_id));
  }

  if (triggerType === FLOW_TRIGGER_TYPES.CUSTOMER_SLEEPING) {
    const days = Number(cfg.days) || DEFAULTS[triggerType].days;
    const before = new Date(Date.now() - days * 86_400_000);
    const rows = await Customer.findAll({
      where: {
        tenant_id: tenantId,
        last_visit_at: { [Op.ne]: null, [Op.lte]: before },
        // 已有未来预约的客户不算沉睡
        [Op.or]: [{ next_appointment_at: null }, { next_appointment_at: { [Op.lt]: new Date() } }],
      },
      attributes: ['id'],
      raw: true,
    });
    return rows.map((r) => Number(r.id));
  }

  return [];
}

/**
 * 过滤掉冷却期内已被该流程触发过的客户。
 */
async function filterCooldown(flowId, customerIds, cooldownDays) {
  if (customerIds.length === 0) return [];
  const since = new Date(Date.now() - cooldownDays * 86_400_000);
  const recent = await FlowRun.findAll({
    where: {
      flow_id: flowId,
      customer_id: { [Op.in]: customerIds },
      created_at: { [Op.gte]: since },
    },
    attributes: ['customer_id'],
    raw: true,
  });
  const blocked = new Set(recent.map((r) => String(r.customer_id)));
  return customerIds.filter((id) => !blocked.has(String(id)));
}

/**
 * 执行一次全量扫描。
 * @param {{ tenantId?: number, limitPerFlow?: number }} [opts]
 */
export async function runRepurchaseScanOnce(opts = {}) {
  const where = { status: 'active' };
  if (opts.tenantId) where.tenant_id = opts.tenantId;

  const flows = await Flow.findAll({ where, attributes: ['id', 'tenant_id'] });
  const limitPerFlow = Number(opts.limitPerFlow) || 200;

  const result = { flows_scanned: 0, runs_started: 0, errors: 0 };

  for (const flow of flows) {
    const trigger = await FlowNode.findOne({ where: { flow_id: flow.id, type: 'trigger' } });
    const cfg = trigger?.get('config') || {};
    if (!SCHEDULED_TRIGGER_TYPES.includes(cfg.type)) continue;

    result.flows_scanned += 1;
    const cooldown = Number(cfg.cooldown_days) || DEFAULT_COOLDOWN_DAYS;

    try {
      const matched = await matchCustomerIds(flow.tenant_id, cfg.type, cfg);
      const targets = (await filterCooldown(flow.id, matched, cooldown)).slice(0, limitPerFlow);

      for (const customerId of targets) {
        try {
          await startFlowRun({ tenantId: flow.tenant_id, flowId: flow.id, customerId });
          result.runs_started += 1;
        } catch (e) {
          result.errors += 1;
          console.error('[repurchase] start run failed', flow.id, customerId, e.message);
        }
      }
    } catch (e) {
      result.errors += 1;
      console.error('[repurchase] scan flow failed', flow.id, e);
    }
  }

  return result;
}
