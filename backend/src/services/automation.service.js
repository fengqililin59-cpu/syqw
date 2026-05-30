/**
 * @file 自动跟进：规则匹配 → AI 话术 → 企微应用消息提醒负责人（人工发给客户，降低骚扰与封控风险）。
 */
import { QueryTypes } from 'sequelize';
import { Op } from 'sequelize';
import {
  sequelize,
  AutomationRule,
  AutomationLog,
  Customer,
  User,
  Tenant,
  CustomerFollowUp,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin, customerWhereScope } from '../utils/permissions.js';
import { generateAutomationFollowupLine } from './aiContent.service.js';
import { sendAgentTextMessage } from './wework.service.js';
import { writeAuditLog } from './auditLog.service.js';

const TRIGGER = {
  NO_REPLY_HOURS: 'no_reply_hours',
  HIGH_INTENT_SILENCE: 'high_intent_silence',
  CUSTOMER_CREATED: 'customer_created',
};

function mergeActionConfig(rule) {
  const c = rule.action_config && typeof rule.action_config === 'object' ? rule.action_config : {};
  const maxPer =
    c.max_per_customer !== undefined && c.max_per_customer !== null
      ? Number(c.max_per_customer)
      : 8;
  return {
    use_ai: c.use_ai !== false,
    ai_prompt: c.ai_prompt || 'gentle_followup',
    cooldown_hours: Number(c.cooldown_hours) || 24,
    max_per_customer: Number.isFinite(maxPer) ? maxPer : 8,
    notify_wework: c.notify_wework !== false,
    write_follow_up_record: c.write_follow_up_record !== false,
  };
}

/**
 * @param {Map<number, { direction: string; msg_time: Date }>} lastByCustomer
 * @param {number} hours
 */
function collectStaffLastSilentCustomerIds(lastByCustomer, hours) {
  const ms = hours * 3600 * 1000;
  const now = Date.now();
  const ids = [];
  for (const [cid, snap] of lastByCustomer) {
    if (snap.direction !== 'staff') continue;
    if (now - new Date(snap.msg_time).getTime() < ms) continue;
    ids.push(cid);
  }
  return ids;
}

/**
 * 每个客户最后一条企微消息方向（无消息则不在结果中）。
 * @param {number} tenantId
 */
async function loadLastMessageSnapshot(tenantId) {
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
  return rows;
}

/**
 * @param {number} tenantId
 * @param {import('../models/automationRule.model.js').AutomationRule} rule
 * @param {Map<number, { direction: string; msg_time: Date }>} lastByCustomer
 */
async function loadNoReplyCandidates(tenantId, rule, lastByCustomer) {
  const hours = Number(rule.trigger_config?.hours) || 24;
  const ids = collectStaffLastSilentCustomerIds(lastByCustomer, hours);
  if (!ids.length) return [];
  return loadCustomersByIds(tenantId, ids);
}

async function loadCustomersByIds(tenantId, ids) {
  return Customer.findAll({
    where: {
      id: { [Op.in]: ids },
      tenant_id: tenantId,
      automation_paused: 0,
      stage: { [Op.notIn]: ['deal', 'lost'] },
    },
    include: [{ model: User, as: 'owner', attributes: ['id', 'wework_userid', 'real_name', 'username'] }],
  });
}

async function loadNewCustomerCandidates(tenantId, rule) {
  const delayMin = Number(rule.trigger_config?.delay_minutes) || 5;
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const rows = await Customer.findAll({
    where: {
      tenant_id: tenantId,
      automation_paused: 0,
      created_at: { [Op.gte]: since },
    },
    include: [{ model: User, as: 'owner', attributes: ['id', 'wework_userid', 'real_name', 'username'] }],
  });
  const out = [];
  const threshold = delayMin * 60 * 1000;
  for (const c of rows) {
    const t0 = c.added_at ? new Date(c.added_at).getTime() : new Date(c.createdAt).getTime();
    if (Date.now() - t0 < threshold) continue;
    out.push(c);
  }
  return out;
}

async function countRuleSuccesses(tenantId, customerId, ruleId) {
  return AutomationLog.count({
    where: {
      tenant_id: tenantId,
      customer_id: customerId,
      rule_id: ruleId,
      status: 'success',
    },
  });
}

async function lastRuleFireAt(tenantId, customerId, ruleId) {
  const row = await AutomationLog.findOne({
    where: { tenant_id: tenantId, customer_id: customerId, rule_id: ruleId, status: 'success' },
    order: [['executed_at', 'DESC']],
    attributes: ['executed_at'],
  });
  return row?.executed_at ? new Date(row.executed_at).getTime() : 0;
}

/**
 * @param {import('../models/customer.model.js').Customer} customer
 * @param {import('../models/automationRule.model.js').AutomationRule} rule
 */
function matchHighIntentFilters(customer, rule) {
  const minScore = rule.trigger_config?.min_intent_score;
  if (minScore != null && Number(customer.intent_score) >= Number(minScore)) {
    return true;
  }
  const minInt = rule.trigger_config?.min_intention_level;
  const stages = Array.isArray(rule.trigger_config?.stages) ? rule.trigger_config.stages.map(String) : [];
  if (minInt != null && Number(customer.intention_level) >= Number(minInt)) {
    return true;
  }
  if (stages.length && stages.includes(String(customer.stage))) {
    return true;
  }
  return false;
}

/**
 * @param {object} tenant
 * @param {import('../models/automationRule.model.js').AutomationRule} rule
 * @param {import('../models/customer.model.js').Customer} customer
 */
async function executeRuleForCustomer(tenant, rule, customer) {
  const ac = mergeActionConfig(rule);
  const now = Date.now();
  if (ac.max_per_customer > 0 && customer.automation_followup_count >= ac.max_per_customer) {
    return;
  }
  const lastAt = await lastRuleFireAt(tenant.id, customer.id, rule.id);
  if (lastAt && now - lastAt < ac.cooldown_hours * 3600 * 1000) {
    return;
  }

  if (rule.trigger_type === TRIGGER.CUSTOMER_CREATED) {
    const n = await countRuleSuccesses(tenant.id, customer.id, rule.id);
    if (n >= 1) {
      return;
    }
  }

  const plain = customer.get({ plain: true });
  let line = '您好，如有需要我随时在。';
  if (ac.use_ai) {
    try {
      const v = ac.ai_prompt === 'welcome' || ac.ai_prompt === 'close_nudge' ? ac.ai_prompt : 'gentle_followup';
      const r = await generateAutomationFollowupLine({
        tenantId: tenant.id,
        customer: { id: plain.id, owner_id: plain.owner_id, name: plain.name, stage: plain.stage },
        promptVariant: v,
      });
      line = r.line;
    } catch (e) {
      await AutomationLog.create({
        tenant_id: tenant.id,
        customer_id: customer.id,
        rule_id: rule.id,
        trigger_type: rule.trigger_type,
        action_taken: 'fail',
        status: 'fail',
        message_preview: null,
        detail_json: { error: String(e?.message || e) },
        executed_at: new Date(),
      });
      return;
    }
  }

  const name = plain.name || plain.nickname || '客户';
  const notifyText = `【自动跟进·${rule.name}】\n客户「${name}」\n建议话术：${line}`;

  let notified = false;
  let notifyError = null;
  if (ac.notify_wework) {
    const owner = plain.owner;
    const touser = owner?.wework_userid;
    if (touser) {
      try {
        await sendAgentTextMessage(tenant, { touser, content: notifyText });
        notified = true;
      } catch (e) {
        notifyError = String(e?.message || e);
      }
    } else {
      notifyError = 'owner_no_wework_userid';
    }
  }

  const deliveryOk = !ac.notify_wework || notified;

  if (deliveryOk && ac.write_follow_up_record) {
    try {
      await CustomerFollowUp.create({
        customer_id: customer.id,
        user_id: customer.owner_id,
        type: 'wechat',
        content: `[系统·${rule.name}] ${line}`,
        next_follow_at: null,
      });
    } catch (e) {
      console.error('[automation] follow-up record failed', e);
    }
  }

  if (deliveryOk) {
    await customer.update({
      automation_followup_count: Number(customer.automation_followup_count || 0) + 1,
      last_automation_followup_at: new Date(),
    });
  }

  await AutomationLog.create({
    tenant_id: tenant.id,
    customer_id: customer.id,
    rule_id: rule.id,
    trigger_type: rule.trigger_type,
    action_taken: 'ai_notify_owner',
    status: deliveryOk ? 'success' : 'fail',
    message_preview: line.slice(0, 500),
    detail_json: {
      notified,
      notify_error: notifyError,
      rule_name: rule.name,
    },
    executed_at: new Date(),
  });
}

/**
 * 扫描一次（供 cron 或手动触发）。
 */
export async function runAutomationScanOnce() {
  const tenants = await Tenant.findAll({
    attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id', 'name'],
  });

  for (const tenant of tenants) {
    const rules = await AutomationRule.findAll({
      where: { tenant_id: tenant.id, enabled: 1 },
      order: [['id', 'ASC']],
    });
    if (!rules.length) continue;

    const lastRows = await loadLastMessageSnapshot(tenant.id);
    /** @type {Map<number, { direction: string; msg_time: Date }>} */
    const lastByCustomer = new Map();
    for (const r of lastRows) {
      lastByCustomer.set(Number(r.customer_id), {
        direction: String(r.direction),
        msg_time: r.msg_time,
      });
    }

    for (const rule of rules) {
      try {
        if (rule.trigger_type === TRIGGER.NO_REPLY_HOURS) {
          const customers = await loadNoReplyCandidates(tenant.id, rule, lastByCustomer);
          for (const c of customers) {
            await executeRuleForCustomer(tenant, rule, c);
          }
        } else if (rule.trigger_type === TRIGGER.HIGH_INTENT_SILENCE) {
          const hours = Number(rule.trigger_config?.hours) || 2;
          const ids = collectStaffLastSilentCustomerIds(lastByCustomer, hours);
          if (!ids.length) continue;
          const customers = await loadCustomersByIds(tenant.id, ids);
          for (const c of customers) {
            if (!matchHighIntentFilters(c, rule)) continue;
            await executeRuleForCustomer(tenant, rule, c);
          }
        } else if (rule.trigger_type === TRIGGER.CUSTOMER_CREATED) {
          const customers = await loadNewCustomerCandidates(tenant.id, rule);
          for (const c of customers) {
            await executeRuleForCustomer(tenant, rule, c);
          }
        }
      } catch (e) {
        console.error(`[automation] tenant ${tenant.id} rule ${rule.id}`, e);
      }
    }
  }
}

export async function listRules(auth) {
  const rows = await AutomationRule.findAll({
    where: { tenant_id: auth.tenantId },
    order: [['id', 'ASC']],
  });
  return { list: rows.map((r) => r.get({ plain: true })) };
}

export async function patchRule(auth, ruleId, body, context = {}) {
  const rule = await AutomationRule.findOne({
    where: { id: ruleId, tenant_id: auth.tenantId },
  });
  if (!rule) {
    throw new HttpError(404, '规则不存在', 404);
  }
  const beforeEnabled = Number(rule.enabled) === 1;
  if (body.enabled != null) {
    rule.enabled = body.enabled ? 1 : 0;
  }
  if (body.name != null) {
    rule.name = String(body.name).slice(0, 100);
  }
  if (body.trigger_config != null) {
    rule.trigger_config = body.trigger_config;
  }
  if (body.action_config != null) {
    rule.action_config = body.action_config;
  }
  await rule.save();
  const afterEnabled = Number(rule.enabled) === 1;
  if (body.enabled != null && beforeEnabled !== afterEnabled) {
    await writeAuditLog(auth, {
      action: 'automation_rule_toggle',
      targetType: 'automation_rule',
      targetId: rule.id,
      detail: {
        rule_name: rule.name,
        before_enabled: beforeEnabled,
        after_enabled: afterEnabled,
      },
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }
  return rule.get({ plain: true });
}

/**
 * 创建三条内置规则（幂等：每个租户仅在没有规则时插入；也可手动多次调用需前端确认）。
 */
export async function bootstrapDefaultRules(auth) {
  const n = await AutomationRule.count({ where: { tenant_id: auth.tenantId } });
  if (n > 0) {
    return { created: 0, message: '已存在规则，跳过初始化' };
  }
  const uid = auth.userId;
  await AutomationRule.bulkCreate([
    {
      tenant_id: auth.tenantId,
      name: '新客户欢迎提醒',
      trigger_type: TRIGGER.CUSTOMER_CREATED,
      trigger_config: { delay_minutes: 5 },
      action_type: 'notify_owner',
      action_config: {
        use_ai: true,
        ai_prompt: 'welcome',
        cooldown_hours: 168,
        max_per_customer: 1,
        notify_wework: true,
      },
      enabled: 1,
      created_by: uid,
    },
    {
      tenant_id: auth.tenantId,
      name: '客户未回复（按小时）',
      trigger_type: TRIGGER.NO_REPLY_HOURS,
      trigger_config: { hours: 24 },
      action_type: 'notify_owner',
      action_config: {
        use_ai: true,
        ai_prompt: 'gentle_followup',
        cooldown_hours: 24,
        max_per_customer: 8,
      },
      enabled: 1,
      created_by: uid,
    },
    {
      tenant_id: auth.tenantId,
      name: '高意向沉默',
      trigger_type: TRIGGER.HIGH_INTENT_SILENCE,
      trigger_config: {
        hours: 2,
        min_intention_level: 4,
        stages: ['proposal', 'negotiation'],
      },
      action_type: 'notify_owner',
      action_config: {
        use_ai: true,
        ai_prompt: 'close_nudge',
        cooldown_hours: 12,
        max_per_customer: 5,
      },
      enabled: 0,
      created_by: uid,
    },
  ]);
  return { created: 3, message: '已创建默认规则（高意向规则默认关闭）' };
}

export async function setCustomerAutomationPaused(auth, customerId, paused) {
  const where = { id: customerId, ...customerWhereScope(auth) };
  const row = await Customer.findOne({ where });
  if (!row) {
    throw new HttpError(404, '客户不存在', 404);
  }
  await row.update({ automation_paused: paused ? 1 : 0 });
  return { id: row.id, automation_paused: paused ? 1 : 0 };
}

export async function triggerAutomationScanOnce(auth) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '仅管理员可手动触发扫描', 403);
  }
  await runAutomationScanOnce();
  return { ok: true };
}
