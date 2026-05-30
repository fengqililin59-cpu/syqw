/**
 * @file CRM 销售阶段 ↔ 收件箱 sales_stage 双向映射与同步。
 *
 * CRM: new → intent_confirm → proposal → negotiation → deal → lost
 * 收件箱: new → qualify → proposal → quote → followup → deal → after_sale
 */
import { InboxThread, Customer } from '../models/index.js';

export const CRM_STAGE_LABELS = {
  new: '新线索',
  intent_confirm: '意向确认',
  proposal: '方案报价',
  negotiation: '商务谈判',
  deal: '成交',
  lost: '流失',
};

export const INBOX_STAGE_LABELS = {
  new: '新客',
  qualify: '需求确认',
  proposal: '方案',
  quote: '报价',
  followup: '跟单',
  deal: '成交',
  after_sale: '售后',
};

/**
 * @param {string|null|undefined} crmStage
 */
export function crmStageToInboxStage(crmStage) {
  const m = {
    new: 'new',
    intent_confirm: 'qualify',
    contacted: 'qualify',
    intent: 'qualify',
    proposal: 'proposal',
    negotiation: 'quote',
    deal: 'deal',
    won: 'deal',
    lost: 'followup',
  };
  return m[String(crmStage || '').trim()] || 'new';
}

/**
 * @param {string|null|undefined} inboxStage
 * @param {string|null|undefined} [currentCrmStage]
 */
export function inboxStageToCrmStage(inboxStage, currentCrmStage = null) {
  const s = String(inboxStage || '').trim();
  const cur = currentCrmStage ? String(currentCrmStage).trim() : null;

  if (s === 'after_sale') return 'deal';
  if (s === 'followup') {
    if (cur === 'lost') return 'lost';
    return 'negotiation';
  }

  const m = {
    new: 'new',
    qualify: 'intent_confirm',
    proposal: 'proposal',
    quote: 'negotiation',
    deal: 'deal',
  };
  return m[s] || null;
}

/**
 * @param {number} tenantId
 * @param {number} customerId
 * @param {string} crmStage
 */
export async function syncInboxThreadsFromCustomerStage(tenantId, customerId, crmStage) {
  const tid = Number(tenantId);
  const cid = Number(customerId);
  if (!tid || !cid) return { updated: 0 };

  const targetBase = crmStageToInboxStage(crmStage);
  const threads = await InboxThread.findAll({
    where: { tenant_id: tid, customer_id: cid },
    attributes: ['id', 'sales_stage'],
  });

  let updated = 0;
  for (const thread of threads) {
    let target = targetBase;
    if (crmStage === 'deal' && thread.sales_stage === 'after_sale') {
      target = 'after_sale';
    }
    if (thread.sales_stage !== target) {
      await thread.update({ sales_stage: target });
      updated += 1;
    }
  }
  return { updated };
}

/**
 * 收件箱改阶段时回写 CRM（并同步该客户其余会话）。
 * @param {import('../models/inboxThread.model.js').InboxThread} thread
 */
export async function syncCustomerStageFromInboxThread(thread) {
  const customerId = thread.customer_id != null ? Number(thread.customer_id) : null;
  if (!customerId || !thread.sales_stage) return { updated: false };

  const customer = await Customer.findByPk(customerId, {
    attributes: ['id', 'tenant_id', 'stage'],
  });
  if (!customer || Number(customer.tenant_id) !== Number(thread.tenant_id)) {
    return { updated: false };
  }

  const nextCrm = inboxStageToCrmStage(thread.sales_stage, customer.stage);
  if (!nextCrm || customer.stage === nextCrm) {
    return { updated: false, crm_stage: customer.stage };
  }

  await customer.update({ stage: nextCrm });
  await syncInboxThreadsFromCustomerStage(customer.tenant_id, customer.id, nextCrm);
  return { updated: true, crm_stage: nextCrm, from_inbox_stage: thread.sales_stage };
}

/**
 * @param {string|null|undefined} crmStage
 */
export function crmStageLabel(crmStage) {
  return CRM_STAGE_LABELS[String(crmStage || '').trim()] || String(crmStage || '—');
}

/**
 * @param {string|null|undefined} inboxStage
 */
export function inboxStageLabel(inboxStage) {
  return INBOX_STAGE_LABELS[String(inboxStage || '').trim()] || String(inboxStage || '—');
}
