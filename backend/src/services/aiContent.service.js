/**
 * @file AI 文案生成（DeepSeek / OpenAI 兼容 Chat Completions）。
 */
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { AiGenerationLog, Customer, Tag, WeworkCustomerMessage } from '../models/index.js';
import { getCustomer } from './customer.service.js';
import { buildPlaybookDraftContext } from './intentAlert.service.js';
import * as billingService from './billing.service.js';

function bumpAiUsage(tenantId) {
  if (!tenantId) return;
  billingService.incrementUsage(tenantId, 'ai_calls').catch((e) =>
    console.error('[billing] increment ai_calls', e),
  );
}

/**
 * @param {string} prompt
 * @param {string | null} style 如：种草、专业、简短
 */
export async function generateCopywriting(prompt, style, tenantId = null) {
  const key = env.ai.deepseekApiKey || env.ai.openaiApiKey;
  if (!key) {
    throw new HttpError(
      503,
      '未配置 AI：请在 backend/.env 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY',
      503,
    );
  }

  const useDeepseek = Boolean(env.ai.deepseekApiKey);
  const baseUrl = useDeepseek ? `${env.ai.deepseekBaseUrl}/v1/chat/completions` : 'https://api.openai.com/v1/chat/completions';
  const model = useDeepseek ? 'deepseek-chat' : 'gpt-4o-mini';

  const styleHint = style ? `写作风格：${style}。\n` : '';
  const body = {
    model,
    messages: [
      {
        role: 'system',
        content:
          '你是资深中文营销文案，输出可直接投放使用的正文，不要 Markdown 代码块外的废话。',
      },
      {
        role: 'user',
        content: `${styleHint}需求：\n${prompt}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 2000,
  };

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText;
    throw new HttpError(502, `AI 接口失败：${msg}`, 502);
  }

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new HttpError(502, 'AI 返回为空', 502);
  }
  bumpAiUsage(tenantId);
  return text;
}

/**
 * 解析模型输出为恰好 3 条字符串（JSON 数组或兜底拆分）。
 * @param {string} raw
 * @returns {string[]}
 */
function parseThreeReplies(raw) {
  const s = String(raw || '').trim();
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return normalizeThree(parsed);
    }
  } catch {
    /* fallthrough */
  }
  const bracket = s.match(/\[[\s\S]*\]/);
  if (bracket) {
    try {
      const parsed = JSON.parse(bracket[0]);
      if (Array.isArray(parsed)) {
        return normalizeThree(parsed.map((x) => String(x)));
      }
    } catch {
      /* */
    }
  }
  const lines = s
    .split(/\n/)
    .map((l) => l.replace(/^[\s*"'\[\],]+|[\s*"'\[\],]+$/g, '').replace(/^\d+[\.)、]\s*/, '').trim())
    .filter(Boolean);
  return normalizeThree(lines);
}

/** @param {string[]} arr */
function normalizeThree(arr) {
  const cleaned = arr.map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
  while (cleaned.length < 3) {
    cleaned.push(cleaned[cleaned.length - 1] || '好的，我帮您看下最优方案。');
  }
  return cleaned.slice(0, 3);
}

function getAiConfig() {
  const key = env.ai.deepseekApiKey || env.ai.openaiApiKey;
  if (!key) {
    throw new HttpError(
      503,
      '未配置 AI：请在 backend/.env 设置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY',
      503,
    );
  }
  const useDeepseek = Boolean(env.ai.deepseekApiKey);
  const baseUrl = useDeepseek ? `${env.ai.deepseekBaseUrl}/v1/chat/completions` : 'https://api.openai.com/v1/chat/completions';
  const model = useDeepseek ? 'deepseek-chat' : 'gpt-4o-mini';
  return { key, useDeepseek, baseUrl, model };
}

/**
 * @param {Array<{ role: string; content: string }>} messages
 * @param {{ max_tokens?: number; temperature?: number }} opts
 */
async function invokeChatCompletions(messages, opts = {}) {
  const { key, useDeepseek, baseUrl, model } = getAiConfig();
  const max_tokens = opts.max_tokens ?? 800;
  const temperature = opts.temperature ?? 0.75;

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText;
    throw new HttpError(502, `AI 接口失败：${msg}`, 502);
  }

  const rawText = data?.choices?.[0]?.message?.content?.trim();
  if (!rawText) {
    throw new HttpError(502, 'AI 返回为空', 502);
  }
  return { rawText, model, provider: useDeepseek ? 'deepseek' : 'openai' };
}

/**
 * @param {string} raw
 * @returns {{ stage: string; replies: string[] }}
 */
function parseStageAndReplies(raw) {
  const s = String(raw || '').trim();
  try {
    const o = JSON.parse(s);
    if (o && Array.isArray(o.replies)) {
      return {
        stage: typeof o.stage === 'string' && o.stage ? o.stage : '未知',
        replies: normalizeThree(o.replies.map((x) => String(x))),
      };
    }
  } catch {
    /* fallthrough */
  }
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const o = JSON.parse(objMatch[0]);
      if (o && Array.isArray(o.replies)) {
        return {
          stage: typeof o.stage === 'string' && o.stage ? o.stage : '未知',
          replies: normalizeThree(o.replies.map((x) => String(x))),
        };
      }
    } catch {
      /* */
    }
  }
  return { stage: '未知', replies: parseThreeReplies(s) };
}

/**
 * 企微同步消息 → Chat Completions 多轮（客户=user，员工侧=assistant）。
 * @param {number} tenantId
 * @param {number} customerId
 * @param {number} maxMessages 最多多少条（user/assistant 各算一条）
 */
async function buildWeworkHistoryChatMessages(tenantId, customerId, maxMessages = 20) {
  const rows = await WeworkCustomerMessage.findAll({
    where: {
      tenant_id: tenantId,
      customer_id: customerId,
    },
    order: [['msg_time', 'ASC']],
    /** 多拉一些再截断，过滤空内容 */
    limit: 80,
    attributes: ['direction', 'content'],
  });

  const out = [];
  for (const m of rows) {
    const c = m.content ? String(m.content).trim().slice(0, 800) : '';
    if (!c) continue;
    if (m.direction === 'customer') {
      out.push({ role: 'user', content: c });
    } else {
      out.push({ role: 'assistant', content: c });
    }
  }

  if (out.length <= maxMessages) return out;
  return out.slice(-maxMessages);
}

/**
 * 销售回复建议：3 条不同力度话术（微信私域）。
 * @param {{ userId: number; tenantId: number; roleName?: string | null }} auth
 * @param {{ customer_id: number; message: string }} body
 */
export async function generateSalesReplySuggestions(auth, body) {
  const started = Date.now();
  const customer = await getCustomer(auth, body.customer_id);

  let playbookMeta = null;
  if (body.include_playbook_context !== false) {
    playbookMeta = await buildPlaybookDraftContext(auth, body.customer_id);
  }

  const recent = await WeworkCustomerMessage.findAll({
    where: {
      tenant_id: auth.tenantId,
      customer_id: body.customer_id,
    },
    order: [['msg_time', 'DESC']],
    limit: 10,
    attributes: ['direction', 'content', 'msg_time'],
  });
  const chronological = [...recent].reverse();
  const historyBlock =
    chronological.length > 0
      ? chronological
          .map((m) => {
            const who = m.direction === 'staff' ? '销售' : '客户';
            const t = m.content ? String(m.content).slice(0, 500) : '';
            return `${who}：${t}`;
          })
          .join('\n')
      : '（暂无近期会话记录）';

  const profileHint = [
    customer.name ? `客户称呼/备注：${customer.name}` : null,
    customer.stage ? `当前阶段：${customer.stage}` : null,
    customer.source ? `来源：${customer.source}` : null,
  ]
    .filter(Boolean)
    .join('；');

  const playbookBlock = playbookMeta?.context_block
    ? `\n\n【跟进助手背景】\n${playbookMeta.context_block}`
    : '';

  const userPrompt = `客户与企业相关信息：
${profileHint || '（无额外画像）'}

最近会话摘录：
${historyBlock}

客户刚才说：
"${body.message.trim()}"${playbookBlock}

请生成 3 条不同风格的回复话术，用于微信私域沟通：
要求：
1. 口语化、自然，每条约 20～40 字（可适当增减）。
2. 目标是推进成交或下一步沟通，避免生硬推销与长篇解释。
3. 三条分别侧重：①强引导成交 ②中等引导 ③软性铺垫。
4. 只输出一个 JSON 数组，恰好 3 个字符串元素，不要 Markdown、不要解释。`;

  const { rawText, model, provider } = await invokeChatCompletions(
    [
      {
        role: 'system',
        content:
          '你是一个顶级私域销售顾问，擅长微信简短话术。用户要求你只输出 JSON 数组（3 个字符串），不得输出任何其它文字。',
      },
      { role: 'user', content: userPrompt },
    ],
    { max_tokens: 800, temperature: 0.75 },
  );
  bumpAiUsage(auth.tenantId);

  const replies = parseThreeReplies(rawText);

  try {
    await AiGenerationLog.create({
      tenant_id: auth.tenantId,
      user_id: auth.userId,
      customer_id: body.customer_id,
      kind: 'reply_suggestions',
      input_message: body.message.trim(),
      output_json: replies,
      model,
      meta_json: {
        duration_ms: Date.now() - started,
        provider,
        playbook_used: Boolean(playbookMeta),
        playbook_scripts_count: playbookMeta?.scripts_count ?? 0,
        playbook_has_intent_alert: playbookMeta?.has_intent_alert ?? false,
      },
    });
  } catch (e) {
    console.error('[ai_generation_logs] persist failed', e);
  }

  return {
    replies,
    playbook_used: Boolean(playbookMeta),
    playbook_scripts_count: playbookMeta?.scripts_count ?? 0,
    playbook_has_intent_alert: playbookMeta?.has_intent_alert ?? false,
  };
}

/**
 * 上下文版：多轮 user/assistant + 判断阶段 + 三条话术。
 * 历史来自 wework_customer_messages（企微回调入库）。
 * @param {{ userId: number; tenantId: number; roleName?: string | null }} auth
 * @param {{ customer_id: number; message: string }} body
 */
export async function generateContextualSalesChat(auth, body) {
  const started = Date.now();
  const customer = await getCustomer(auth, body.customer_id);

  let playbookMeta = null;
  if (body.include_playbook_context !== false) {
    playbookMeta = await buildPlaybookDraftContext(auth, body.customer_id);
  }

  const history = await buildWeworkHistoryChatMessages(auth.tenantId, body.customer_id, 20);

  const profileHint = [
    customer.name ? `客户称呼/备注：${customer.name}` : null,
    customer.stage ? `CRM 阶段：${customer.stage}` : null,
    customer.source ? `来源：${customer.source}` : null,
    customer.company ? `公司：${customer.company}` : null,
  ]
    .filter(Boolean)
    .join('；');

  const systemContent = `你是一个顶级微信私域销售专家，目标是促成成交。
下面多轮对话中：role=user 表示客户发言；role=assistant 表示销售侧已通过企微发出的内容（从历史同步）。

请先判断客户当前大致处于哪一阶段（四选一）：初次咨询、比价阶段、犹豫阶段、即将成交。
再针对客户「最新一句话」生成 3 条下一步回复话术。

客户画像（若有）：${profileHint || '（无）'}

规则：
1. 每条约 20～40 字，口语化，引导下一步行动，避免长篇解释。
2. 三条依次为：强成交推进、中等引导、软性沟通。
3. 只输出一个 JSON 对象，键为 stage 与 replies，不要 Markdown、不要其它文字。
格式示例：{"stage":"犹豫阶段","replies":["","",""]}${
    playbookMeta?.context_block
      ? `\n\n【跟进助手背景（请融入话术，勿生硬复述）】\n${playbookMeta.context_block}`
      : ''
  }`;

  const messages = [
    { role: 'system', content: systemContent },
    ...history,
    { role: 'user', content: body.message.trim() },
  ];

  const { rawText, model, provider } = await invokeChatCompletions(messages, {
    max_tokens: 1000,
    temperature: 0.7,
  });
  bumpAiUsage(auth.tenantId);

  const { stage, replies } = parseStageAndReplies(rawText);

  try {
    await AiGenerationLog.create({
      tenant_id: auth.tenantId,
      user_id: auth.userId,
      customer_id: body.customer_id,
      kind: 'chat_context',
      input_message: body.message.trim(),
      output_json: { stage, replies },
      model,
      meta_json: {
        duration_ms: Date.now() - started,
        provider,
        history_turns: history.length,
        playbook_used: Boolean(playbookMeta),
        playbook_scripts_count: playbookMeta?.scripts_count ?? 0,
        playbook_has_intent_alert: playbookMeta?.has_intent_alert ?? false,
      },
    });
  } catch (e) {
    console.error('[ai_generation_logs] persist failed', e);
  }

  return {
    stage,
    replies,
    playbook_used: Boolean(playbookMeta),
    playbook_scripts_count: playbookMeta?.scripts_count ?? 0,
    playbook_has_intent_alert: playbookMeta?.has_intent_alert ?? false,
  };
}

const AUTOMATION_VARIANT_HINT = {
  welcome:
    '场景：客户刚进入私域或刚建档，你需要一条简短、真诚的欢迎/破冰，顺带询问一句需求或方便沟通的时间。不要承诺具体利率与额度。',
  gentle_followup:
    '场景：销售刚发过消息，客户一段时间没有回复。写一条不打扰、轻提醒、带一点价值或关心的话，不要强推、不要质问。',
  close_nudge:
    '场景：客户已较高意向，但暂时沉默。写一条推进下一步的小钩子（如核对资料、预约电话），语气克制。',
  /** 意向联动：高意向，推进成交 */
  intent_linked_high:
    '场景：系统判断该客户当前意向高、且客户侧暂时未回销售上一条消息。请写一条「推进下一步」的话术（如确认资料、核对方案、预约通话），语气克制、不强迫，约30字以内。',
  /** 意向联动：中意向，保温 */
  intent_linked_mid:
    '场景：客户有兴趣但仍在观望。写一条保持温度的跟进：轻价值或共鸣，不催促、不生硬推销，像真人微信聊天。',
  /** 意向联动：低意向，轻触达 */
  intent_linked_low:
    '场景：客户当前意向偏低。写一条「朋友圈式」轻触达：偏案例碎片或小知识点，不做硬销售，避免让对方感到被打扰。',
};

/**
 * 自动跟进 Worker 专用：输出单句话术（20～40 字），人工可复制发给客户。
 * @param {{ tenantId: number; customer: { id: number; owner_id: number; name?: string | null; stage?: string }; promptVariant: keyof typeof AUTOMATION_VARIANT_HINT }} ctx
 * @returns {{ line: string; model?: string; provider?: string }}
 */
export async function generateAutomationFollowupLine(ctx) {
  const started = Date.now();
  const { tenantId, customer, promptVariant } = ctx;
  const variant =
    AUTOMATION_VARIANT_HINT[promptVariant] ?? AUTOMATION_VARIANT_HINT.gentle_followup;

  const history = await buildWeworkHistoryChatMessages(tenantId, customer.id, 14);

  const profileHint = [
    customer.name ? `称呼：${customer.name}` : null,
    customer.stage ? `阶段：${customer.stage}` : null,
  ]
    .filter(Boolean)
    .join('；');

  const system =
    '你是微信私域销售跟进专家。只输出一句可直接复制发送给客户的中文话术，不要引号、不要换行、不要客套旁白。';

  const userMsg = `${variant}

客户概况（若有）：${profileHint || '（无）'}

近期会话（若有，role=user 为客户）：${history.length ? JSON.stringify(history.slice(-8)) : '（暂无归档消息）'}

只输出这一句正文。`;

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: userMsg },
  ];

  const { rawText, model, provider } = await invokeChatCompletions(messages, {
    max_tokens: 120,
    temperature: 0.65,
  });
  bumpAiUsage(tenantId);

  let line = String(rawText || '')
    .trim()
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  if (!line) {
    line = '您好，刚想和您确认下方便沟通的时间，有需要我随时在。';
  }

  try {
    await AiGenerationLog.create({
      tenant_id: tenantId,
      user_id: customer.owner_id,
      customer_id: customer.id,
      kind: 'automation_followup',
      input_message: `[automation:${String(promptVariant)}]`,
      output_json: { line },
      model,
      meta_json: {
        duration_ms: Date.now() - started,
        provider,
        promptVariant,
      },
    });
  } catch (e) {
    console.error('[ai_generation_logs] automation persist failed', e);
  }

  return { line, model, provider };
}

function clampScore0to100(n) {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * @param {string} raw
 * @returns {{ intent_score: number; stage: string; confidence: string; reason: string }}
 */
function parseIntentScoreAiOutput(raw) {
  const s = String(raw || '').trim();
  try {
    const o = JSON.parse(s);
    return {
      intent_score: clampScore0to100(Number(o.intent_score)),
      stage: typeof o.stage === 'string' && o.stage ? o.stage.slice(0, 40) : '了解中',
      confidence:
        typeof o.confidence === 'string' && ['高', '中', '低'].includes(o.confidence)
          ? o.confidence
          : '中',
      reason: typeof o.reason === 'string' ? o.reason.slice(0, 200) : '',
    };
  } catch {
    /* fallthrough */
  }
  const objMatch = s.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const o = JSON.parse(objMatch[0]);
      return {
        intent_score: clampScore0to100(Number(o.intent_score)),
        stage: typeof o.stage === 'string' && o.stage ? o.stage.slice(0, 40) : '了解中',
        confidence:
          typeof o.confidence === 'string' && ['高', '中', '低'].includes(o.confidence)
            ? o.confidence
            : '中',
        reason: typeof o.reason === 'string' ? o.reason.slice(0, 200) : '',
      };
    } catch {
      /* */
    }
  }
  return {
    intent_score: 50,
    stage: '了解中',
    confidence: '低',
    reason: '模型输出无法解析',
  };
}

/**
 * 意向评分：分析会话文本，输出 0-100 分与阶段（供规则分融合）。
 * @param {string} transcript 角色标注后的纯文本
 * @param {{ tenantId: number; customerId: number; ownerUserId: number }} audit
 */
export async function generateIntentScoreFromChat(transcript, audit) {
  const started = Date.now();
  const tc = String(transcript || '').trim().slice(0, 14000);
  if (!tc) {
    return {
      intent_score: 45,
      stage: '初步',
      confidence: '低',
      reason: '暂无会话文本',
      model: null,
      provider: null,
    };
  }

  const messages = [
    {
      role: 'system',
      content:
        '你是销售线索分析专家。根据聊天记录判断客户真实需求强度与成交概率。只输出 JSON，不要 Markdown。',
    },
    {
      role: 'user',
      content: `请根据以下客户与销售的聊天记录，判断客户意向。

输出 JSON 对象，字段：
- intent_score：0-100 的整数
- stage：从「初步、了解中、比价、犹豫、准备成交、已流失」中选其一
- confidence：高 或 中 或 低
- reason：一句话原因，不超过 80 字

聊天记录：
${tc}`,
    },
  ];

  const { rawText, model, provider } = await invokeChatCompletions(messages, {
    max_tokens: 400,
    temperature: 0.35,
  });
  bumpAiUsage(audit.tenantId);

  const parsed = parseIntentScoreAiOutput(rawText);

  try {
    await AiGenerationLog.create({
      tenant_id: audit.tenantId,
      user_id: audit.ownerUserId,
      customer_id: audit.customerId,
      kind: 'intent_score',
      input_message: transcript.slice(0, 2000),
      output_json: parsed,
      model,
      meta_json: {
        duration_ms: Date.now() - started,
        provider,
      },
    });
  } catch (e) {
    console.error('[ai_generation_logs] intent_score persist failed', e);
  }

  return { ...parsed, model, provider };
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapLines(s, width = 18) {
  const text = String(s || '').trim();
  const out = [];
  let i = 0;
  while (i < text.length) {
    out.push(text.slice(i, i + width));
    i += width;
  }
  return out.slice(0, 3);
}

export async function generatePosterAsset(prompt, style, tenantId = null) {
  const userPrompt = `请基于以下产品卖点生成营销素材 JSON，字段：
headline（12字内）、subheading（20字内）、cta（8字内）。
风格：${style || '专业'}
卖点：${String(prompt || '').trim()}
只输出 JSON。`;
  const { rawText } = await invokeChatCompletions(
    [
      { role: 'system', content: '你是营销设计文案助手，只输出 JSON。' },
      { role: 'user', content: userPrompt },
    ],
    { max_tokens: 220, temperature: 0.65 },
  );
  bumpAiUsage(tenantId);

  let headline = '智能获客增长';
  let subheading = '一站式追踪渠道、自动生成营销内容';
  let cta = '立即体验';
  try {
    const obj = JSON.parse(rawText.match(/\{[\s\S]*\}/)?.[0] || '{}');
    if (obj.headline) headline = String(obj.headline).slice(0, 20);
    if (obj.subheading) subheading = String(obj.subheading).slice(0, 40);
    if (obj.cta) cta = String(obj.cta).slice(0, 12);
  } catch {
    /* fallback */
  }

  const lines = wrapLines(subheading, 18);
  const lineSvgs = lines
    .map((line, idx) => `<text x="64" y="${270 + idx * 34}" font-size="28" fill="#E5E7EB">${escapeXml(line)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827"/><stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <text x="64" y="180" font-size="42" fill="#93C5FD">AI 营销海报</text>
  <text x="64" y="240" font-size="72" font-weight="700" fill="#FFFFFF">${escapeXml(headline)}</text>
  ${lineSvgs}
  <rect x="64" y="420" rx="20" ry="20" width="320" height="96" fill="#22C55E"/>
  <text x="224" y="482" text-anchor="middle" font-size="40" font-weight="700" fill="#052e16">${escapeXml(cta)}</text>
  <text x="64" y="1770" font-size="26" fill="#BFDBFE">由企微私域 SaaS 自动生成</text>
</svg>`;
  const poster_data_url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return { headline, subheading, cta, poster_svg: svg, poster_data_url };
}

const ASSISTANT_SCENES = {
  general:
    '你是 ZhiFlow 私域智能助手，帮助销售团队解答私域运营、客户跟进、话术与文案问题。回答简洁实用，可分段落。',
  sales: '你是顶级微信私域销售教练，擅长成交话术、破冰、逼单与异议处理。回答要可直接复制使用。',
  copy: '你是营销文案专家，擅长朋友圈、小红书、群发短文案。输出可直接投放的正文。',
  followup: '你是客户跟进顾问，根据场景给出下一步跟进策略与具体话术。',
  objection: '你是异议处理专家，针对客户顾虑给出 2～3 种应对话术，语气自然不生硬。',
};

/**
 * 站内 AI 助手：多轮自由对话（计入 ai_calls 配额）。
 * @param {{ tenantId: number; userId: number }} auth
 * @param {{ messages: Array<{ role: 'user'|'assistant'; content: string }>; scene?: string }} body
 */
export async function generateAssistantChat(auth, body) {
  const started = Date.now();
  const sceneKey = body.scene && ASSISTANT_SCENES[body.scene] ? body.scene : 'general';
  const history = (body.messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .slice(-24)
    .map((m) => ({
      role: m.role,
      content: String(m.content).trim().slice(0, 8000),
    }));

  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    throw new HttpError(400, '请提供用户消息', 400);
  }

  const messages = [
    { role: 'system', content: ASSISTANT_SCENES[sceneKey] },
    ...history,
  ];

  const { rawText, model, provider } = await invokeChatCompletions(messages, {
    max_tokens: 2000,
    temperature: 0.72,
  });
  bumpAiUsage(auth.tenantId);

  try {
    await AiGenerationLog.create({
      tenant_id: auth.tenantId,
      user_id: auth.userId,
      customer_id: null,
      kind: 'assistant_chat',
      input_message: lastUser.content.slice(0, 2000),
      output_json: { reply: rawText.slice(0, 4000), scene: sceneKey },
      model,
      meta_json: { duration_ms: Date.now() - started, provider, turns: history.length },
    });
  } catch (e) {
    console.error('[ai_generation_logs] assistant_chat persist failed', e);
  }

  return { reply: rawText, scene: sceneKey };
}

export async function generateSidebarScripts(tenantId, customerId) {
  const customer = await Customer.findOne({
    where: { id: Number(customerId), tenant_id: Number(tenantId), deleted_at: null },
    include: [
      {
        model: Tag,
        as: 'tags',
        through: { attributes: [] },
        attributes: ['name'],
      },
    ],
  });
  if (!customer) throw new HttpError(404, '客户不存在', 404);

  const stageMap = {
    new: '新客户',
    following: '跟进中',
    negotiating: '谈判中',
    won: '已成交',
    lost: '已流失',
    intent_confirm: '意向确认',
    proposal: '方案报价',
    negotiation: '商务谈判',
    deal: '成交',
  };
  const tagNames = (customer.tags ?? []).map((t) => t.name).join('、') || '无';
  const prompt = `你是一名私域销售顾问。
客户信息：
- 姓名：${customer.name || '未知'}
- 公司：${customer.company || '未知'}
- 阶段：${stageMap[customer.stage] ?? customer.stage}
- 意向分：${customer.intent_score}分
- 标签：${tagNames}

请生成3条不同风格的微信跟进话术，
要求：
1. 自然友好，不硬销
2. 每条100字以内
3. 针对客户当前阶段给出具体价值点
4. 三条风格各异（关怀型/价值型/促成型）

输出格式（只输出话术，用|||分隔三条，不要编号和解释）：
关怀型话术|||价值型话术|||促成型话术`;

  const { rawText } = await invokeChatCompletions(
    [
      {
        role: 'system',
        content: '你是私域销售顾问。严格按用户指定格式输出，不要额外解释。',
      },
      { role: 'user', content: prompt },
    ],
    { max_tokens: 600, temperature: 0.75 },
  );

  const scripts = String(rawText || '')
    .split('|||')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  bumpAiUsage(tenantId);
  return { scripts };
}

/**
 * AI 客户画像摘要：一句话概括客户核心特征 + 下一步建议。
 * GET /customers/:id/summary
 */
export async function generateCustomerSummary(tenantId, customerId) {
  const customer = await Customer.findOne({
    where: { id: Number(customerId), tenant_id: Number(tenantId), deleted_at: null },
    include: [
      {
        model: Tag,
        as: 'tags',
        through: { attributes: [] },
        attributes: ['name'],
      },
    ],
  });
  if (!customer) throw new HttpError(404, '客户不存在', 404);

  // 获取最近3条跟进记录
  const { CustomerFollowUp } = await import('../models/index.js');
  const recentFollowUps = await CustomerFollowUp.findAll({
    where: { customer_id: Number(customerId), tenant_id: Number(tenantId) },
    order: [['created_at', 'DESC']],
    limit: 3,
    attributes: ['type', 'content'],
  });

  const followUpBlock = recentFollowUps.length > 0
    ? recentFollowUps.map((f) => `[${f.type}] ${String(f.content || '').slice(0, 200)}`).join('\n')
    : '暂无跟进记录';

  const tagNames = (customer.tags ?? []).map((t) => t.name).join('、') || '无';
  const stageMap = {
    new: '新客户', following: '跟进中', negotiating: '谈判中', won: '已成交', lost: '已流失',
    intent_confirm: '意向确认', proposal: '方案报价', negotiation: '商务谈判', deal: '成交',
  };

  const prompt = `你是顶级销售教练，请根据客户信息生成一句话画像摘要（50字以内），包含：客户核心特征、当前阶段判断、1条下一步行动建议。
用自然中文，像老销售对新人说的一句话建议。

客户信息：
- 姓名：${customer.name || '未知'}
- 公司：${customer.company || '未知'}
- 阶段：${stageMap[customer.stage] ?? customer.stage ?? '未知'}
- 意向分：${customer.intent_score ?? '-'}分
- 来源：${customer.source || '未知'}
- 标签：${tagNames}

最近跟进记录：
${followUpBlock}

只输出一句话（50字以内），不要编号、不要解释、不要换行。`;

  const { rawText } = await invokeChatCompletions(
    [
      { role: 'system', content: '你是销售教练。输出一句精准的客户画像摘要，50字以内，像老销售的口吻。' },
      { role: 'user', content: prompt },
    ],
    { max_tokens: 160, temperature: 0.5 },
  );

  const summary = String(rawText || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  bumpAiUsage(tenantId);
  return {
    summary: summary || '该客户暂无足够信息生成画像，建议先补充关键字段并完成首次跟进。',
    stage: stageMap[customer.stage] ?? customer.stage,
    intent_score: customer.intent_score,
  };
}

/**
 * 员工活动 AI 教练建议
 * 根据员工今日/昨日活动数据、KPI进度、30天趋势，生成个性化改善建议
 */
export async function generateCoachingInsight(tenantId, employeeData) {
  const started = Date.now();

  const {
    name,
    today,
    yesterday,
    kpi,
    trend30,
    rankings,
  } = employeeData;

  // 计算环比变化
  const growth = (field) => {
    const t = today?.[field] || 0;
    const y = yesterday?.[field] || 0;
    if (y === 0) return t > 0 ? '新增' : '持平';
    const pct = Math.round(((t - y) / y) * 100);
    return pct >= 0 ? `↑${pct}%` : `↓${Math.abs(pct)}%`;
  };

  const userPrompt = `你是销售团队教练，请根据以下员工今日数据给出个性化建议。

员工：${name || '未知'}

今日数据：
- 跟进次数：${today?.followups || 0} 次（较昨日 ${growth('followups')}）
- 通话次数：${today?.calls || 0} 次（较昨日 ${growth('calls')}）
- 通话时长：${Math.round((today?.call_duration_sec || 0) / 60)} 分钟
- 成交订单：${today?.orders || 0} 笔（较昨日 ${growth('orders')}）
- 成交金额：¥${(today?.revenue || 0).toLocaleString()}
- 新客开发：${today?.new_customers || 0} 个
- 收件箱回复：${today?.inbox_replies || 0} 条

KPI 完成度：
${kpi ? `- 跟进：${kpi.followups ?? '-'}% 通话：${kpi.calls ?? '-'}% 订单：${kpi.orders ?? '-'}% 成交额：${kpi.revenue ?? '-'}%` : '（未设置 KPI）'}

近30天活跃趋势：${trend30 ? trend30.slice(-7).map((d) => `${d.date.slice(5)}:${d.count}次`).join('、') : '无数据'}

排行参考：
${rankings ? rankings.map((r) => `${r.dimension}: 第${r.rank || '-'}名`).join('，') : '无排行数据'}

请生成一段教练建议，要求：
1. 先一句话评价整体表现（客观、数据驱动）
2. 指出 1-2 个具体可改进的方向（如果各项都很好，可以说「保持优势，尝试突破」）
3. 给一句正向鼓励（真诚、不浮夸）
4. 总计控制在 80 字以内
5. 只输出纯文本，不要编号、不要 JSON、不要 Markdown`;

  const { rawText, model, provider } = await invokeChatCompletions(
    [
      {
        role: 'system',
        content: '你是销售团队教练，说话简洁、务实、有数据支撑。只输出一段纯文本建议，80字以内。',
      },
      { role: 'user', content: userPrompt },
    ],
    { max_tokens: 300, temperature: 0.7 },
  );

  bumpAiUsage(tenantId);

  try {
    const { AiGenerationLog } = await import('../models/aiGenerationLog.model.js');
    await AiGenerationLog.create({
      tenant_id: tenantId,
      kind: 'employee_coaching',
      input_message: JSON.stringify({ name, today }),
      output_json: { insight: rawText },
      model,
      meta_json: { duration_ms: Date.now() - started, provider },
    });
  } catch (e) {
    console.error('[ai_generation_logs] coaching persist failed', e);
  }

  return { insight: rawText || '暂无足够数据生成建议，请确保已完成至少一次跟进或通话。', model, provider };
}
