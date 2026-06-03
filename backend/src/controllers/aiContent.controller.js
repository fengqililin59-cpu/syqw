/**
 * @file AI 文案生成（需登录，防止滥用）。
 */
import Joi from 'joi';
import * as aiContentService from '../services/aiContent.service.js';
import { HttpError } from '../utils/httpError.js';
import { ok } from '../utils/response.js';

const copySchema = Joi.object({
  prompt: Joi.string().trim().min(1).max(4000).required(),
  style: Joi.string().trim().max(64).allow('', null).optional(),
}).unknown(false);
const posterSchema = Joi.object({
  prompt: Joi.string().trim().min(1).max(4000).required(),
  style: Joi.string().trim().max(64).allow('', null).optional(),
}).unknown(false);

const replySuggestionsSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  message: Joi.string().trim().min(1).max(2000).required(),
  include_playbook_context: Joi.boolean().optional(),
}).unknown(false);

const assistantChatSchema = Joi.object({
  messages: Joi.array()
    .items(
      Joi.object({
        role: Joi.string().valid('user', 'assistant').required(),
        content: Joi.string().trim().min(1).max(8000).required(),
      }),
    )
    .min(1)
    .max(30)
    .required(),
  scene: Joi.string().valid('general', 'sales', 'copy', 'followup', 'objection').optional(),
}).unknown(false);

export async function generateCopy(req, res) {
  const { error, value } = copySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const text = await aiContentService.generateCopywriting(value.prompt, value.style ?? null, req.auth.tenantId);
  return ok(res, { text }, 'ok');
}

/**
 * POST /ai/reply-suggestions
 * 生成 3 条销售回复建议（写入 ai_generation_logs）。
 */
export async function replySuggestions(req, res) {
  const { error, value } = replySuggestionsSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await aiContentService.generateSalesReplySuggestions(req.auth, value);
  return ok(res, data, 'ok');
}

/**
 * POST /ai/chat
 * 多轮上下文 + 阶段判断 + 三条话术（历史来自企微消息表）。
 */
export async function contextChat(req, res) {
  const { error, value } = replySuggestionsSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await aiContentService.generateContextualSalesChat(req.auth, value);
  return ok(res, data, 'ok');
}

/** POST /ai/assistant — 站内 AI 助手多轮对话 */
export async function assistantChat(req, res) {
  const { error, value } = assistantChatSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await aiContentService.generateAssistantChat(req.auth, value);
  return ok(res, data, 'ok');
}

export async function generatePoster(req, res) {
  const { error, value } = posterSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  const data = await aiContentService.generatePosterAsset(value.prompt, value.style ?? null, req.auth.tenantId);
  return ok(res, data);
}

export async function generateSidebarScripts(req, res) {
  const customerId = Number(req.body?.customer_id);
  if (!Number.isInteger(customerId) || customerId < 1) {
    throw new HttpError(400, '缺少 customer_id', 400);
  }
  const data = await aiContentService.generateSidebarScripts(req.auth.tenantId, customerId);
  return ok(res, data);
}
