/**
 * @file 收件箱消息风险分级：规则兜底 + 可选 LLM 结构化评估。
 */
import { env } from '../config/env.js';
import * as billingService from './billing.service.js';

const RISK_ORDER = { p0: 0, p1: 1, p2: 2 };

function classifyRiskRule(text) {
  const t = String(text || '').toLowerCase();
  if (/退款|投诉|举报|律师|工商|诈骗|违法|人工|真人/.test(t)) {
    return { risk: 'p2', intent: 'complaint', must_human: true, reasons: ['rule:complaint_keywords'] };
  }
  if (/价格|多少钱|优惠|折扣|合同|报价|底价|返点/.test(t)) {
    return { risk: 'p1', intent: 'pricing', must_human: false, reasons: ['rule:pricing_keywords'] };
  }
  if (/资料|介绍|怎么用|是什么|有没有|地址|电话/.test(t)) {
    return { risk: 'p0', intent: 'faq', must_human: false, reasons: ['rule:faq_keywords'] };
  }
  return { risk: 'p1', intent: 'general', must_human: false, reasons: ['rule:general'] };
}

function ruleConfidence(assessment) {
  if (assessment.risk === 'p2') return 0.92;
  if (assessment.risk === 'p0' && assessment.intent === 'faq') return 0.78;
  if (assessment.risk === 'p1' && assessment.intent === 'pricing') return 0.72;
  return 0.65;
}

function hasAiKey() {
  return Boolean(env.ai?.deepseekApiKey || env.ai?.openaiApiKey);
}

function getAiConfig() {
  const key = env.ai.deepseekApiKey || env.ai.openaiApiKey;
  const useDeepseek = Boolean(env.ai.deepseekApiKey);
  const baseUrl = useDeepseek
    ? `${env.ai.deepseekBaseUrl}/v1/chat/completions`
    : 'https://api.openai.com/v1/chat/completions';
  const model = useDeepseek ? 'deepseek-chat' : 'gpt-4o-mini';
  return { key, baseUrl, model };
}

/**
 * @param {string} raw
 */
function parseLlmRiskJson(raw) {
  const s = String(raw || '').trim();
  const match = s.match(/\{[\s\S]*\}/);
  const json = match ? match[0] : s;
  const o = JSON.parse(json);
  const risk = ['p0', 'p1', 'p2'].includes(o.risk_level) ? o.risk_level : 'p1';
  const intent = ['faq', 'pricing', 'complaint', 'general'].includes(o.intent) ? o.intent : 'general';
  let confidence = Number(o.confidence);
  if (!Number.isFinite(confidence)) confidence = 0.7;
  confidence = Math.max(0, Math.min(1, confidence));
  const must_human = Boolean(o.must_human) || risk === 'p2';
  const reasons = Array.isArray(o.reasons) ? o.reasons.map((x) => String(x).slice(0, 80)).slice(0, 5) : [];
  return { risk, intent, confidence, must_human, reasons: [...reasons, 'llm:structured'] };
}

/**
 * @param {string} text
 * @param {number} tenantId
 */
async function classifyRiskLlm(text, tenantId) {
  const { key, baseUrl, model } = getAiConfig();
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 280,
      messages: [
        {
          role: 'system',
          content:
            '你是 B2B 销售质检员。仅输出一行 JSON，无其它文字。字段：risk_level(p0|p1|p2)、intent(faq|pricing|complaint|general)、confidence(0-1)、must_human(boolean)、reasons(string[])。p2=投诉退款法律；p1=议价合同；p0=资料介绍。涉及合同底价返点发票必须 must_human=true。',
        },
        {
          role: 'user',
          content: `客户消息：\n${String(text).slice(0, 1500)}`,
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || res.statusText);
  }
  const rawText = data?.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new Error('empty llm response');
  if (tenantId) {
    billingService.incrementUsage(tenantId, 'ai_calls').catch(() => {});
  }
  return parseLlmRiskJson(rawText);
}

function mergeAssessments(rule, llm) {
  const risk =
    (RISK_ORDER[llm.risk] ?? 0) >= (RISK_ORDER[rule.risk] ?? 0) ? llm.risk : rule.risk;
  const must_human = rule.must_human || llm.must_human || risk === 'p2';
  const intent = risk === rule.risk ? rule.intent : llm.intent;
  const confidence = must_human
    ? Math.min(ruleConfidence({ ...rule, risk }), llm.confidence, 0.5)
    : Math.max(ruleConfidence({ ...rule, risk, intent }), llm.confidence * 0.95);
  return {
    risk: must_human && risk !== 'p2' ? 'p2' : risk,
    intent: must_human ? 'complaint' : intent,
    confidence: Number(confidence.toFixed(4)),
    must_human,
    source: 'llm+rule',
    reasons: [...new Set([...(rule.reasons || []), ...(llm.reasons || [])])],
  };
}

/**
 * @param {string} text
 * @param {number} [tenantId]
 */
export async function assessInboxReplyRisk(text, tenantId = null) {
  const ruleBase = classifyRiskRule(text);
  const rule = {
    ...ruleBase,
    confidence: ruleConfidence(ruleBase),
    source: 'rule',
  };

  if (!env.inboxAiRiskLlm || !hasAiKey()) {
    return rule;
  }

  try {
    const llm = await classifyRiskLlm(text, tenantId);
    return mergeAssessments(ruleBase, llm);
  } catch (e) {
    console.warn('[inbox-ai-risk] llm fallback to rule', e?.message || e);
    return rule;
  }
}

export { classifyRiskRule };
