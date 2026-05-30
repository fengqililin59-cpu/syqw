/**
 * @file 流程执行引擎：从头结点运行到延迟/结束；延迟依赖定时扫描恢复。
 */
import { Op } from 'sequelize';
import {
  Flow,
  FlowNode,
  FlowEdge,
  FlowRun,
  Customer,
  CustomerFollowUp,
  CustomerTag,
  Tag,
  User,
  Tenant,
  WeworkCustomerMessage,
  AutoMessageLog,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { generateAutomationFollowupLine } from './aiContent.service.js';
import { sendAgentTextMessage } from './wework.service.js';
import { sendExternalTextMessage, tryConsumeAutoSendSlot } from './weworkMessage.service.js';
import { FLOW_TRIGGER_TYPES } from '../constants/flowTriggers.js';
import { syncInboxThreadsFromCustomerStage } from './salesStageSync.service.js';
import { writeAuditLog } from './auditLog.service.js';

const STAGE_RANK = {
  new: 1,
  contacted: 2,
  intent: 2,
  intent_confirm: 2,
  proposal: 3,
  negotiation: 4,
  deal: 5,
  lost: 6,
};

function normalizeStage(stage) {
  const s = String(stage || '').trim();
  if (!s) return 'new';
  if (s === 'contacted' || s === 'intent') return 'intent_confirm';
  return s;
}

function assertNoStageRollback(fromStage, toStage) {
  const from = normalizeStage(fromStage);
  const to = normalizeStage(toStage);
  const fromRank = STAGE_RANK[from] ?? 0;
  const toRank = STAGE_RANK[to] ?? 0;
  if (fromRank > 0 && toRank > 0 && toRank < fromRank) {
    throw new Error(`自动化阶段防回退：${from} -> ${to} 被拒绝`);
  }
}

/**
 * @param {Array<{ source_key: string; target_key: string; branch?: string | null }>} edges
 * @param {string} sourceKey
 * @param {'yes' | 'no' | null} branch
 */
export function pickNextEdge(edges, sourceKey, branch) {
  const list = edges.filter((e) => e.source_key === sourceKey);
  if (branch === 'yes' || branch === 'no') {
    const hit = list.find((e) => e.branch === branch);
    if (hit) return hit.target_key;
  }
  const def = list.find((e) => e.branch == null || e.branch === '' || e.branch === 'default');
  return def?.target_key ?? null;
}

/**
 * @param {object} node plain
 * @param {number} tenantId
 * @param {number} customerId
 */
async function evaluateConditionNode(node, tenantId, customerId) {
  const cfg = node.config || {};
  if (cfg.type === 'intention_score') {
    const cust = await Customer.findOne({ where: { id: customerId, tenant_id: tenantId } });
    if (!cust) return false;
    const score = Number(cust.intent_score) || 0;
    const v = Number(cfg.value);
    switch (cfg.operator) {
      case '>':
        return score > v;
      case '>=':
        return score >= v;
      case '<':
        return score < v;
      case '<=':
        return score <= v;
      case '==':
        return score === v;
      default:
        return score >= v;
    }
  }
  if (cfg.type === 'no_reply_hours') {
    const hoursNeed = Number(cfg.hours) || 24;
    const row = await WeworkCustomerMessage.findOne({
      where: { tenant_id: tenantId, customer_id: customerId },
      order: [['msg_time', 'DESC']],
      attributes: ['direction', 'msg_time'],
    });
    if (!row || row.direction !== 'staff') return false;
    const h = (Date.now() - new Date(row.msg_time).getTime()) / 3600000;
    return h >= hoursNeed;
  }
  return false;
}

/**
 * @param {object} node plain
 * @param {import('../models/tenant.model.js').Tenant} tenant
 * @param {object} customerPlain
 * @param {import('../models/flowRun.model.js').FlowRun | null} [flowRun]
 */
async function runActionNode(node, tenant, customerPlain, flowRun) {
  const cfg = node.config || {};
  const nodeKey = node.node_key ?? null;
  const flowRunId = flowRun?.id != null ? Number(flowRun.id) : null;

  async function writeAutoMsgLog(partial) {
    try {
      await AutoMessageLog.create({
        tenant_id: tenant.id,
        customer_id: customerPlain.id,
        flow_run_id: flowRunId,
        node_key: nodeKey,
        content: (partial.content ?? '').slice(0, 8000),
        wework_errcode: partial.wework_errcode ?? null,
        wework_errmsg: partial.wework_errmsg ? String(partial.wework_errmsg).slice(0, 500) : null,
        skipped_reason: partial.skipped_reason ?? null,
        via: partial.via ?? null,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[auto_message_logs] persist failed', e);
    }
  }

  if (cfg.type === 'send_message') {
    if (!tenant.allow_auto_send) {
      await writeAutoMsgLog({ content: '[skipped]', skipped_reason: 'tenant_disabled' });
      return { skipped: true, reason: 'tenant_disabled' };
    }
    if (customerPlain.opt_out_auto_msg) {
      await writeAutoMsgLog({ content: '[skipped]', skipped_reason: 'opt_out' });
      return { skipped: true, reason: 'opt_out' };
    }
    if (!customerPlain.external_userid) {
      await writeAutoMsgLog({ content: '[skipped]', skipped_reason: 'no_external_id' });
      return { skipped: true, reason: 'no_external_id' };
    }
    const owner = customerPlain.owner;
    const sender = owner?.wework_userid;
    if (!sender) {
      await writeAutoMsgLog({ content: '[skipped]', skipped_reason: 'no_sender' });
      return { skipped: true, reason: 'no_sender' };
    }

    const mode = cfg.mode === 'ai' ? 'ai' : 'fixed';
    let messageText = '';
    if (mode === 'ai') {
      const promptKey = String(cfg.prompt || 'gentle_followup');
      const variantMap = {
        welcome: 'welcome',
        gentle_followup: 'gentle_followup',
        close_nudge: 'close_nudge',
        intent_high: 'intent_linked_high',
        intent_mid: 'intent_linked_mid',
        intent_low: 'intent_linked_low',
      };
      const variant = variantMap[promptKey] || 'gentle_followup';
      const { line } = await generateAutomationFollowupLine({
        tenantId: tenant.id,
        customer: {
          id: customerPlain.id,
          owner_id: customerPlain.owner_id,
          name: customerPlain.name,
          stage: customerPlain.stage,
        },
        promptVariant: variant,
      });
      messageText = line;
    } else {
      messageText = String(cfg.fixed_text || '').trim();
    }
    if (!messageText) {
      throw new Error('流程动作 send_message：发送内容为空');
    }

    const rate = tryConsumeAutoSendSlot(tenant.id);
    if (!rate.ok) {
      await writeAutoMsgLog({ content: messageText.slice(0, 500), skipped_reason: 'rate_limit' });
      return { skipped: true, reason: 'rate_limit' };
    }

    const result = await sendExternalTextMessage(tenant, {
      externalUserid: customerPlain.external_userid,
      text: messageText,
      senderUserid: sender,
    });

    if (result.errcode !== 0) {
      await writeAutoMsgLog({
        content: messageText,
        wework_errcode: result.errcode,
        wework_errmsg: result.errmsg,
        via: result.via ?? null,
        skipped_reason: 'wework_error',
      });
      throw new Error(result.errmsg || `企微接口错误 errcode=${result.errcode}`);
    }

    await writeAutoMsgLog({
      content: messageText,
      wework_errcode: 0,
      wework_errmsg: 'ok',
      via: result.via ?? null,
    });
    return { sent: true, via: result.via };
  }

  if (cfg.type === 'ai_notify') {
    const promptKey = String(cfg.prompt || 'gentle_followup');
    const variantMap = {
      welcome: 'welcome',
      gentle_followup: 'gentle_followup',
      close_nudge: 'close_nudge',
      intent_high: 'intent_linked_high',
      intent_mid: 'intent_linked_mid',
      intent_low: 'intent_linked_low',
    };
    const variant = variantMap[promptKey] || 'gentle_followup';
    const { line } = await generateAutomationFollowupLine({
      tenantId: tenant.id,
      customer: {
        id: customerPlain.id,
        owner_id: customerPlain.owner_id,
        name: customerPlain.name,
        stage: customerPlain.stage,
      },
      promptVariant: variant,
    });
    const ownerN = customerPlain.owner;
    const touser = ownerN?.wework_userid;
    const name = customerPlain.name || customerPlain.nickname || '客户';
    const text = `【流程自动化】\n客户「${name}」\n建议话术：${line}`;
    if (touser) {
      await sendAgentTextMessage(tenant, { touser, content: text });
    }
    return { line, notified: Boolean(touser) };
  }

  if (cfg.type === 'mark_deal') {
    const customerRow = await Customer.findOne({
      where: { id: Number(customerPlain.id), tenant_id: Number(tenant.id) },
      attributes: ['id', 'stage', 'owner_id'],
    });
    if (!customerRow) {
      throw new Error('客户不存在，无法自动成交');
    }

    const beforeStage = normalizeStage(customerRow.stage || 'new');
    const targetStage = 'deal';
    assertNoStageRollback(beforeStage, targetStage);

    if (beforeStage !== targetStage) {
      await customerRow.update({ stage: targetStage });
      await writeAuditLog(
        { tenantId: tenant.id, userId: null },
        {
          action: 'customer_stage_auto_change',
          targetType: 'customer',
          targetId: customerRow.id,
          detail: {
            source: 'flow',
            flow_run_id: flowRunId,
            node_key: nodeKey,
            from_stage: beforeStage,
            to_stage: targetStage,
            reason: 'mark_deal',
          },
        },
      );
      syncInboxThreadsFromCustomerStage(tenant.id, customerRow.id, targetStage).catch((err) =>
        console.error('[stage-sync] inbox from flow mark_deal', err),
      );
      dispatchStageChangedFlows(tenant.id, customerRow.id, beforeStage, targetStage).catch((err) =>
        console.error('[flow-engine] stage_changed mark_deal', err),
      );
      return { updated: true, from_stage: beforeStage, to_stage: targetStage };
    }
    return { updated: false, from_stage: beforeStage, to_stage: targetStage };
  }

  if (cfg.type === 'change_stage') {
    const toStage = String(cfg.stage || '').trim();
    const validStages = ['new', 'intent_confirm', 'proposal', 'negotiation', 'deal', 'lost'];
    if (!toStage || !validStages.includes(toStage)) {
      return { skipped: true, reason: 'invalid_stage' };
    }
    const customerRow = await Customer.findOne({
      where: { id: Number(customerPlain.id), tenant_id: Number(tenant.id) },
      attributes: ['id', 'stage'],
    });
    if (!customerRow) throw new Error('客户不存在，无法更改阶段');
    const fromStage = normalizeStage(customerRow.stage || 'new');
    assertNoStageRollback(fromStage, toStage);
    if (fromStage !== toStage) {
      await customerRow.update({ stage: toStage });
      await writeAuditLog(
        { tenantId: tenant.id, userId: null },
        {
          action: 'customer_stage_auto_change',
          targetType: 'customer',
          targetId: customerRow.id,
          detail: { source: 'flow', flow_run_id: flowRunId, node_key: nodeKey, from_stage: fromStage, to_stage: toStage },
        },
      );
      syncInboxThreadsFromCustomerStage(tenant.id, customerRow.id, toStage).catch((err) =>
        console.error('[stage-sync] inbox from flow change_stage', err),
      );
      dispatchStageChangedFlows(tenant.id, customerRow.id, fromStage, toStage).catch((err) =>
        console.error('[flow-engine] stage_changed change_stage', err),
      );
      return { updated: true, from_stage: fromStage, to_stage: toStage };
    }
    return { updated: false, from_stage: fromStage, to_stage: toStage };
  }

  if (cfg.type === 'add_tag') {
    const tagIds = Array.isArray(cfg.tag_ids) ? cfg.tag_ids.map(Number).filter(Boolean) : [];
    if (!tagIds.length) return { skipped: true, reason: 'no_tag_ids' };
    const validTags = await Tag.findAll({ where: { id: tagIds, tenant_id: tenant.id } });
    const validIds = validTags.map((t) => t.id);
    await Promise.all(
      validIds.map((tid) =>
        CustomerTag.findOrCreate({ where: { customer_id: customerPlain.id, tag_id: tid } }),
      ),
    );
    return { tagged: validIds };
  }

  if (cfg.type === 'add_followup') {
    const content = String(cfg.content || '').trim();
    if (!content) return { skipped: true, reason: 'no_content' };
    const followType = ['call', 'wechat', 'meeting', 'other'].includes(String(cfg.follow_type))
      ? String(cfg.follow_type)
      : 'other';
    await CustomerFollowUp.create({
      customer_id: customerPlain.id,
      user_id: customerPlain.owner_id,
      type: followType,
      content,
    });
    return { created: true, follow_type: followType };
  }

  return { skipped: true };
}

/**
 * @param {import('../models/flowRun.model.js').FlowRun} run
 * @param {import('../models/flowNode.model.js').FlowNode[]} nodeRows
 * @param {Array<{ source_key: string; target_key: string; branch?: string | null }>} edgePlain
 * @param {import('../models/tenant.model.js').Tenant} tenant
 * @param {import('../models/customer.model.js').Customer} customerRow
 */
async function executeUntilWaitOrDone(run, nodeRows, edgePlain, tenant, customerRow) {
  const nodeMap = new Map(nodeRows.map((n) => [n.node_key, n.get({ plain: true })]));
  let key = run.current_node_key;
  let guard = 0;

  while (key && guard++ < 48) {
    const runLive = await FlowRun.findByPk(run.id);
    if (!runLive || runLive.status !== 'running') return;

    const node = nodeMap.get(key);
    if (!node) {
      await runLive.update({ status: 'failed', error_message: `未知节点: ${key}` });
      return;
    }

    switch (node.type) {
      case 'trigger': {
        const nx = pickNextEdge(edgePlain, key, null);
        key = nx;
        if (!key) {
          await runLive.update({ status: 'completed', current_node_key: null });
          return;
        }
        await runLive.update({ current_node_key: key });
        break;
      }
      case 'delay': {
        const minutes = Number(node.config?.minutes) || 0;
        const nextAfter = pickNextEdge(edgePlain, key, null);
        if (!nextAfter) {
          await runLive.update({ status: 'failed', error_message: '延迟节点缺少出线' });
          return;
        }
        await runLive.update({
          status: 'waiting',
          next_run_at: new Date(Date.now() + minutes * 60000),
          current_node_key: key,
          context_json: { resumeKey: nextAfter },
        });
        return;
      }
      case 'condition': {
        const ok = await evaluateConditionNode(node, tenant.id, customerRow.id);
        const br = ok ? 'yes' : 'no';
        let nx = pickNextEdge(edgePlain, key, br);
        if (!nx) nx = pickNextEdge(edgePlain, key, null);
        if (!nx) {
          await runLive.update({ status: 'failed', error_message: '条件节点缺少出线' });
          return;
        }
        key = nx;
        await runLive.update({ current_node_key: key });
        break;
      }
      case 'action': {
        const plain = customerRow.get({ plain: true });
        await runActionNode(node, tenant, plain, runLive);
        const nx = pickNextEdge(edgePlain, key, null);
        key = nx;
        if (!key) {
          await runLive.update({ status: 'completed', current_node_key: null });
          return;
        }
        await runLive.update({ current_node_key: key });
        break;
      }
      default:
        await runLive.update({ status: 'failed', error_message: `未支持的节点类型: ${node.type}` });
        return;
    }
  }

  const last = await FlowRun.findByPk(run.id);
  if (last?.status === 'running') {
    await last.update({ status: 'failed', error_message: '超过最大步数或存在环路' });
  }
}

/**
 * @param {{ tenantId: number; flowId: number; customerId: number }} args
 */
export async function startFlowRun(args) {
  const { tenantId, flowId, customerId } = args;
  const flow = await Flow.findOne({ where: { id: flowId, tenant_id: tenantId } });
  if (!flow) {
    throw new HttpError(404, '流程不存在', 404);
  }

  const customer = await Customer.findOne({
    where: { id: customerId, tenant_id: tenantId },
    include: [{ model: User, as: 'owner', attributes: ['id', 'wework_userid', 'real_name'] }],
  });
  if (!customer) {
    throw new HttpError(404, '客户不存在', 404);
  }

  const nodeRows = await FlowNode.findAll({ where: { flow_id: flowId } });
  const edgeRows = await FlowEdge.findAll({ where: { flow_id: flowId } });
  const edgePlain = edgeRows.map((e) => e.get({ plain: true }));

  const trigger = nodeRows.find((n) => n.type === 'trigger');
  if (!trigger) {
    throw new HttpError(400, '流程缺少触发器节点', 400);
  }

  const cfg = trigger.get('config') || {};
  if (cfg.type === FLOW_TRIGGER_TYPES.NEW_CUSTOMER) {
    /* 手动测试与其他触发均可 */
  }

  const firstKey = pickNextEdge(edgePlain, trigger.node_key, null);
  if (!firstKey) {
    throw new HttpError(400, '请从触发器连接下游节点', 400);
  }

  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) {
    throw new HttpError(404, '租户不存在', 404);
  }

  const run = await FlowRun.create({
    tenant_id: tenantId,
    flow_id: flowId,
    customer_id: customerId,
    status: 'running',
    current_node_key: firstKey,
    context_json: {},
  });

  await executeUntilWaitOrDone(run, nodeRows, edgePlain, tenant, customer);

  const done = await FlowRun.findByPk(run.id);
  return done?.get({ plain: true });
}

/**
 * @param {number} runId
 */
export async function resumeWaitingRun(runId) {
  const run = await FlowRun.findByPk(runId);
  if (!run || run.status !== 'waiting') return null;
  const resumeKey = run.context_json?.resumeKey;
  if (!resumeKey || typeof resumeKey !== 'string') {
    await run.update({ status: 'failed', error_message: '延迟恢复缺少 resumeKey' });
    return null;
  }

  const tenant = await Tenant.findByPk(run.tenant_id);
  const customer = await Customer.findOne({
    where: { id: run.customer_id, tenant_id: run.tenant_id },
    include: [{ model: User, as: 'owner', attributes: ['id', 'wework_userid', 'real_name'] }],
  });
  if (!tenant || !customer) {
    await run.update({ status: 'failed', error_message: '租户或客户不存在' });
    return null;
  }

  const nodeRows = await FlowNode.findAll({ where: { flow_id: run.flow_id } });
  const edgeRows = await FlowEdge.findAll({ where: { flow_id: run.flow_id } });
  const edgePlain = edgeRows.map((e) => e.get({ plain: true }));

  await run.update({
    status: 'running',
    current_node_key: resumeKey,
    next_run_at: null,
    context_json: {},
  });

  await executeUntilWaitOrDone(run, nodeRows, edgePlain, tenant, customer);
  return FlowRun.findByPk(run.id);
}

export async function processWaitingFlowRuns() {
  const due = await FlowRun.findAll({
    where: {
      status: 'waiting',
      next_run_at: { [Op.lte]: new Date() },
    },
    limit: 80,
    order: [['next_run_at', 'ASC']],
  });

  for (const r of due) {
    try {
      await resumeWaitingRun(r.id);
    } catch (e) {
      console.error('[flow-engine] resume run', r.id, e);
    }
  }
}

/**
 * 新客户入库后尝试匹配触发器且状态 active 的流程。
 * @param {number} tenantId
 * @param {number} customerId
 */
export async function dispatchNewCustomerFlows(tenantId, customerId) {
  const flows = await Flow.findAll({
    where: { tenant_id: tenantId, status: 'active' },
    attributes: ['id'],
  });
  for (const f of flows) {
    const trigger = await FlowNode.findOne({
      where: { flow_id: f.id, type: 'trigger' },
    });
    const cfg = trigger?.get('config') || {};
    if (cfg.type !== FLOW_TRIGGER_TYPES.NEW_CUSTOMER) continue;
    try {
      await startFlowRun({ tenantId, flowId: f.id, customerId });
    } catch (e) {
      console.error('[flow-engine] new_customer flow', f.id, e);
    }
  }
}

/**
 * CRM 阶段变更后匹配 stage_changed 触发器（可选 cfg.to_stage 过滤）。
 * @param {number} tenantId
 * @param {number} customerId
 * @param {string} fromStage
 * @param {string} toStage
 */
export async function dispatchStageChangedFlows(tenantId, customerId, fromStage, toStage) {
  const from = String(fromStage || '').trim();
  const to = String(toStage || '').trim();
  if (!to || from === to) return;

  const flows = await Flow.findAll({
    where: { tenant_id: tenantId, status: 'active' },
    attributes: ['id'],
  });
  for (const f of flows) {
    const trigger = await FlowNode.findOne({
      where: { flow_id: f.id, type: 'trigger' },
    });
    const cfg = trigger?.get('config') || {};
    if (cfg.type !== FLOW_TRIGGER_TYPES.STAGE_CHANGED) continue;
    const targetStage = cfg.to_stage != null ? String(cfg.to_stage).trim() : '';
    if (targetStage && targetStage !== to) continue;
    try {
      await startFlowRun({ tenantId, flowId: f.id, customerId });
    } catch (e) {
      console.error('[flow-engine] stage_changed flow', f.id, e);
    }
  }
}
