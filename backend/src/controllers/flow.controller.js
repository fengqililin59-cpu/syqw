/**
 * @file 自动化流程：定义 CRUD + 手动试运行。
 */
import Joi from 'joi';
import * as flowDefinition from '../services/flowDefinition.service.js';
import * as flowEngine from '../services/flowEngine.service.js';
import * as flowTemplates from '../services/flowTemplates.service.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';
import { FLOW_TRIGGER_OPTIONS } from '../constants/flowTriggers.js';

const startRunSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
}).unknown(false);

export async function list(req, res) {
  const data = await flowDefinition.listFlows(req.auth);
  return ok(res, data, 'ok');
}

export async function meta(_req, res) {
  const actionTypes = [
    { value: 'ai_notify', label: 'AI 话术提醒销售', fields: ['prompt'] },
    { value: 'send_message', label: '直发企微消息给客户', fields: ['mode', 'prompt', 'fixed_text'] },
    { value: 'mark_deal', label: '标记为成交', fields: [] },
    { value: 'change_stage', label: '更改跟进阶段', fields: ['stage'] },
    { value: 'add_tag', label: '打标签', fields: ['tag_ids'] },
    { value: 'add_followup', label: '自动写跟进记录', fields: ['content', 'follow_type'] },
  ];
  const conditionTypes = [
    { value: 'intention_score', label: '意向分', operators: ['>=', '>', '<=', '<', '=='] },
    { value: 'no_reply_hours', label: '销售未回复超过N小时', operators: [] },
  ];
  return ok(res, { trigger_types: FLOW_TRIGGER_OPTIONS, action_types: actionTypes, condition_types: conditionTypes }, 'ok');
}

export async function getOne(req, res) {
  const data = await flowDefinition.getFlowById(req.auth, Number(req.params.id));
  return ok(res, data, 'ok');
}

export async function create(req, res) {
  const data = await flowDefinition.saveFlow(req.auth, null, req.body);
  return ok(res, data, '已保存');
}

export async function bootstrapWelcome(req, res) {
  const data = await flowTemplates.bootstrapWelcomeFlow(req.auth);
  return ok(res, data, data.message || 'ok');
}

export async function bootstrapStarterPack(req, res) {
  const data = await flowTemplates.bootstrapStarterPack(req.auth);
  return ok(res, data, data.message || 'ok');
}

export async function update(req, res) {
  const data = await flowDefinition.saveFlow(req.auth, Number(req.params.id), req.body);
  return ok(res, data, '已保存');
}

export async function remove(req, res) {
  const data = await flowDefinition.deleteFlow(req.auth, Number(req.params.id));
  return ok(res, data, '已删除');
}

export async function startRun(req, res) {
  const { error, value } = startRunSchema.validate(req.body || {}, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await flowEngine.startFlowRun({
    tenantId: req.auth.tenantId,
    flowId: Number(req.params.id),
    customerId: value.customer_id,
  });
  return ok(res, data, 'ok');
}
