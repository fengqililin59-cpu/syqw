/**
 * @file AI 教练建议服务：多维度分析员工数据 → 调用 AI 生成个性化建议 → 入库
 *
 * 维度体系（coach_type）：
 *   followup  — 跟进效率（跟进次数/回复率/间隔/活跃度趋势）
 *   call      — 通话能力（通话次数/时长/接通率）
 *   deal      — 成交转化（成交数/金额/客单价/转化率）
 *   develop   — 客户开发（新增客户/意向转化/渠道来源）
 *   time      — 时间管理（活跃时段/任务完成率/响应速度）
 *   overall   — 综合教练建议（全维度概览 + 重点方向）
 */

import { Op, fn, col, literal } from 'sequelize';
import {
  CoachingSuggestion, User, Customer, CustomerFollowUp, CallRecord,
  CustomerOrder, Task, KpiTarget,
} from '../models/index.js';
import { getEmployeeActivity } from './employeeActivity.service.js';
import { env } from '../config/env.js';
import * as billingService from './billing.service.js';
import { HttpError } from '../utils/httpError.js';

// ============================================================
// 内部 AI 调用辅助（复用 aiContent 的同款逻辑）
// ============================================================

function getAiConfig() {
  const useDeepseek = !!env.deepseekApiKey;
  const key = useDeepseek ? env.deepseekApiKey : (env.openaiApiKey || '');
  const baseUrl = useDeepseek
    ? (env.deepseekBaseUrl || 'https://api.deepseek.com') + '/v1/chat/completions'
    : (env.openaiBaseUrl || 'https://api.openai.com') + '/v1/chat/completions';
  const model = useDeepseek ? 'deepseek-chat' : 'gpt-4o-mini';
  return { key, useDeepseek, baseUrl, model };
}

async function invokeAI(messages, opts = {}) {
  const { key, useDeepseek, baseUrl, model } = getAiConfig();
  const max_tokens = opts.max_tokens ?? 800;
  const temperature = opts.temperature ?? 0.75;

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || res.statusText;
    throw new HttpError(502, `AI 接口失败：${msg}`, 502);
  }

  const rawText = data?.choices?.[0]?.message?.content?.trim();
  if (!rawText) throw new HttpError(502, 'AI 返回为空', 502);
  return { rawText, model, provider: useDeepseek ? 'deepseek' : 'openai' };
}

function bumpAiUsage(tenantId) {
  if (!tenantId) return;
  billingService.incrementUsage(tenantId, 'ai_calls').catch(e =>
    console.error('[billing] increment ai_calls', e),
  );
}

// ============================================================
// 维度 → AI Prompt 工程
// ============================================================

const COACH_PROMPTS = {
  followup: {
    system: '你是销售团队的跟进效率教练。你擅长从跟进数据中发现规律，指出跟进频率、时机和策略的改进方向。说话简洁、有数据支撑。',
    dimensionLabel: '跟进效率',
  },
  call: {
    system: '你是销售团队的通话能力教练。你擅长从通话数据中分析沟通效率，给出通话策略、时长管理和话术改进建议。说话简洁、有数据支撑。',
    dimensionLabel: '通话能力',
  },
  deal: {
    system: '你是销售团队的成交转化教练。你擅长从成交数据中发现弱点，给出提升成交率、客单价和缩短成交周期的具体建议。说话简洁、有数据支撑。',
    dimensionLabel: '成交转化',
  },
  develop: {
    system: '你是销售团队的客户开发教练。你擅长分析客户获取和开发的效率，给出拓展新客、提升意向转化率的建议。说话简洁、有数据支撑。',
    dimensionLabel: '客户开发',
  },
  time: {
    system: '你是销售团队的时间管理教练。你擅长从任务和活跃时段数据中发现效率问题，给出优先级管理和时间分配建议。说话简洁、有数据支撑。',
    dimensionLabel: '时间管理',
  },
  overall: {
    system: '你是销售团队的综合教练。你能从多维度数据中快速识别关键问题，给出 1-2 个最需要改进的方向和具体行动建议。说话简洁、有数据支撑、不带套话。',
    dimensionLabel: '综合建议',
  },
};

// ============================================================
// 数据聚合：单员工多维度快照
// ============================================================

async function buildEmployeeSnapshot(tenantId, userId, employeeActivityResult) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(today);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 从员工活动看板获取今日/昨日/KPI 数据
  const members = employeeActivityResult?.members || [];
  const memberData = members.find(m => m.id === userId) || {};

  // 今日指标
  const todayMetrics = {
    followups: memberData.today?.followups || 0,
    calls: memberData.today?.calls || 0,
    call_duration_min: Math.round((memberData.today?.call_duration_sec || 0) / 60),
    orders: memberData.today?.orders || 0,
    revenue: memberData.today?.revenue || 0,
    new_customers: memberData.today?.new_customers || 0,
    inbox_replies: memberData.today?.inbox_replies || 0,
  };

  // 昨日指标
  const yesterdayMetrics = {
    followups: memberData.yesterday?.followups || 0,
    calls: memberData.yesterday?.calls || 0,
    orders: memberData.yesterday?.orders || 0,
    revenue: memberData.yesterday?.revenue || 0,
  };

  // 7天聚合
  const [followup7d, call7d, order7d, task7d] = await Promise.all([
    CustomerFollowUp.count({ where: { user_id: userId, created_at: { [Op.gte]: sevenDaysAgo } } }),
    CallRecord.count({ where: { caller_user_id: userId, started_at: { [Op.gte]: sevenDaysAgo } } }),
    CustomerOrder.count({ where: { created_by: userId, created_at: { [Op.gte]: sevenDaysAgo } } }),
    Task.count({ where: { assignee_id: userId, created_at: { [Op.gte]: sevenDaysAgo } } }),
  ]);

  // 30天聚合
  const [followup30d, order30d, revenue30dRows] = await Promise.all([
    CustomerFollowUp.count({ where: { user_id: userId, created_at: { [Op.gte]: thirtyDaysAgo } } }),
    CustomerOrder.count({ where: { created_by: userId, created_at: { [Op.gte]: thirtyDaysAgo } } }),
    CustomerOrder.findAll({
      attributes: [[fn('SUM', col('amount')), 'total']],
      where: { created_by: userId, created_at: { [Op.gte]: thirtyDaysAgo } },
      raw: true,
    }),
  ]);
  const revenue30d = parseFloat(revenue30dRows?.[0]?.total || 0);

  // 客户池数据
  const [totalCustomers, highIntentCustomers, newCustomers30d] = await Promise.all([
    Customer.count({ where: { owner_id: userId } }),
    Customer.count({ where: { owner_id: userId, intention_level: { [Op.in]: ['high', 'intent_confirm'] } } }),
    Customer.count({
      where: { owner_id: userId, added_at: { [Op.gte]: thirtyDaysAgo } },
    }),
  ]);

  // 任务统计
  const [taskTotal, taskDone] = await Promise.all([
    Task.count({ where: { assignee_id: userId } }),
    Task.count({ where: { assignee_id: userId, status: 'done' } }),
  ]);

  // KPI
  const kpiTargets = await KpiTarget.findAll({
    where: {
      tenant_id: tenantId,
      [Op.or]: [{ user_id: userId }, { user_id: null }],
    },
    raw: true,
  });
  const kpi = {};
  const kpiMap = {};
  for (const k of kpiTargets) {
    const key = `${k.user_id || 'all'}_${k.dimension}_${k.period}`;
    kpiMap[key] = parseFloat(k.target_value);
  }
  if (kpiMap[`${userId}_followups_daily`] || kpiMap['all_followups_daily']) {
    const t = kpiMap[`${userId}_followups_daily`] || kpiMap['all_followups_daily'];
    kpi.followups_pct = t > 0 ? Math.min(Math.round((todayMetrics.followups / t) * 100), 999) : null;
  }
  if (kpiMap[`${userId}_calls_daily`] || kpiMap['all_calls_daily']) {
    const t = kpiMap[`${userId}_calls_daily`] || kpiMap['all_calls_daily'];
    kpi.calls_pct = t > 0 ? Math.min(Math.round((todayMetrics.calls / t) * 100), 999) : null;
  }
  if (kpiMap[`${userId}_orders_daily`] || kpiMap['all_orders_daily']) {
    const t = kpiMap[`${userId}_orders_daily`] || kpiMap['all_orders_daily'];
    kpi.orders_pct = t > 0 ? Math.min(Math.round((todayMetrics.orders / t) * 100), 999) : null;
  }
  if (kpiMap[`${userId}_revenue_daily`] || kpiMap['all_revenue_daily']) {
    const t = kpiMap[`${userId}_revenue_daily`] || kpiMap['all_revenue_daily'];
    kpi.revenue_pct = t > 0 ? Math.min(Math.round((todayMetrics.revenue / t) * 100), 999) : null;
  }

  return {
    today: todayMetrics,
    yesterday: yesterdayMetrics,
    week7: { followups: followup7d, calls: call7d, orders: order7d, tasks: task7d },
    month30: { followups: followup30d, orders: order30d, revenue: revenue30d },
    customers: { total: totalCustomers, high_intent: highIntentCustomers, new_30d: newCustomers30d },
    tasks: { total: taskTotal, done: taskDone, done_rate: taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0 },
    kpi,
    rankings: employeeActivityResult?.rankings || [],
  };
}

// ============================================================
// AI 生成单维度教练建议
// ============================================================

async function generateDimensionCoaching(tenantId, employeeName, snapshot, coachType) {
  const promptCfg = COACH_PROMPTS[coachType];
  const started = Date.now();
  const { today, yesterday, week7, month30, customers, tasks, kpi } = snapshot;

  const growth = (field) => {
    const t = today[field] || 0;
    const y = yesterday[field] || 0;
    if (y === 0) return t > 0 ? '从0起步' : '均无数据';
    const pct = Math.round(((t - y) / y) * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  let dataContext = '';
  switch (coachType) {
    case 'followup':
      dataContext = `跟进效率数据：
- 今日跟进：${today.followups} 次（较昨日 ${growth('followups')}）
- 近7天跟进：${week7.followups} 次（日均 ${(week7.followups / 7).toFixed(1)}）
- 近30天跟进：${month30.followups} 次
- 客户池：${customers.total} 个客户（高意向 ${customers.high_intent}）
- KPI达成：${kpi.followups_pct != null ? kpi.followups_pct + '%' : '未设KPI'}`;
      break;
    case 'call':
      dataContext = `通话能力数据：
- 今日通话：${today.calls} 次（较昨日 ${growth('calls')}），时长 ${today.call_duration_min} 分钟
- 近7天通话：${week7.calls} 次
- 客户池高意向：${customers.high_intent} 个（是否都通过话？）
- KPI达成：${kpi.calls_pct != null ? kpi.calls_pct + '%' : '未设KPI'}`;
      break;
    case 'deal':
      dataContext = `成交转化数据：
- 今日成交：${today.orders} 笔（较昨日 ${growth('orders')}），金额 ¥${today.revenue.toLocaleString()}
- 近7天成交：${week7.orders} 笔
- 近30天成交：${month30.orders} 笔，总金额 ¥${month30.revenue.toLocaleString()}${month30.orders > 0 ? '，客单价 ¥' + Math.round(month30.revenue / month30.orders).toLocaleString() : ''}
- 客户池：${customers.total} 个（高意向 ${customers.high_intent} 个待转化）
- KPI达成：${kpi.orders_pct != null ? '订单 ' + kpi.orders_pct + '%' : ''}${kpi.revenue_pct != null ? ' 金额 ' + kpi.revenue_pct + '%' : ''}`;
      break;
    case 'develop':
      dataContext = `客户开发数据：
- 今日新客：${today.new_customers} 个
- 近30天新客：${customers.new_30d} 个
- 客户池总量：${customers.total}（高意向 ${customers.high_intent} = ${customers.total > 0 ? Math.round(customers.high_intent / customers.total * 100) : 0}%）
- 今日跟进：${today.followups} 次（新客开发 = 跟进 + 转化）`;
      break;
    case 'time':
      dataContext = `时间管理数据：
- 今日跟进：${today.followups} 次，通话：${today.calls} 次
- 任务完成率：${tasks.done_rate}%（${tasks.done}/${tasks.total}）
- 今日收件箱回复：${today.inbox_replies || 0} 条
- 今日成交：${today.orders} 笔（成交需要时间投入）`;
      break;
    case 'overall':
    default:
      dataContext = `综合数据概览：
- 跟进：今日${today.followups}次（较昨日 ${growth('followups')}），30天${month30.followups}次
- 通话：今日${today.calls}次（${today.call_duration_min}分钟），7天${week7.calls}次
- 成交：今日${today.orders}笔¥${today.revenue.toLocaleString()}，30天${month30.orders}笔¥${month30.revenue.toLocaleString()}
- 新客：近30天${customers.new_30d}个，客户池${customers.total}个（高意向${customers.high_intent}）
- 任务：完成率${tasks.done_rate}%（${tasks.done}/${tasks.total}）
- 收件箱：${today.inbox_replies || 0}条回复`;
      break;
  }

  const userPrompt = `员工：${employeeName}
${dataContext}

请给出一条${promptCfg.dimensionLabel}教练建议，要求：
1. 先一句话评述数据关键发现（客观）
2. 给出 1 个具体可操作的改进建议（可执行、不空泛）
3. 一句正向鼓励（真诚、简短）
4. 总计 80-120 字
5. 纯文本输出，不要编号、JSON、Markdown`;

  const { rawText, model, provider } = await invokeAI(
    [
      { role: 'system', content: promptCfg.system },
      { role: 'user', content: userPrompt },
    ],
    { max_tokens: 350, temperature: 0.7 },
  );

  bumpAiUsage(tenantId);

  return {
    content: rawText || '当前数据不足以生成针对性建议，继续积累活动数据后将自动生成。',
    model,
    provider,
    duration_ms: Date.now() - started,
  };
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 为指定员工/租户生成全维度教练建议并入库
 * @param {{ tenantId: number, userId?: number }} auth
 * @param {object} opts { targetUserId?, overrideActivity? }
 */
export async function generateCoaching(auth, opts = {}) {
  const tenantId = auth.tenantId;
  const targetUserId = opts.targetUserId || auth.userId;

  // 获取员工姓名
  const user = await User.findByPk(targetUserId, { attributes: ['id', 'real_name', 'username'] });
  if (!user) return { generated: 0, message: '员工不存在' };
  const employeeName = user.real_name || user.username || '未知';

  // 获取活动数据
  const activity = opts.overrideActivity || await getEmployeeActivity(auth).catch(() => ({ members: [], rankings: [] }));
  const snapshot = await buildEmployeeSnapshot(tenantId, targetUserId, activity);

  // 删除该员工今天的旧建议（当日覆盖式生成）
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  await CoachingSuggestion.destroy({
    where: {
      tenant_id: tenantId,
      user_id: targetUserId,
      generated_at: { [Op.gte]: todayStart },
    },
  });

  // 生成 6 个维度的建议
  const types = ['followup', 'call', 'deal', 'develop', 'time', 'overall'];
  const priorities = { followup: 3, call: 3, deal: 2, develop: 3, time: 4, overall: 2 };

  const results = [];
  for (const coachType of types) {
    try {
      const ai = await generateDimensionCoaching(tenantId, employeeName, snapshot, coachType);
      const record = await CoachingSuggestion.create({
        tenant_id: tenantId,
        user_id: targetUserId,
        coach_type: coachType,
        title: `${COACH_PROMPTS[coachType].dimensionLabel}建议`,
        content: ai.content,
        context_data: snapshot,
        priority: priorities[coachType],
        status: 'active',
        generated_by: ai.model,
      });
      results.push({ id: record.id, coach_type: coachType, title: record.title });
    } catch (err) {
      console.error(`[coaching] ${coachType} generation failed for user ${targetUserId}:`, err.message);
    }
  }

  return { generated: results.length, user: { id: targetUserId, name: employeeName }, suggestions: results };
}

/**
 * 批量生成所有员工教练建议
 */
export async function generateAllCoaching(auth) {
  const tenantId = auth.tenantId;
  const users = await User.findAll({
    where: { tenant_id: tenantId, status: 1 },
    attributes: ['id', 'real_name', 'username'],
  });
  if (!users.length) return { generated: 0, users: [] };

  // 一次获取全租户活动数据
  const activity = await getEmployeeActivity(auth).catch(() => ({ members: [], rankings: [] }));

  let totalGenerated = 0;
  const results = [];
  for (const user of users) {
    const r = await generateCoaching(auth, { targetUserId: user.id, overrideActivity: activity });
    totalGenerated += r.generated;
    results.push(r);
  }

  return { generated: totalGenerated, users: results };
}

/**
 * 查询教练建议列表
 */
export async function listCoaching(tenantId, query = {}) {
  const { userId, coachType, status, priority, limit = 50, offset = 0 } = query;
  const where = { tenant_id: tenantId };
  if (userId) where.user_id = userId;
  if (coachType) where.coach_type = coachType;
  if (status) where.status = status;
  if (priority) where.priority = priority;

  const { count, rows } = await CoachingSuggestion.findAndCountAll({
    where,
    include: [{ model: User, as: 'target_user', attributes: ['id', 'real_name', 'username', 'avatar_url'] }],
    order: [
      ['priority', 'ASC'],
      ['generated_at', 'DESC'],
    ],
    limit,
    offset,
  });

  return { total: count, items: rows };
}

/**
 * 获取单条建议
 */
export async function getCoaching(id) {
  return CoachingSuggestion.findByPk(id, {
    include: [{ model: User, as: 'target_user', attributes: ['id', 'real_name', 'username'] }],
  });
}

/**
 * 忽略建议
 */
export async function dismissCoaching(id, tenantId) {
  const [n] = await CoachingSuggestion.update(
    { status: 'dismissed', dismissed_at: new Date() },
    { where: { id, tenant_id: tenantId } },
  );
  return n > 0;
}

/**
 * 标记为已实施
 */
export async function implementCoaching(id, tenantId) {
  const [n] = await CoachingSuggestion.update(
    { status: 'implemented', implemented_at: new Date() },
    { where: { id, tenant_id: tenantId } },
  );
  return n > 0;
}

/**
 * 预览单员工教练建议（不入库，用于手动触发前预览）
 */
export async function previewCoaching(auth, targetUserId) {
  const tenantId = auth.tenantId;
  const user = await User.findByPk(targetUserId, { attributes: ['id', 'real_name', 'username'] });
  if (!user) throw new Error('员工不存在');
  const employeeName = user.real_name || user.username || '未知';

  const activity = await getEmployeeActivity(auth).catch(() => ({ members: [], rankings: [] }));
  const snapshot = await buildEmployeeSnapshot(tenantId, targetUserId, activity);

  const types = ['followup', 'call', 'deal', 'develop', 'time', 'overall'];
  const previews = [];
  for (const coachType of types) {
    try {
      const ai = await generateDimensionCoaching(tenantId, employeeName, snapshot, coachType);
      previews.push({
        coach_type: coachType,
        title: COACH_PROMPTS[coachType].dimensionLabel + '建议',
        content: ai.content,
        priority: coachType === 'deal' || coachType === 'overall' ? 2 : coachType === 'time' ? 4 : 3,
      });
    } catch (e) {
      previews.push({ coach_type: coachType, title: COACH_PROMPTS[coachType].dimensionLabel + '建议', content: '生成失败：' + e.message, priority: 3 });
    }
  }

  return {
    user: { id: targetUserId, name: employeeName },
    snapshot,
    previews,
  };
}
