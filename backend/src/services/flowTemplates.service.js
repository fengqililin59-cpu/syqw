/**
 * @file 流程预置模板：一键创建常用 SOP（欢迎、培育等）。
 */
import { Flow, Tag } from '../models/index.js';
import { saveFlow, getFlowById } from './flowDefinition.service.js';
import { HttpError } from '../utils/httpError.js';
import { isAdmin } from '../utils/permissions.js';
import { FLOW_TRIGGER_TYPES } from '../constants/flowTriggers.js';
import * as automationService from './automation.service.js';

export const WELCOME_FLOW_NAME = '加好友欢迎（预置）';

/**
 * 一键初始化私域增长起步包：欢迎流程 + 自动跟进默认规则。
 */
export async function bootstrapStarterPack(auth) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '仅管理员可初始化', 403);
  }
  const welcome = await bootstrapWelcomeFlow(auth);
  const automation = await automationService.bootstrapDefaultRules(auth);
  return {
    welcome,
    automation,
    message:
      '起步包已就绪：加好友欢迎流程 + 自动跟进规则。请确认 ENABLE_FLOW_ENGINE_CRON=1、ENABLE_AUTOMATION_CRON=1',
  };
}

async function ensureNewLeadTag(tenantId) {
  let tag = await Tag.findOne({ where: { tenant_id: tenantId, name: '新线索' } });
  if (!tag) {
    tag = await Tag.create({
      tenant_id: tenantId,
      name: '新线索',
      color: '#3b82f6',
    });
  }
  return tag.id;
}

function buildWelcomeFlowBody(tagId) {
  return {
    name: WELCOME_FLOW_NAME,
    status: 'active',
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 280, y: 40 },
        data: { config: { type: FLOW_TRIGGER_TYPES.NEW_CUSTOMER } },
      },
      {
        id: 'delay_1',
        type: 'delay',
        position: { x: 280, y: 160 },
        data: { config: { minutes: 5 } },
      },
      {
        id: 'action_welcome',
        type: 'action',
        position: { x: 280, y: 280 },
        data: { config: { type: 'ai_notify', prompt: 'welcome' } },
      },
      {
        id: 'action_tag',
        type: 'action',
        position: { x: 280, y: 400 },
        data: { config: { type: 'add_tag', tag_ids: [tagId] } },
      },
      {
        id: 'action_followup',
        type: 'action',
        position: { x: 280, y: 520 },
        data: {
          config: {
            type: 'add_followup',
            follow_type: 'wechat',
            content: '[欢迎流程] 新客户已通过活码加好友并入库，请尽快发送欢迎语并填写需求探索登记。',
          },
        },
      },
    ],
    edges: [
      { source: 'trigger_1', target: 'delay_1' },
      { source: 'delay_1', target: 'action_welcome' },
      { source: 'action_welcome', target: 'action_tag' },
      { source: 'action_tag', target: 'action_followup' },
    ],
  };
}

/**
 * 创建「新客户入库 → 延迟 5 分钟 → AI 欢迎话术提醒 → 打标签新线索 → 写跟进」流程。
 * @param {{ tenantId: number; userId: number }} auth
 */
export async function bootstrapWelcomeFlow(auth) {
  if (!isAdmin(auth)) {
    throw new HttpError(403, '仅管理员可初始化流程模板', 403);
  }

  const existing = await Flow.findOne({
    where: { tenant_id: auth.tenantId, name: WELCOME_FLOW_NAME },
    attributes: ['id', 'status'],
  });
  if (existing) {
    const flow = await getFlowById(auth, existing.id);
    return {
      created: false,
      flow_id: existing.id,
      message: '欢迎流程已存在，可在下方编辑或试运行',
      flow,
      hint: '需 ENABLE_FLOW_ENGINE_CRON=1 才能使 5 分钟延迟节点生效',
    };
  }

  const tagId = await ensureNewLeadTag(auth.tenantId);
  const flow = await saveFlow(auth, null, buildWelcomeFlowBody(tagId));

  return {
    created: true,
    flow_id: flow.id,
    message: '已创建并启用欢迎流程：延迟 5 分钟后提醒销售发送 AI 欢迎话术，并打「新线索」标签',
    flow,
    hint: '配合企微加好友自动入库；延迟节点需 ENABLE_FLOW_ENGINE_CRON=1',
  };
}
