/**
 * @file 仪表盘统计：用户数、客户数、阶段分布、近期跟进次数等聚合。
 * @description 轻量统计直接查库；大数据量后可改为预聚合表（见设计文档）。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { fn, col, Op, QueryTypes } from 'sequelize';
import {
  sequelize,
  User,
  Customer,
  CustomerFollowUp,
  WeworkCustomerAddRecord,
  UsageStat,
  Subscription,
  Plan,
} from '../models/index.js';
import { isAdmin, customerWhereScope } from '../utils/permissions.js';
import { getRevenueSummary } from './orderRevenue.service.js';
import { countOverdueTicketsForTenant } from './ticketSlaReminder.service.js';
import { DEMO_TENANT_ID } from '../config/constants.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/** DB stage → 展示用六大阶段（合并历史枚举） */
const STAGE_LABEL_BY_DB = {
  new: '新线索',
  intent_confirm: '意向确认',
  contacted: '意向确认',
  proposal: '方案报价',
  intent: '方案报价',
  negotiation: '商务谈判',
  deal: '成交',
  lost: '流失',
};

function mergeStageDistribution(stageRows) {
  const labels = ['新线索', '意向确认', '方案报价', '商务谈判', '成交', '流失'];
  const counts = Object.fromEntries(labels.map((n) => [n, 0]));
  counts['其他'] = 0;
  for (const r of stageRows) {
    const dbKey = r.stage;
    const n = Number(r.count) || 0;
    const label = STAGE_LABEL_BY_DB[dbKey];
    if (label) {
      counts[label] += n;
    } else {
      counts['其他'] += n;
    }
  }
  const out = labels.map((name) => ({ name, value: counts[name] ?? 0 }));
  if ((counts['其他'] ?? 0) > 0) {
    out.push({ name: '其他', value: counts['其他'] });
  }
  return out;
}

/** 近 7 个日历日（含今天），按上海时区 YYYY-MM-DD */
function last7ShanghaiYmd() {
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    out.push(dayjs().tz('Asia/Shanghai').subtract(i, 'day').format('YYYY-MM-DD'));
  }
  return out;
}

function calcRate(curr, prev) {
  const c = Number(curr) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return null;
  return Math.round(((c - p) / p) * 1000) / 10;
}

export async function getOverview(auth) {
  const tenantId = auth.tenantId;
  const cWhere = customerWhereScope(auth);

  const activeUsers = await User.count({ where: { tenant_id: tenantId, status: 1 } });
  const totalCustomers = await Customer.count({ where: cWhere });

  const stageRows = await Customer.findAll({
    attributes: ['stage', [fn('COUNT', col('Customer.id')), 'count']],
    where: cWhere,
    group: ['stage'],
    raw: true,
  });

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const followCustWhere = isAdmin(auth) ? { tenant_id: tenantId } : { tenant_id: tenantId, owner_id: auth.userId };

  const followUps7d = await CustomerFollowUp.count({
    include: [
      {
        model: Customer,
        required: true,
        where: followCustWhere,
        attributes: [],
      },
    ],
    where: { created_at: { [Op.gte]: since } },
  });

  const stageMap = Object.fromEntries(stageRows.map((r) => [r.stage, Number(r.count)]));

  return {
    active_users: activeUsers,
    total_customers: totalCustomers,
    customers_by_stage: stageMap,
    follow_ups_last_7d: followUps7d,
  };
}

/**
 * 仪表盘图表序列：按日跟进次数、按日新增客户（仅当前租户）。
 */
export async function getCharts(auth, query) {
  const days = Math.min(90, Math.max(7, Number(query.days) || 30));
  const tenantId = auth.tenantId;
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - days);

  const admin = isAdmin(auth);

  const followJoin = admin
    ? 'INNER JOIN customers c ON c.id = f.customer_id AND c.tenant_id = :tid AND c.deleted_at IS NULL'
    : 'INNER JOIN customers c ON c.id = f.customer_id AND c.tenant_id = :tid AND c.owner_id = :uid AND c.deleted_at IS NULL';

  const followSql = `
    SELECT DATE(f.created_at) AS d, COUNT(*) AS cnt
    FROM customer_follow_ups f
    ${followJoin}
    WHERE f.created_at >= :since
    GROUP BY DATE(f.created_at)
    ORDER BY d ASC
  `;

  const custWhere = admin
    ? 'tenant_id = :tid AND deleted_at IS NULL'
    : 'tenant_id = :tid AND owner_id = :uid AND deleted_at IS NULL';
  const custSql = `
    SELECT DATE(created_at) AS d, COUNT(*) AS cnt
    FROM customers
    WHERE ${custWhere} AND created_at >= :since
    GROUP BY DATE(created_at)
    ORDER BY d ASC
  `;

  const repl = admin ? { tid: tenantId, since } : { tid: tenantId, since, uid: auth.userId };

  const [followRows, custRows] = await Promise.all([
    sequelize.query(followSql, { replacements: repl, type: QueryTypes.SELECT }),
    sequelize.query(custSql, { replacements: repl, type: QueryTypes.SELECT }),
  ]);

  const fmt = (rows) =>
    rows.map((r) => ({
      date: r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10),
      count: Number(r.cnt),
    }));

  return {
    days,
    follow_ups_by_day: fmt(followRows),
    new_customers_by_day: fmt(custRows),
  };
}

/**
 * 仪表盘增强统计：今日新增、近 7 日序列、阶段分布、成交率（租户 + 销售数据范围）。
 */
export async function getStats(auth) {
  const tenantId = auth.tenantId;
  const cWhere = customerWhereScope(auth);

  const activeUsers = await User.count({ where: { tenant_id: tenantId, status: 1 } });
  const totalCustomers = await Customer.count({ where: cWhere });
  const dealCustomers = await Customer.count({ where: { ...cWhere, stage: 'deal' } });
  const dealRatePercent = totalCustomers > 0 ? Math.round((dealCustomers / totalCustomers) * 100) : 0;

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const followCustWhere = isAdmin(auth) ? { tenant_id: tenantId } : { tenant_id: tenantId, owner_id: auth.userId };
  const followUpsLast7d = await CustomerFollowUp.count({
    include: [
      {
        model: Customer,
        required: true,
        where: followCustWhere,
        attributes: [],
      },
    ],
    where: { created_at: { [Op.gte]: since } },
  });

  const ymdList = last7ShanghaiYmd();
  const dayBuckets = ymdList.map((ymd) => {
    const start = dayjs.tz(ymd, 'YYYY-MM-DD', 'Asia/Shanghai').startOf('day').toDate();
    const end = dayjs.tz(ymd, 'YYYY-MM-DD', 'Asia/Shanghai').add(1, 'day').startOf('day').toDate();
    return { start, end };
  });

  const perDay = await Promise.all(
    dayBuckets.map(({ start, end }) =>
      Promise.all([
        Customer.count({
          where: { ...cWhere, created_at: { [Op.gte]: start, [Op.lt]: end } },
        }),
        Customer.count({
          where: {
            ...cWhere,
            stage: 'deal',
            created_at: { [Op.gte]: start, [Op.lt]: end },
          },
        }),
      ]),
    ),
  );

  const last7DaysNew = perDay.map((p) => p[0]);
  const last7DaysDeal = perDay.map((p) => p[1]);
  const last7DaysLabels = ymdList.map((d) => d.slice(5));
  const todayNewCount = last7DaysNew[last7DaysNew.length - 1] ?? 0;

  const stageRows = await Customer.findAll({
    attributes: ['stage', [fn('COUNT', col('Customer.id')), 'count']],
    where: cWhere,
    group: ['stage'],
    raw: true,
  });

  const stage_distribution = mergeStageDistribution(stageRows);

  const newCustomers7d = last7DaysNew.reduce((a, b) => a + b, 0);
  const addFriend7d = await WeworkCustomerAddRecord.count({
    where: { tenant_id: tenantId, created_at: { [Op.gte]: since } },
  });
  const inPipelineCount = await Customer.count({
    where: {
      ...cWhere,
      stage: { [Op.in]: ['intent_confirm', 'proposal', 'negotiation', 'contacted', 'intent'] },
    },
  });

  const funnelSteps = [
    { key: 'add_friend', label: '加好友(7日)', count: addFriend7d },
    { key: 'new_lead', label: '入库客户(7日)', count: newCustomers7d },
    { key: 'in_pipeline', label: '推进中', count: inPipelineCount },
    { key: 'deal', label: '累计成交', count: dealCustomers },
  ];
  const funnel = funnelSteps.map((step, i) => {
    const prev = i > 0 ? funnelSteps[i - 1].count : null;
    const rate =
      prev != null && prev > 0 ? Math.round((step.count / prev) * 1000) / 10 : null;
    return { ...step, conversion_from_prev_percent: rate };
  });

  /** 计划跟进日 ≤ 今日（上海日历日结束时点）的去重客户数 */
  const nowSh = dayjs().tz('Asia/Shanghai');
  const monthStart = nowSh.startOf('month').toDate();
  const prevMonthStart = nowSh.subtract(1, 'month').startOf('month').toDate();
  const todayCutoff = nowSh.endOf('day').toDate();
  const weekAgoCutoff = nowSh.subtract(7, 'day').endOf('day').toDate();

  const countPendingAt = async (cutoff) =>
    CustomerFollowUp.count({
      distinct: true,
      col: 'customer_id',
      where: {
        created_at: { [Op.lte]: cutoff },
        next_follow_at: {
          [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: cutoff }],
        },
      },
      include: [
        {
          model: Customer,
          required: true,
          where: cWhere,
          attributes: [],
        },
      ],
    });

  const [
    currMonthNewCustomers,
    prevMonthNewCustomers,
    highIntentCurrent,
    currMonthHighIntentNew,
    prevMonthHighIntentNew,
    dealsCurrentTotal,
    dealsPrevTotal,
    pendingFollowupCurrent,
    pendingFollowupWeekAgo,
    overdueTicketCount,
  ] = await Promise.all([
    Customer.count({
      where: { ...cWhere, created_at: { [Op.gte]: monthStart } },
    }),
    Customer.count({
      where: { ...cWhere, created_at: { [Op.gte]: prevMonthStart, [Op.lt]: monthStart } },
    }),
    Customer.count({
      where: { ...cWhere, intent_score: { [Op.gte]: 70 } },
    }),
    Customer.count({
      where: {
        ...cWhere,
        intent_score: { [Op.gte]: 70 },
        created_at: { [Op.gte]: monthStart },
      },
    }),
    Customer.count({
      where: {
        ...cWhere,
        intent_score: { [Op.gte]: 70 },
        created_at: { [Op.gte]: prevMonthStart, [Op.lt]: monthStart },
      },
    }),
    Customer.count({
      where: { ...cWhere, stage: { [Op.in]: ['deal', 'won'] } },
    }),
    Customer.count({
      where: {
        ...cWhere,
        stage: { [Op.in]: ['deal', 'won'] },
        updated_at: { [Op.lt]: monthStart },
      },
    }),
    countPendingAt(todayCutoff),
    countPendingAt(weekAgoCutoff),
    countOverdueTicketsForTenant(auth).catch(() => 0),
  ]);

  const revenue = await getRevenueSummary(auth);

  const statMonth = dayjs().tz('Asia/Shanghai').format('YYYY-MM');
  const [usageRow, subscriptionRow] = await Promise.all([
    UsageStat.findOne({
      where: { tenant_id: tenantId, stat_month: statMonth },
      attributes: ['ai_calls_used', 'broadcasts_used'],
    }),
    Subscription.findOne({
      where: { tenant_id: tenantId },
      include: [{ model: Plan, as: 'plan', attributes: ['ai_calls_monthly', 'name', 'code'], required: false }],
    }),
  ]);
  const aiCallsUsed = Number(usageRow?.ai_calls_used || 0);
  const aiLimit = subscriptionRow?.plan?.ai_calls_monthly ?? -1;
  const aiUsagePercent =
    aiLimit > 0 && aiLimit !== -1 ? Math.min(100, Math.round((aiCallsUsed / aiLimit) * 100)) : null;
  const minutesPerAiCall = 3;

  const result = {
    today_new_count: todayNewCount,
    total_customers: { value: totalCustomers, rate: calcRate(currMonthNewCustomers, prevMonthNewCustomers) },
    high_intent: { value: highIntentCurrent, rate: calcRate(currMonthHighIntentNew, prevMonthHighIntentNew) },
    deals_this_month: { value: dealsCurrentTotal, rate: calcRate(dealsCurrentTotal, dealsPrevTotal) },
    pending_followup: {
      value: pendingFollowupCurrent,
      rate: pendingFollowupWeekAgo === 0 ? null : Math.round(((pendingFollowupCurrent - pendingFollowupWeekAgo) / pendingFollowupWeekAgo) * 1000) / 10,
    },
    deal_rate_percent: dealRatePercent,
    active_users: activeUsers,
    follow_ups_last_7d: followUpsLast7d,
    overdue_follow_up_count: pendingFollowupCurrent,
    overdue_ticket_count: overdueTicketCount,
    last_7_days_new: last7DaysNew,
    last_7_days_deal: last7DaysDeal,
    last_7_days_labels: last7DaysLabels,
    stage_distribution,
    funnel,
    revenue,
    roi_summary: {
      ai_calls_used: aiCallsUsed,
      ai_calls_limit: aiLimit,
      ai_usage_percent: aiUsagePercent,
      follow_ups_last_7d: followUpsLast7d,
      pending_followup: pendingFollowupCurrent,
      estimated_minutes_saved: aiCallsUsed * minutesPerAiCall,
      plan_name: subscriptionRow?.plan?.name || null,
      plan_code: subscriptionRow?.plan?.code || null,
      note: '按每次 AI 约节省 3 分钟撰写话术估算，仅供参考',
    },
  };

  // 演示模式：覆盖环比数据为预设值，避免因演示数据分布不均导致负值
  if (auth.isDemo || auth.tenantId === DEMO_TENANT_ID) {
    result.total_customers = { value: result.total_customers.value || 30, rate: 12.5 };
    result.high_intent = { value: result.high_intent.value || 13, rate: 8.3 };
    result.deals_this_month = { value: result.deals_this_month.value || 5, rate: 20.0 };
    result.pending_followup = { value: 7, rate: null };
    result.overdue_follow_up_count = 7;
    result.last_7_days_labels = ['05-02', '05-03', '05-04', '05-05', '05-06', '05-07', '05-08'];
    result.last_7_days_new = [8, 12, 6, 15, 10, 18, 9];
    result.last_7_days_deal = [2, 3, 1, 4, 2, 5, 2];
    result.today_new_count = 9;
    result.funnel = [
      { key: 'add_friend', label: '加好友(7日)', count: 42, conversion_from_prev_percent: null },
      { key: 'new_lead', label: '入库客户(7日)', count: 38, conversion_from_prev_percent: 90.5 },
      { key: 'in_pipeline', label: '推进中', count: 18, conversion_from_prev_percent: 47.4 },
      { key: 'deal', label: '累计成交', count: 5, conversion_from_prev_percent: 27.8 },
    ];
    result.roi_summary = {
      ai_calls_used: 128,
      ai_calls_limit: 2000,
      ai_usage_percent: 6,
      follow_ups_last_7d: 24,
      pending_followup: 7,
      estimated_minutes_saved: 384,
      plan_name: '专业版',
      plan_code: 'pro',
      note: '按每次 AI 约节省 3 分钟撰写话术估算，仅供参考',
    };
  }

  return result;
}
