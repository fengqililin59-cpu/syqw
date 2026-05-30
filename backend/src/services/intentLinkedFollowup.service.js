/**
 * @file 意向评分 × 自动跟进联动：按分层决定静默时长阈值与 AI 话术，企微应用消息提醒销售（客户侧直发需单独对接）。
 * @description 与 automation_rules 并行；防翻车：需已打分、客户侧刚发言则跳过、每客户最多 3 次、高 6h/其他 24h 冷却、低意向二次需间隔 7 天。
 */
import { QueryTypes } from 'sequelize';
import { Op } from 'sequelize';
import { sequelize, Tenant, Customer, User, AutomationLog, CustomerFollowUp } from '../models/index.js';
import { generateAutomationFollowupLine } from './aiContent.service.js';
import { sendAgentTextMessage } from './wework.service.js';

const MAX_FOLLOWUPS = 3;
/** 高意向：销售侧静默 ≥2h */
const H_HIGH = 2;
const H_MID = 24;
const H_LOW = 72;
/** 流失：意向分 <30 且销售侧静默 ≥7 天 */
const CHURN_MAX_SCORE = 29;
const H_CHURN = 168;
/** 高意向两次提醒最短间隔 */
const GAP_HIGH_MS = 6 * 3600 * 1000;
/** 中/低：同一天最多一条 → 24h */
const GAP_OTHER_MS = 24 * 3600 * 1000;
/** 低意向：有过触达后，再次至少间隔 7 天 */
const LOW_REPEAT_MS = 7 * 24 * 3600 * 1000;
/** 客户刚发言，留给人工：最后一条是客户且小于此时长则不发联动 */
const CUSTOMER_HOT_HOURS = 4;

/**
 * @param {number} tenantId
 * @returns {Promise<Map<number, { direction: string; msg_time: Date }>>}
 */
async function loadLastMessageByCustomer(tenantId) {
  /** @type {Array<{ customer_id: number; direction: string; msg_time: Date }>} */
  const rows = await sequelize.query(
    `
    SELECT customer_id, direction, msg_time
    FROM (
      SELECT
        customer_id,
        direction,
        msg_time,
        ROW_NUMBER() OVER (
          PARTITION BY customer_id
          ORDER BY msg_time DESC, id DESC
        ) AS rn
      FROM wework_customer_messages
      WHERE tenant_id = :tid AND customer_id IS NOT NULL
    ) t
    WHERE rn = 1
    `,
    { replacements: { tid: tenantId }, type: QueryTypes.SELECT },
  );
  const m = new Map();
  for (const r of rows) {
    m.set(Number(r.customer_id), {
      direction: String(r.direction),
      msg_time: r.msg_time,
    });
  }
  return m;
}

/**
 * @param {import('../models/customer.model.js').Customer} customer
 * @param {{ direction: string; msg_time: Date } | undefined} snap
 */
function shouldSkipHotConversation(snap) {
  if (!snap) return false;
  if (snap.direction !== 'customer') return false;
  const h = (Date.now() - new Date(snap.msg_time).getTime()) / 3600000;
  return h < CUSTOMER_HOT_HOURS;
}

/**
 * @param {'high'|'medium'|'low'} tier
 * @param {import('../models/customer.model.js').Customer} customer
 */
function gapAllows(tier, customer) {
  const last = customer.last_followup_at ? new Date(customer.last_followup_at).getTime() : 0;
  if (!last) return true;
  const elapsed = Date.now() - last;
  if (tier === 'high') return elapsed >= GAP_HIGH_MS;
  return elapsed >= GAP_OTHER_MS;
}

/**
 * @param {import('../models/customer.model.js').Customer} customer
 * @param {number} hoursStaffSilence
 */
function pickTier(score, hoursStaffSilence) {
  if (score >= 80 && hoursStaffSilence >= H_HIGH) return 'high';
  if (score >= 50 && score < 80 && hoursStaffSilence >= H_MID) return 'medium';
  if (score < 50 && hoursStaffSilence >= H_LOW) return 'low';
  return null;
}

/**
 * @param {'high'|'medium'|'low'} tier
 */
function variantForTier(tier) {
  if (tier === 'high') return 'intent_linked_high';
  if (tier === 'medium') return 'intent_linked_mid';
  return 'intent_linked_low';
}

/**
 * @param {'high'|'medium'|'low'} tier
 */
function priorityLabel(tier) {
  if (tier === 'high') return 'high';
  if (tier === 'medium') return 'medium';
  return 'low';
}

/**
 * @param {object} tenant
 * @param {import('../models/customer.model.js').Customer} customer
 * @param {{ direction: string; msg_time: Date } | undefined} snap
 */
async function maybeChurn(tenant, customer, snap) {
  if (!customer.last_scored_at) return false;
  if (customer.intent_score > CHURN_MAX_SCORE) return false;
  if (!snap || snap.direction !== 'staff') return false;
  const h = (Date.now() - new Date(snap.msg_time).getTime()) / 3600000;
  if (h < H_CHURN) return false;

  await customer.update({
    stage: 'lost',
    automation_paused: 1,
    priority: 'low',
  });

  await AutomationLog.create({
    tenant_id: tenant.id,
    customer_id: customer.id,
    rule_id: null,
    trigger_type: 'intent_churn',
    action_taken: 'mark_lost',
    status: 'success',
    message_preview: `意向分${customer.intent_score}且长期未互动，标记流失并暂停自动化`,
    detail_json: { intent_score: customer.intent_score, hours_staff_silent: Math.round(h) },
    executed_at: new Date(),
  });
  return true;
}

/**
 * @param {object} tenant
 * @param {import('../models/customer.model.js').Customer} customer
 * @param {{ direction: string; msg_time: Date } | undefined} snap
 */
async function executeTierNotify(tenant, customer, tier) {
  const plain = customer.get({ plain: true });
  const variant = variantForTier(tier);
  let line = '您好，这边随时在岗，有需要您吩咐一声即可。';
  try {
    const r = await generateAutomationFollowupLine({
      tenantId: tenant.id,
      customer: {
        id: plain.id,
        owner_id: plain.owner_id,
        name: plain.name,
        stage: plain.stage,
      },
      promptVariant: variant,
    });
    line = tier === 'high' ? r.line.slice(0, 90) : r.line;
  } catch (e) {
    console.error('[intent-linked] ai line failed', e);
  }

  const name = plain.name || plain.nickname || '客户';
  const urgent =
    tier === 'high' ? '【🔥高意向·优先跟进】' : tier === 'medium' ? '【跟进保温】' : '【轻触达】';
  const notifyText = `${urgent}\n客户「${name}」意向分 ${plain.intent_score ?? '—'} · ${plain.intent_tier || ''}\n建议发给客户的话术：${line}`;

  let notified = false;
  const owner = plain.owner;
  const touser = owner?.wework_userid;
  if (touser) {
    try {
      await sendAgentTextMessage(tenant, { touser, content: notifyText });
      notified = true;
    } catch (e) {
      console.error('[intent-linked] notify failed', e);
    }
  }

  await CustomerFollowUp.create({
    customer_id: customer.id,
    user_id: customer.owner_id,
    type: 'wechat',
    content: `[意向联动·${tier === 'medium' ? '中' : tier === 'high' ? '高' : '低'}] ${line}`,
    next_follow_at: null,
  }).catch(() => {});

  await customer.update({
    followup_count: Number(customer.followup_count || 0) + 1,
    last_followup_at: new Date(),
    priority: priorityLabel(tier),
  });

  await AutomationLog.create({
    tenant_id: tenant.id,
    customer_id: customer.id,
    rule_id: null,
    trigger_type: `intent_linked_${tier}`,
    action_taken: 'ai_notify_owner',
    status: notified ? 'success' : 'fail',
    message_preview: line.slice(0, 500),
    detail_json: { tier, notified, intent_score: plain.intent_score },
    executed_at: new Date(),
  });
}

/**
 * @param {object} tenant
 * @param {import('../models/customer.model.js').Customer} customer
 * @param {{ direction: string; msg_time: Date } | undefined} snap
 */
async function processCustomer(tenant, customer, snap) {
  if (customer.automation_paused) return;
  if (['deal', 'lost'].includes(String(customer.stage))) return;

  if (await maybeChurn(tenant, customer, snap)) return;

  if (!customer.last_scored_at) return;
  if (Number(customer.followup_count || 0) >= MAX_FOLLOWUPS) return;

  if (shouldSkipHotConversation(snap)) return;

  if (!snap || snap.direction !== 'staff') return;

  const hoursStaff = (Date.now() - new Date(snap.msg_time).getTime()) / 3600000;
  const score = Number(customer.intent_score) || 0;

  const tier = pickTier(score, hoursStaff);
  if (!tier) return;

  if (tier === 'low' && Number(customer.followup_count || 0) >= 1) {
    const lastFu = customer.last_followup_at ? new Date(customer.last_followup_at).getTime() : 0;
    if (lastFu && Date.now() - lastFu < LOW_REPEAT_MS) return;
  }

  if (!gapAllows(tier, customer)) return;

  await executeTierNotify(tenant, customer, tier);
}

export async function runIntentLinkedFollowupScan() {
  const tenants = await Tenant.findAll({
    attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id', 'name'],
  });

  for (const tenant of tenants) {
    let lastMap;
    try {
      lastMap = await loadLastMessageByCustomer(tenant.id);
    } catch (e) {
      console.error('[intent-linked] last msg map', e);
      continue;
    }

    const customers = await Customer.findAll({
      where: {
        tenant_id: tenant.id,
        automation_paused: 0,
        stage: { [Op.notIn]: ['deal', 'lost'] },
      },
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'wework_userid', 'real_name', 'username'],
          required: false,
        },
      ],
    });

    for (const c of customers) {
      try {
        await processCustomer(tenant, c, lastMap.get(c.id));
      } catch (e) {
        console.error(`[intent-linked] tenant ${tenant.id} customer ${c.id}`, e);
      }
    }
  }
}
