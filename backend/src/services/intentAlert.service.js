import dayjs from 'dayjs';
import Joi from 'joi';
import { Op, UniqueConstraintError } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { IntentAlert, Customer, User } from '../models/index.js';
import { listScriptLibraryItems } from './scriptLibrary.service.js';
import { isAdmin } from '../utils/permissions.js';

const listAlertsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(200).default(20),
  status: Joi.string().valid('pending', 'sent', 'failed', '').allow(null).optional(),
  start_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow('', null)
    .optional(),
  end_date: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow('', null)
    .optional(),
}).unknown(false);

/**
 * 当客户意向分单次上升达到阈值时创建预警（同客户同日仅一条）。
 * @param {{ id: number; tenant_id: number; owner_id: number }} customer
 * @param {number} scoreBefore
 * @param {number} scoreAfter
 */
export async function checkAndCreateIntentAlert(customer, scoreBefore, scoreAfter) {
  const delta = Number(scoreAfter) - Number(scoreBefore);
  if (delta < 15) return;
  const dayStart = dayjs().startOf('day').toDate();
  const exists = await IntentAlert.findOne({
    where: {
      customer_id: Number(customer.id),
      created_at: { [Op.gte]: dayStart },
      status: { [Op.in]: ['pending', 'sent'] },
    },
    attributes: ['id'],
  });
  if (exists) return;
  try {
    await IntentAlert.create(
      {
        tenant_id: Number(customer.tenant_id),
        customer_id: Number(customer.id),
        owner_id: Number(customer.owner_id),
        score_before: Number(scoreBefore),
        score_after: Number(scoreAfter),
        score_delta: delta,
        status: 'pending',
        created_at: new Date(),
      },
      {
        fields: [
          'tenant_id',
          'customer_id',
          'owner_id',
          'score_before',
          'score_after',
          'score_delta',
          'status',
          'created_at',
        ],
      },
    );
  } catch (e) {
    if (e instanceof UniqueConstraintError) return;
    const code = e?.parent?.code || e?.original?.code;
    if (code === 'ER_DUP_ENTRY') return;
    throw e;
  }
}

/**
 * @param {number} tenantId
 * @param {Record<string, unknown>} query
 */
export async function listAlerts(tenantId, query) {
  const { error, value } = listAlertsSchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const page = Number(value.page);
  const size = Number(value.size);
  const where = { tenant_id: Number(tenantId) };

  if (value.status) {
    where.status = value.status;
  }

  if (value.start_date || value.end_date) {
    const s = value.start_date ? `${value.start_date} 00:00:00` : '1970-01-01 00:00:00';
    const e = value.end_date ? `${value.end_date} 23:59:59` : '2999-12-31 23:59:59';
    where.created_at = { [Op.between]: [new Date(s), new Date(e)] };
  }

  const { rows, count } = await IntentAlert.findAndCountAll({
    where,
    include: [
      { model: Customer, attributes: ['id', 'name'], required: false },
      { model: User, as: 'owner', attributes: ['id', 'username', 'real_name'], required: false },
    ],
    order: [['created_at', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
    distinct: true,
  });

  const list = rows.map((r) => {
    const plain = r.get({ plain: true });
    return {
      id: plain.id,
      created_at: plain.created_at,
      sent_at: plain.sent_at,
      status: plain.status,
      score_before: plain.score_before,
      score_after: plain.score_after,
      score_delta: plain.score_delta,
      ai_script: plain.ai_script,
      customer: plain.Customer ? { id: plain.Customer.id, name: plain.Customer.name } : { id: plain.customer_id, name: null },
      owner: plain.owner
        ? { id: plain.owner.id, username: plain.owner.username, real_name: plain.owner.real_name ?? null }
        : { id: plain.owner_id, username: '', real_name: null },
    };
  });

  return { list, total: count, page, size };
}

const STAGE_LABELS = {
  new: '新线索',
  new_lead: '新线索',
  intent: '意向确认',
  intent_confirm: '意向确认',
  quote: '方案报价',
  proposal: '方案报价',
  negotiate: '商务谈判',
  negotiation: '商务谈判',
  deal: '成交',
  won: '已成交',
  lost: '流失',
  contacted: '已联系',
};

async function fetchRecommendedScripts(auth) {
  const scriptMap = new Map();
  const searchKeywords = ['跟进', '意向', '升温', '成交', '唤醒'];
  for (const kw of searchKeywords) {
    // eslint-disable-next-line no-await-in-loop
    const items = await listScriptLibraryItems(auth, { keyword: kw });
    for (const item of items) {
      if (!scriptMap.has(item.id)) {
        scriptMap.set(item.id, {
          id: item.id,
          title: item.title,
          category: item.category,
          body: item.body,
          body_preview: String(item.body).slice(0, 120),
        });
      }
    }
    if (scriptMap.size >= 8) break;
  }
  return [...scriptMap.values()].slice(0, 6);
}

function buildIntentFollowupPrompt(customerName, alert, customer) {
  const stage = customer?.stage ? STAGE_LABELS[customer.stage] || customer.stage : '未知';
  const scoreLine = `意向分从 ${alert.score_before} 升至 ${alert.score_after}（+${alert.score_delta}）`;
  const lines = [
    `客户「${customerName}」近期意向显著升温（${scoreLine}），当前阶段：${stage}。`,
    '请帮我写一条适合企微私聊的跟进话术：语气自然、有具体价值点、不施压，长度控制在 80～150 字。',
  ];
  if (alert.ai_script?.trim()) {
    lines.push(`系统已生成参考话术（可优化）：${alert.ai_script.trim().slice(0, 200)}`);
  }
  return lines.join('\n');
}

function buildCustomerFollowupPrompt(customerName, customer) {
  const stage = customer?.stage ? STAGE_LABELS[customer.stage] || customer.stage : '未知';
  const score = customer?.intent_score ?? 0;
  return [
    `客户「${customerName}」当前意向分 ${score}，阶段：${stage}。`,
    '请帮我写一条适合企微私聊的跟进话术：语气自然、有具体价值点、不施压，长度控制在 80～150 字。',
  ].join('\n');
}

function customerPayload(customer, customerName) {
  return {
    id: customer.id,
    name: customerName,
    stage: customer.stage,
    stage_label: customer.stage ? STAGE_LABELS[customer.stage] || customer.stage : null,
    intent_score: customer.intent_score,
  };
}

async function assemblePlaybook(auth, customer, alertFields) {
  const customerName = customer.name || customer.nickname || `客户#${customer.id}`;
  const recommendedScripts = await fetchRecommendedScripts(auth);
  const aiPrompt =
    alertFields.score_delta != null && alertFields.score_delta >= 15
      ? buildIntentFollowupPrompt(customerName, alertFields, customer)
      : buildCustomerFollowupPrompt(customerName, customer);

  return {
    source: alertFields.id ? 'intent_alert' : 'customer_high_intent',
    alert: alertFields.id
      ? {
          id: alertFields.id,
          score_before: alertFields.score_before,
          score_after: alertFields.score_after,
          score_delta: alertFields.score_delta,
          ai_script: alertFields.ai_script ?? null,
          created_at: alertFields.created_at ?? null,
        }
      : {
          id: null,
          score_before: alertFields.score_before ?? null,
          score_after: alertFields.score_after ?? customer.intent_score,
          score_delta: alertFields.score_delta ?? null,
          ai_script: alertFields.ai_script ?? null,
          created_at: null,
        },
    customer: customerPayload(customer, customerName),
    recommended_scripts: recommendedScripts,
    ai_prompt: aiPrompt,
    links: {
      customer: `/app/customers/${customer.id}`,
      ai_assistant: `/app/ai-assistant?scene=followup&q=${encodeURIComponent(aiPrompt)}`,
      script_library: '/app/script-library?keyword=跟进',
    },
  };
}

async function findCustomerInScope(auth, customerId) {
  const cid = Number(customerId);
  if (!Number.isFinite(cid)) throw new HttpError(400, '客户 ID 无效', 400);
  const where = { id: cid, tenant_id: auth.tenantId, deleted_at: null };
  if (!isAdmin(auth)) where.owner_id = auth.userId;
  const customer = await Customer.findOne({
    where,
    attributes: ['id', 'name', 'nickname', 'stage', 'intent_score', 'phone', 'owner_id'],
  });
  if (!customer) throw new HttpError(404, '客户不存在', 404);
  return customer;
}

/**
 * 意向预警「跟进 playbook」：推荐话术库条目 + AI 跟进提示词。
 */
export async function getIntentAlertPlaybook(auth, alertId) {
  const id = Number(alertId);
  if (!Number.isFinite(id)) throw new HttpError(400, '预警 ID 无效', 400);

  const row = await IntentAlert.findOne({
    where: { id, tenant_id: auth.tenantId },
    include: [
      {
        model: Customer,
        attributes: ['id', 'name', 'nickname', 'stage', 'intent_score', 'phone'],
        required: false,
      },
    ],
  });
  if (!row) throw new HttpError(404, '预警不存在', 404);

  const plain = row.get({ plain: true });
  const customer =
    plain.Customer ||
    (await findCustomerInScope(auth, plain.customer_id).catch(() => null));
  if (!customer) throw new HttpError(404, '客户不存在', 404);

  return assemblePlaybook(auth, customer, plain);
}

/**
 * 客户详情 / 侧边栏：按客户拉取跟进 playbook（优先最近预警，否则高意向合成）。
 */
export async function getCustomerIntentPlaybook(auth, customerId) {
  const customer = await findCustomerInScope(auth, customerId);

  const recentAlert = await IntentAlert.findOne({
    where: { tenant_id: auth.tenantId, customer_id: customer.id },
    order: [['created_at', 'DESC']],
  });

  if (recentAlert) {
    const plain = recentAlert.get({ plain: true });
    return assemblePlaybook(auth, customer, plain);
  }

  const score = Number(customer.intent_score) || 0;
  if (score < 65) {
    return {
      source: 'none',
      show_assistant: false,
      customer: customerPayload(customer, customer.name || customer.nickname || `客户#${customer.id}`),
      reason: '意向分未达到跟进助手阈值',
    };
  }

  return assemblePlaybook(auth, customer, {
    score_before: Math.max(0, score - 15),
    score_after: score,
    score_delta: null,
    ai_script: null,
  });
}

/**
 * 为收件箱 AI 草稿拼装跟进助手上下文（失败时返回 null，不阻断主流程）。
 */
export async function buildPlaybookDraftContext(auth, customerId) {
  try {
    const pb = await getCustomerIntentPlaybook(auth, customerId);
    if (pb.show_assistant === false || !pb.ai_prompt) return null;

    const parts = [];
    if (pb.alert?.score_delta != null) {
      parts.push(
        `客户近期意向升温 +${pb.alert.score_delta}（${pb.alert.score_before}→${pb.alert.score_after}）`,
      );
    } else if (pb.customer?.intent_score != null) {
      parts.push(`当前意向分 ${pb.customer.intent_score}`);
    }
    if (pb.customer?.stage_label) {
      parts.push(`阶段：${pb.customer.stage_label}`);
    }
    if (pb.alert?.ai_script?.trim()) {
      parts.push(`系统参考话术：${pb.alert.ai_script.trim().slice(0, 320)}`);
    }
    if (pb.recommended_scripts?.length) {
      parts.push(
        `话术库参考：${pb.recommended_scripts
          .slice(0, 3)
          .map((s) => `《${s.title}》${String(s.body).slice(0, 120)}`)
          .join('；')}`,
      );
    }
    parts.push(`请结合以上背景回复，语气自然、有具体价值、不施压。`);

    return {
      context_block: parts.join('\n'),
      scripts_count: pb.recommended_scripts?.length ?? 0,
      has_intent_alert: Boolean(pb.alert?.id),
      source: pb.source,
    };
  } catch {
    return null;
  }
}
