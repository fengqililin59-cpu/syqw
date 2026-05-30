/**
 * @file 客户意向评分：可解释规则分 + AI 分，按 0.7/0.3 融合，写入客户与历史表。
 */
import { QueryTypes } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { Customer, CustomerScore, WeworkCustomerMessage, sequelize } from '../models/index.js';
import { getCustomer } from './customer.service.js';
import { generateIntentScoreFromChat } from './aiContent.service.js';
import { checkAndCreateIntentAlert } from './intentAlert.service.js';

const RE_PRICE = /(价格|利率|息|息费|费用|多少钱|几个点|年化|月供|成本)/;
const RE_QUOTA = /(额度|能贷|批多少|能批|下款|资质|条件|流水|公积金|社保)/;
const RE_REJECT = /(不要|算了|不用|别发|打扰|黑名单|举报|拒贷|骗贷)/;
const RE_PRICE_REJ = /(太贵|高得离谱|接受不了|做不下来|做不起|划不来)/;
const RE_URL = /https?:\/\/\S+/i;

const THROTTLE_MS = 10 * 60 * 1000;

/**
 * @param {string} text
 */
function hasAny(text, res) {
  return res.test(text);
}

/**
 * 末尾连续客户发言条数（时间升序消息列表）。
 * @param {Array<{ direction: string }>} ascMsgs
 */
function tailCustomerStreak(ascMsgs) {
  let n = 0;
  for (let i = ascMsgs.length - 1; i >= 0; i--) {
    if (ascMsgs[i].direction === 'customer') n += 1;
    else break;
  }
  return n;
}

/**
 * @param {Array<{ direction: string; content?: string | null; msg_time: Date }>} ascMsgs
 */
function buildTranscript(ascMsgs) {
  const lines = [];
  for (const m of ascMsgs) {
    const t = m.content ? String(m.content).trim().slice(0, 500) : '';
    if (!t) continue;
    const who = m.direction === 'customer' ? '客户' : '销售';
    lines.push(`${who}：${t}`);
  }
  return lines.join('\n');
}

/**
 * @param {number} hoursSinceCustomer
 */
function timeDecayPoints(hoursSinceCustomer) {
  if (!Number.isFinite(hoursSinceCustomer)) return -40;
  if (hoursSinceCustomer > 168) return -40;
  if (hoursSinceCustomer > 72) return -20;
  if (hoursSinceCustomer > 24) return -10;
  return 0;
}

/**
 * 规则分 0-100：行为 + 资质 + 衰减 + 负向。
 * @param {object} ctx
 */
function computeRuleScore(ctx) {
  const {
    ascMsgs,
    profileExtra,
    remarkText,
    customerPlain,
  } = ctx;

  let score = 0;

  const custTexts = ascMsgs
    .filter((m) => m.direction === 'customer')
    .map((m) => String(m.content || ''));
  const allCustJoined = custTexts.join('\n');

  if (custTexts.some((t) => hasAny(t, RE_PRICE))) score += 20;
  if (custTexts.some((t) => hasAny(t, RE_QUOTA))) score += 15;
  if (tailCustomerStreak(ascMsgs) >= 3) score += 15;

  const now = Date.now();
  const custTimes = ascMsgs.filter((m) => m.direction === 'customer').map((m) => new Date(m.msg_time).getTime());
  const lastCust = custTimes.length ? Math.max(...custTimes) : null;
  if (lastCust != null) {
    const hoursSince = (now - lastCust) / 3600000;
    if (hoursSince <= 24) score += 10;
    score += timeDecayPoints(hoursSince);
  } else {
    score += timeDecayPoints(Infinity);
  }

  if (custTexts.some((t) => RE_URL.test(t))) score += 10;

  const ex = profileExtra && typeof profileExtra === 'object' ? profileExtra : {};
  if (ex.has_house === true || ex.有房 === true) score += 20;
  if (ex.has_car === true || ex.有车 === true) score += 10;
  if (ex.has_business_license === true || ex.有执照 === true || ex.has_company_license === true) score += 20;
  if (ex.has_fund === true || ex.公积金 === true) score += 15;

  const negBlob = `${allCustJoined}\n${remarkText || ''}`;
  if (hasAny(negBlob, RE_REJECT)) score -= 50;
  if (custTexts.some((t) => hasAny(t, RE_PRICE_REJ))) score -= 30;

  const noPhone = !customerPlain.phone?.trim();
  const noWechat = !customerPlain.wechat_id?.trim();
  if (noPhone && noWechat && custTexts.length >= 6) score -= 20;

  return Math.max(0, Math.min(100, score));
}

/**
 * @param {number} finalScore
 */
export function tierFromScore(finalScore) {
  if (finalScore >= 80) return '高意向';
  if (finalScore >= 50) return '中意向';
  return '低意向';
}

/**
 * @param {number} finalScore
 * @param {string} tier
 */
export function adviceFromScore(finalScore, tier) {
  if (finalScore >= 80) return '优先成交窗口：可推进方案确认或预约面谈。';
  if (finalScore >= 50) return '持续培育：补充案例、资质说明与信任背书，适度跟进。';
  return '低频触达：避免过度打扰，可做长尾培育或暂存池。';
}

/**
 * @param {number} tenantId
 * @param {number} customerId
 */
async function loadProfileExtra(tenantId, customerId) {
  try {
    const rows = await sequelize.query(
      'SELECT profile_extra FROM customer_profile_extensions WHERE tenant_id = :tid AND customer_id = :cid LIMIT 1',
      {
        replacements: { tid: tenantId, cid: customerId },
        type: QueryTypes.SELECT,
      },
    );
    const row = /** @type {{ profile_extra?: unknown }} */ (rows[0]);
    if (!row?.profile_extra) return {};
    const raw = row.profile_extra;
    if (typeof raw === 'object' && raw !== null) return raw;
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
  } catch {
    /* 未执行 012 迁移时表不存在 */
  }
  return {};
}

/**
 * @param {{ userId: number; tenantId: number; roleName?: string | null }} auth
 * @param {number} customerId
 * @param {{ force?: boolean }} opts
 */
export async function scoreCustomerIntent(auth, customerId, opts = {}) {
  const force = Boolean(opts.force);
  const plain = await getCustomer(auth, customerId);

  const existing = await Customer.findOne({
    where: { id: customerId, tenant_id: auth.tenantId },
  });
  if (!existing) {
    throw new HttpError(404, '客户不存在', 404);
  }

  if (
    !force &&
    existing.last_scored_at &&
    Date.now() - new Date(existing.last_scored_at).getTime() < THROTTLE_MS
  ) {
    return {
      throttled: true,
      intent_score: existing.intent_score,
      intent_tier: existing.intent_tier,
      intent_stage_label: existing.intent_stage_label,
      intent_confidence: existing.intent_confidence,
      intent_rule_score: existing.intent_rule_score,
      intent_ai_score: existing.intent_ai_score,
      advice: adviceFromScore(Number(existing.intent_score), String(existing.intent_tier || '')),
      last_scored_at: existing.last_scored_at,
    };
  }

  const ascMsgs = await WeworkCustomerMessage.findAll({
    where: { tenant_id: auth.tenantId, customer_id: customerId },
    order: [['msg_time', 'ASC']],
    limit: 400,
    attributes: ['direction', 'content', 'msg_time'],
  });
  const ascPlain = ascMsgs.map((m) => m.get({ plain: true }));

  const profileExtra = await loadProfileExtra(auth.tenantId, customerId);
  const ruleScore = computeRuleScore({
    ascMsgs: ascPlain,
    profileExtra,
    remarkText: plain.remark || '',
    customerPlain: plain,
  });

  const transcript = buildTranscript(ascPlain);

  let aiScore = 50;
  let aiStage = '了解中';
  let aiConfidence = '中';
  let aiReason = '';
  let aiMeta = { model: null, provider: null };
  let aiOk = true;

  try {
    const ai = await generateIntentScoreFromChat(transcript, {
      tenantId: auth.tenantId,
      customerId,
      ownerUserId: plain.owner_id,
    });
    aiScore = ai.intent_score;
    aiStage = ai.stage;
    aiConfidence = ai.confidence;
    aiReason = ai.reason || '';
    aiMeta = { model: ai.model, provider: ai.provider };
  } catch (e) {
    aiOk = false;
    if (e instanceof HttpError && e.status === 503) {
      aiScore = ruleScore;
      aiReason = '未配置 AI，AI 分已与规则分对齐';
    } else {
      aiScore = Math.max(0, Math.min(100, ruleScore));
      aiReason = `AI 暂不可用：${String(e?.message || e).slice(0, 80)}`;
    }
  }

  const finalScore = Math.round(ruleScore * 0.7 + aiScore * 0.3);
  const tier = tierFromScore(finalScore);
  const advice = adviceFromScore(finalScore, tier);

  const scoreBeforeFinal = Number(existing.intent_score || 0);
  await existing.update({
    intent_rule_score: ruleScore,
    intent_ai_score: aiScore,
    intent_score: finalScore,
    intent_tier: tier,
    intent_stage_label: aiStage,
    intent_confidence: aiConfidence,
    last_scored_at: new Date(),
  });
  checkAndCreateIntentAlert(existing, scoreBeforeFinal, finalScore)
    .catch((err) => console.error('[IntentAlert] 预警创建失败', err));

  await CustomerScore.create({
    tenant_id: auth.tenantId,
    customer_id: customerId,
    rule_score: ruleScore,
    ai_score: aiScore,
    final_score: finalScore,
    intent_stage: aiStage,
    confidence: aiConfidence,
    reason_snippet: (aiReason || advice).slice(0, 500),
  });

  return {
    throttled: false,
    intent_rule_score: ruleScore,
    intent_ai_score: aiScore,
    intent_score: finalScore,
    intent_tier: tier,
    intent_stage_label: aiStage,
    intent_confidence: aiConfidence,
    ai_reason: aiReason,
    advice,
    blend: { rule_weight: 0.7, ai_weight: 0.3, ai_ok: aiOk },
    last_scored_at: new Date().toISOString(),
    model: aiMeta.model,
    provider: aiMeta.provider,
  };
}

/**
 * @param {{ userId: number; tenantId: number; roleName?: string | null }} auth
 * @param {number} customerId
 * @param {{ page?: number; size?: number }} query
 */
export async function listScoreHistory(auth, customerId, query) {
  await getCustomer(auth, customerId);
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(50, Math.max(1, Number(query.size) || 20));
  const { rows, count } = await CustomerScore.findAndCountAll({
    where: { tenant_id: auth.tenantId, customer_id: customerId },
    order: [['created_at', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });
  return {
    list: rows.map((r) => r.get({ plain: true })),
    total: count,
    page,
    size,
  };
}

/**
 * Worker / 回调里无 auth：仅内部调用，用客户归属人做审计 user_id。
 * @param {number} tenantId
 * @param {number} customerId
 */
export async function scoreCustomerIntentInternal(tenantId, customerId) {
  const row = await Customer.findOne({ where: { id: customerId, tenant_id: tenantId } });
  if (!row) return { ok: false, reason: 'no_customer' };
  const plain = row.get({ plain: true });
  const auth = {
    userId: plain.owner_id,
    tenantId,
    roleName: '管理员',
  };
  const data = await scoreCustomerIntent(auth, customerId, { force: true });
  return { ok: true, ...data };
}

/**
 * 企微入库后异步触发（防阻塞）；由 env.SCORE_ON_WEWORK_MESSAGE 控制。
 * @param {number} tenantId
 * @param {number} customerId
 */
export function queueIntentScore(tenantId, customerId) {
  if (!env.scoreOnWeworkMessage) return;
  setImmediate(() => {
    scoreCustomerIntentInternal(tenantId, customerId).catch((e) =>
      console.error('[intent-score] async failed', e),
    );
  });
}
