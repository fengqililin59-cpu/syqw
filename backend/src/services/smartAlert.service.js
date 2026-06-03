/**
 * @file AI 智能跟进提醒：扫描需要跟进的客户并生成 AI 行动建议。
 */
import { Op, fn, col, literal } from 'sequelize';
import { Customer, CustomerFollowUp, Tag } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import * as billingService from './billing.service.js';

function bumpAiUsage(tenantId) {
  if (!tenantId) return;
  billingService.incrementUsage(tenantId, 'ai_calls').catch((e) => console.error('[billing] increment ai_calls', e));
}

/** 调用 DeepSeek/OpenAI chat completions */
async function invokeChatCompletions(messages, opts = {}) {
  const key = env.ai.deepseekApiKey || env.ai.openaiApiKey;
  if (!key) throw new HttpError(503, '未配置 AI API Key', 503);

  const useDeepseek = Boolean(env.ai.deepseekApiKey);
  const baseUrl = useDeepseek
    ? `${env.ai.deepseekBaseUrl}/v1/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';
  const model = useDeepseek ? 'deepseek-chat' : 'gpt-4o-mini';

  const body = { model, messages, temperature: opts.temperature ?? 0.5, max_tokens: opts.max_tokens ?? 240 };
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, `AI 接口失败：${data?.error?.message || res.statusText}`, 502);
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * 检测三类告警：
 * 1. 高意向沉默：intent_score >= 50 且 last_followup_at 超过 3 天
 * 2. 管道滞留：非 won/lost 阶段且 last_contact_at 超过 7 天
 * 3. 紧急待跟进：intent_tier = 'high' 且 last_contact_at 超过 1 天
 * 每类最多取 3 条，合并后最多 6 条。
 */
export async function getSmartAlerts(auth) {
  const { tenantId } = auth;
  const now = new Date();

  // 高意向沉默（3 天以上未跟进）
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
  const highIntentSilent = await Customer.findAll({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      intent_score: { [Op.gte]: 50 },
      stage: { [Op.notIn]: ['won', 'lost', 'deal'] },
      [Op.or]: [
        { last_followup_at: { [Op.lt]: threeDaysAgo } },
        { last_followup_at: null },
      ],
    },
    order: [['intent_score', 'DESC']],
    limit: 3,
    attributes: ['id', 'name', 'company', 'stage', 'intent_score', 'last_followup_at', 'last_contact_at', 'phone'],
  });

  // 管道滞留（7 天以上无变动）
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const stuckInPipeline = await Customer.findAll({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      stage: { [Op.notIn]: ['won', 'lost', 'deal'] },
      [Op.or]: [
        { last_contact_at: { [Op.lt]: sevenDaysAgo } },
        { last_contact_at: null,
          updated_at: { [Op.lt]: sevenDaysAgo },
        },
      ],
    },
    order: [['updated_at', 'ASC']],
    limit: 3,
    attributes: ['id', 'name', 'company', 'stage', 'intent_score', 'last_followup_at', 'last_contact_at', 'phone'],
  });

  // 紧急高意向（1 天以上未联系）
  const oneDayAgo = new Date(now.getTime() - 1 * 86400000);
  const urgentHighIntent = await Customer.findAll({
    where: {
      tenant_id: tenantId,
      deleted_at: null,
      intent_tier: 'high',
      stage: { [Op.notIn]: ['won', 'lost', 'deal'] },
      [Op.or]: [
        { last_contact_at: { [Op.lt]: oneDayAgo } },
        { last_contact_at: null },
      ],
    },
    order: [['intent_score', 'DESC']],
    limit: 3,
    attributes: ['id', 'name', 'company', 'stage', 'intent_score', 'last_followup_at', 'last_contact_at', 'phone'],
  });

  const [silent, stuck, urgent] = await Promise.all([highIntentSilent, stuckInPipeline, urgentHighIntent]);

  // 合并去重，优先紧急 > 沉默 > 滞留，最多 6 条
  const seen = new Set();
  const merged = [];

  for (const c of urgent) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push({ ...c.toJSON(), alert_reason: 'urgent' });
  }
  for (const c of silent) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push({ ...c.toJSON(), alert_reason: 'silent' });
  }
  for (const c of stuck) {
    if (seen.has(c.id) || merged.length >= 6) continue;
    seen.add(c.id);
    merged.push({ ...c.toJSON(), alert_reason: 'stuck' });
  }

  const items = merged.slice(0, 6);

  // 没有告警时直接返回
  if (items.length === 0) {
    return { items: [], ai_advice: '' };
  }

  // 用 AI 生成整体简要建议
  const reasonLabel = { urgent: '高意向超1天未联系', silent: '意向分较高但超3天未跟进', stuck: '在管道阶段停留超7天' };
  const customerLines = items
    .map((c, i) => `${i + 1}. ${c.name || '未知'}（${c.company || '-'}），当前阶段：${c.stage}，意向分：${c.intent_score}，原因：${reasonLabel[c.alert_reason]}，电话：${c.phone || '无'}`)
    .join('\n');

  const prompt = `你是销售教练。以下客户需要跟进提醒，请给出一条 30 字以内的一针见血的总建议，告诉销售今天最该做什么。像老销售的口吻。\n\n${customerLines}\n\n只输出一句话。`;

  let aiAdvice = '';
  try {
    const raw = await invokeChatCompletions(
      [
        { role: 'system', content: '你是销售教练。输出一句精准的跟进建议，30字以内，老销售口吻。' },
        { role: 'user', content: prompt },
      ],
      { max_tokens: 120, temperature: 0.5 },
    );
    aiAdvice = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  } catch {
    aiAdvice = items.length >= 3 ? '多个客户需跟进，建议先处理高意向客户，逐个电话确认近况' : '有客户需要关注，建议尽快跟进';
  }

  bumpAiUsage(tenantId);

  return {
    total: items.length,
    items: items.map((c) => ({
      id: c.id,
      name: c.name || '未命名',
      company: c.company || '',
      stage: c.stage,
      intent_score: c.intent_score,
      phone: c.phone || '',
      alert_reason: c.alert_reason,
      last_followup_at: c.last_followup_at,
      last_contact_at: c.last_contact_at,
    })),
    ai_advice: aiAdvice,
  };
}
