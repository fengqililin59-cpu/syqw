/**
 * @file 订单金额聚合与客户成交阶段联动。
 */
import { QueryTypes } from 'sequelize';
import { CustomerOrder, Customer, sequelize } from '../models/index.js';
import { customerWhereScope, isAdmin } from '../utils/permissions.js';
import { syncInboxThreadsFromCustomerStage } from './salesStageSync.service.js';
import { dispatchStageChangedFlows } from './flowEngine.service.js';

export const REVENUE_ORDER_STATUSES = ['paid', 'completed', 'shipped'];

const STAGE_LABEL = {
  new: '新线索',
  intent_confirm: '意向确认',
  contacted: '意向确认',
  intent: '意向确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  deal: '成交',
  lost: '流失',
};

function normalizeStage(s) {
  const v = String(s || '').trim();
  if (v === 'contacted' || v === 'intent') return 'intent_confirm';
  return v || 'new';
}

/**
 * @param {number} tenantId
 * @param {number} customerId
 */
export async function maybePromoteCustomerOnRevenueOrder(tenantId, customerId) {
  const customer = await Customer.findOne({
    where: { id: Number(customerId), tenant_id: Number(tenantId) },
    attributes: ['id', 'stage'],
  });
  if (!customer) return { promoted: false };

  const prev = normalizeStage(customer.stage);
  if (prev === 'deal') return { promoted: false, stage: 'deal' };

  await customer.update({ stage: 'deal' });
  syncInboxThreadsFromCustomerStage(tenantId, customerId, 'deal').catch((err) =>
    console.error('[order-revenue] inbox sync', err),
  );
  dispatchStageChangedFlows(tenantId, customerId, prev, 'deal').catch((err) =>
    console.error('[order-revenue] stage_changed flow', err),
  );
  return { promoted: true, from_stage: prev, to_stage: 'deal' };
}

/**
 * @param {number} tenantId
 * @param {number[]} customerIds
 */
export async function getOrderStatsByCustomerIds(tenantId, customerIds) {
  const ids = [...new Set(customerIds.map((id) => Number(id)).filter((id) => id > 0))];
  const map = new Map();
  if (!ids.length) return map;

  const rows = await sequelize.query(
    `
    SELECT
      customer_id,
      COUNT(*) AS order_count,
      COALESCE(SUM(amount), 0) AS order_paid_total
    FROM customer_orders
    WHERE tenant_id = :tid
      AND customer_id IN (:ids)
      AND status IN (:statuses)
    GROUP BY customer_id
    `,
    {
      replacements: { tid: Number(tenantId), ids, statuses: REVENUE_ORDER_STATUSES },
      type: QueryTypes.SELECT,
    },
  );

  for (const r of rows) {
    map.set(Number(r.customer_id), {
      order_count: Number(r.order_count || 0),
      order_paid_total: Math.round(Number(r.order_paid_total || 0) * 100) / 100,
    });
  }
  return map;
}

/**
 * @param {object[]} list
 * @param {number} tenantId
 */
export async function attachOrderStatsToCustomers(tenantId, list) {
  if (!list?.length) return list;
  const statsMap = await getOrderStatsByCustomerIds(
    tenantId,
    list.map((c) => c.id),
  );
  return list.map((c) => {
    const stats = statsMap.get(Number(c.id));
    return {
      ...c,
      order_count: stats?.order_count ?? 0,
      order_paid_total: stats?.order_paid_total ?? 0,
    };
  });
}

/**
 * @param {object} auth
 */
export async function getRevenueSummary(auth) {
  const tenantId = auth.tenantId;
  const cWhere = customerWhereScope(auth);
  const ownerFilter = !isAdmin(auth) ? 'AND c.owner_id = :uid' : '';
  const replacements = { tid: tenantId, statuses: REVENUE_ORDER_STATUSES };
  if (!isAdmin(auth)) replacements.uid = auth.userId;

  const nowSh = new Date();
  const monthStart = new Date(nowSh.getFullYear(), nowSh.getMonth(), 1);

  const [totals, byStage, mtdRow] = await Promise.all([
    sequelize.query(
      `
      SELECT
        COALESCE(SUM(co.amount), 0) AS paid_total,
        COUNT(co.id) AS order_count,
        COUNT(DISTINCT co.customer_id) AS customer_count
      FROM customer_orders co
      INNER JOIN customers c ON c.id = co.customer_id AND c.tenant_id = co.tenant_id AND c.deleted_at IS NULL
      WHERE co.tenant_id = :tid
        AND co.status IN (:statuses)
        ${ownerFilter}
      `,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `
      SELECT
        c.stage,
        COALESCE(SUM(co.amount), 0) AS amount,
        COUNT(DISTINCT c.id) AS customer_count,
        COUNT(co.id) AS order_count
      FROM customer_orders co
      INNER JOIN customers c ON c.id = co.customer_id AND c.tenant_id = co.tenant_id AND c.deleted_at IS NULL
      WHERE co.tenant_id = :tid
        AND co.status IN (:statuses)
        ${ownerFilter}
      GROUP BY c.stage
      ORDER BY amount DESC
      `,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `
      SELECT COALESCE(SUM(co.amount), 0) AS paid_mtd
      FROM customer_orders co
      INNER JOIN customers c ON c.id = co.customer_id AND c.tenant_id = co.tenant_id AND c.deleted_at IS NULL
      WHERE co.tenant_id = :tid
        AND co.status IN (:statuses)
        AND co.paid_at >= :monthStart
        ${ownerFilter}
      `,
      {
        replacements: { ...replacements, monthStart },
        type: QueryTypes.SELECT,
      },
    ),
  ]);

  const t = totals[0] || {};
  const mtd = mtdRow[0] || {};

  const pipelineStages = ['intent_confirm', 'proposal', 'negotiation', 'deal'];
  let pipelineAmount = 0;
  const by_stage = byStage.map((r) => {
    const stage = String(r.stage || '');
    const amount = Math.round(Number(r.amount || 0) * 100) / 100;
    if (pipelineStages.includes(stage) || stage === 'contacted' || stage === 'intent') {
      pipelineAmount += amount;
    }
    return {
      stage,
      stage_label: STAGE_LABEL[stage] || stage,
      amount,
      customer_count: Number(r.customer_count || 0),
      order_count: Number(r.order_count || 0),
    };
  });

  return {
    paid_total: Math.round(Number(t.paid_total || 0) * 100) / 100,
    paid_mtd: Math.round(Number(mtd.paid_mtd || 0) * 100) / 100,
    order_count: Number(t.order_count || 0),
    customer_count: Number(t.customer_count || 0),
    pipeline_amount: Math.round(pipelineAmount * 100) / 100,
    by_stage,
  };
}

/**
 * @param {string} status
 */
export function isRevenueOrderStatus(status) {
  return REVENUE_ORDER_STATUSES.includes(String(status || '').trim());
}
