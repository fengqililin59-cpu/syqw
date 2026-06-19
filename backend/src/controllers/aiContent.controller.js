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
const DEMO_AI_REPLIES = [
  '好的！针对这位客户，建议这样跟进：\n\n"您好，我是 [姓名]，上次聊到您对我们产品有兴趣。这几天正好有个限时优惠，我想第一时间通知您。方便今天抽 10 分钟聊聊吗？"\n\n**要点：**\n- 直接说明目的，不绕弯子\n- 用"限时优惠"制造紧迫感\n- 提出具体时间，降低决策门槛\n\n需要我根据具体情况调整话术吗？',
  '明白您的需求！这是一条高转化朋友圈文案：\n\n"用了 3 个月企微 CRM，我们团队成交率提升了 40%。\n\n不是因为销售变厉害了，是因为系统在帮我们——\n✅ 自动识别哪个客户今天最有意向\n✅ AI 一键生成跟进话术\n✅ 老板实时看到每个客户在哪个阶段\n\n感兴趣的老板可以私我，免费体验。"\n\n**注意：** 配上系统截图效果更好，评论区引导留联系方式。',
  '客户说"再考虑考虑"时，最忌讳的是追问"您在考虑什么"或沉默等待。\n\n**推荐话术：**\n"完全理解，这种决定确实需要想清楚。我想直接问您：目前最担心的是哪一点？是价格、还是不确定效果、还是有其他选择在对比？"\n\n**逻辑：** 把"再考虑"转化成"具体顾虑"，才能针对性解决。一旦说出顾虑，就有跟进的抓手了。\n\n要我帮您准备针对不同顾虑的应对话术吗？',
];

export async function assistantChat(req, res) {
  const { error, value } = assistantChatSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    throw new HttpError(400, '参数校验失败', 400, error.details);
  }
  // 演示/访客模式：直接返回预置回复，不消耗真实 AI 配额
  if (req.auth?.isGuest || req.auth?.isDemo) {
    const idx = Math.floor(Math.random() * DEMO_AI_REPLIES.length);
    return ok(res, { reply: DEMO_AI_REPLIES[idx], scene: value.scene ?? 'general', demo: true }, 'ok');
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
