/**
 * @file 报表分析服务：漏斗分析、团队业绩、客户分析。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import {
  Customer,
  CustomerFollowUp,
  CustomerOrder,
  User,
  sequelize,
} from '../models/index.js';
import { customerWhereScope, isAdmin } from '../utils/permissions.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

// 阶段中文标签
const STAGE_LABELS = {
  new: '新线索', contacted: '已联系', intent: '有意向',
  intent_confirm: '意向确认', proposal: '方案报价',
  negotiation: '商务谈判', deal: '成交', lost: '流失',
};

// 漏斗阶段顺序（从宽到窄）
const FUNNEL_STAGES = ['new', 'contacted', 'intent_confirm', 'proposal', 'negotiation', 'deal'];

/**
 * 解析时间范围参数。
 */
function parseDateRange(query) {
  const now = dayjs().tz(TZ);
  let start, end;

  if (query.start_date && query.end_date) {
    start = dayjs.tz(query.start_date, TZ).startOf('day').toDate();
    end = dayjs.tz(query.end_date, TZ).endOf('day').toDate();
  } else if (query.period === 'last_week') {
    start = now.subtract(1, 'week').startOf('week').toDate();
    end = now.subtract(1, 'week').endOf('week').toDate();
  } else if (query.period === 'last_month') {
    start = now.subtract(1, 'month').startOf('month').toDate();
    end = now.subtract(1, 'month').endOf('month').toDate();
  } else if (query.period === 'last_quarter') {
    start = now.subtract(1, 'quarter').startOf('quarter').toDate();
    end = now.subtract(1, 'quarter').endOf('quarter').toDate();
  } else {
    // 默认本月
    start = now.startOf('month').toDate();
    end = now.endOf('month').toDate();
  }

  // 同比：去年同期
  const prevYearStart = dayjs(start).subtract(1, 'year').toDate();
  const prevYearEnd = dayjs(end).subtract(1, 'year').toDate();

  return { start, end, prevYearStart, prevYearEnd, periodLabel: formatPeriodLabel(start, end) };
}

function formatPeriodLabel(start, end) {
  const s = dayjs(start).tz(TZ);
  const e = dayjs(end).tz(TZ);
  return `${s.format('YYYY-MM-DD')} ~ ${e.format('YYYY-MM-DD')}`;
}

/**
 * ============================================================
 * 1. 销售漏斗分析
 * ============================================================
 */
export async function getFunnelReport(auth, query = {}) {
  const { start, end, prevYearStart, prevYearEnd, periodLabel } = parseDateRange(query);
  const cWhere = await customerWhereScope(auth);

  // --- 当前周期：各阶段客户数和意向分 ---
  const currentRows = await Customer.findAll({
    where: { ...cWhere, created_at: { [Op.lte]: end } },
    attributes: [
      'stage',
      [fn('COUNT', col('id')), 'count'],
      [fn('AVG', col('intent_score')), 'avg_intent'],
    ],
    group: ['stage'],
    raw: true,
    paranoid: false, // 含已删除
  });

  // --- 同比周期 ---
  const prevRows = await Customer.findAll({
    where: { ...cWhere, created_at: { [Op.lte]: prevYearEnd } },
    attributes: [
      'stage',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['stage'],
    raw: true,
    paranoid: false,
  });

  // --- 阶段停留时长（每位客户在当前阶段的停留天数） ---
  const dwellRows = await Customer.findAll({
    where: { ...cWhere, stage: { [Op.notIn]: ['deal', 'lost'] } },
    attributes: [
      'stage',
      [fn('AVG', literal('DATEDIFF(NOW(), COALESCE(updated_at, created_at))')), 'avg_days'],
      [fn('MAX', literal('DATEDIFF(NOW(), COALESCE(updated_at, created_at))')), 'max_days'],
    ],
    group: ['stage'],
    raw: true,
  });

  // --- 成交数据（当前周期） ---
  const dealStats = await CustomerOrder.findAll({
    where: {
      tenant_id: auth.tenantId,
      paid_at: { [Op.between]: [start, end] },
    },
    attributes: [
      [fn('COUNT', col('id')), 'deal_count'],
      [fn('SUM', col('amount')), 'total_amount'],
    ],
    raw: true,
  });
  const dealCount = Number(dealStats[0]?.deal_count ?? 0);
  const dealAmount = Number(dealStats[0]?.total_amount ?? 0);

  // --- 同比成交 ---
  const prevDeal = await CustomerOrder.findAll({
    where: {
      tenant_id: auth.tenantId,
      paid_at: { [Op.between]: [prevYearStart, prevYearEnd] },
    },
    attributes: [
      [fn('COUNT', col('id')), 'deal_count'],
      [fn('SUM', col('amount')), 'total_amount'],
    ],
    raw: true,
  });
  const prevDealCount = Number(prevDeal[0]?.deal_count ?? 0);
  const prevDealAmount = Number(prevDeal[0]?.total_amount ?? 0);

  // 构建漏斗
  const currentMap = {};
  for (const r of currentRows) {
    const total = Number(r.count);
    currentMap[r.stage] = {
      stage: r.stage,
      label: STAGE_LABELS[r.stage] || r.stage,
      count: total,
      avgIntent: Math.round(Number(r.avg_intent) || 0),
    };
  }
  const prevMap = {};
  for (const r of prevRows) {
    prevMap[r.stage] = Number(r.count);
  }

  // 漏斗核心阶段
  const funnel = FUNNEL_STAGES.map((s, i) => {
    const cur = currentMap[s] || { stage: s, label: STAGE_LABELS[s] || s, count: 0, avgIntent: 0 };
    const prev = prevMap[s] || 0;
    const prevStage = i > 0 ? (currentMap[FUNNEL_STAGES[i - 1]]?.count || 1) : cur.count || 1;
    const conversionRate = prevStage > 0 ? ((cur.count / prevStage) * 100).toFixed(1) : '0.0';
    const change = prev > 0 ? (((cur.count - prev) / prev) * 100).toFixed(1) : null;
    // 停留时长
    const dwell = dwellRows.find((d) => d.stage === s);
    return {
      ...cur,
      prevCount: prev,
      conversionRate: parseFloat(conversionRate),
      yoyChange: change !== null ? parseFloat(change) : null,
      avgDwellDays: dwell ? Math.round(Number(dwell.avg_days) || 0) : 0,
      maxDwellDays: dwell ? Math.round(Number(dwell.max_days) || 0) : 0,
    };
  });

  // 整体转化率（新线索 → 成交）
  const newCount = currentMap['new']?.count || 0;
  const overallConversion = newCount > 0
    ? ((currentMap['deal']?.count || 0) / newCount * 100).toFixed(1)
    : '0.0';

  return {
    period: periodLabel,
    funnel,
    summary: {
      totalCustomers: Object.values(currentMap).reduce((s, v) => s + v.count, 0),
      dealCount,
      dealAmount: Math.round(dealAmount * 100) / 100,
      overallConversion: parseFloat(overallConversion),
      yoyDealChange: prevDealCount > 0
        ? parseFloat((((dealCount - prevDealCount) / prevDealCount) * 100).toFixed(1))
        : null,
      yoyAmountChange: prevDealAmount > 0
        ? parseFloat((((dealAmount - prevDealAmount) / prevDealAmount) * 100).toFixed(1))
        : null,
    },
  };
}

/**
 * ============================================================
 * 2. 团队业绩报表
 * ============================================================
 */
export async function getTeamPerformance(auth, query = {}) {
  const { start, end, prevYearStart, prevYearEnd, periodLabel } = parseDateRange(query);
  const cWhere = await customerWhereScope(auth);

  // 获取团队成员
  const teamWhere = { tenant_id: auth.tenantId };
  if (!isAdmin(auth)) {
    // 非管理员只能看自己和下级（简化处理：只看同部门）
    teamWhere.id = auth.userId;
  }
  const members = await User.findAll({
    where: teamWhere,
    attributes: ['id', 'username', 'real_name', 'avatar_url'],
    order: [['id', 'ASC']],
    raw: true,
  });

  if (members.length === 0) {
    return { period: periodLabel, members: [], summary: {} };
  }

  const memberIds = members.map((m) => m.id);

  // 每人客户数、新增数
  const custStats = await Customer.findAll({
    where: { ...cWhere, owner_id: { [Op.in]: memberIds } },
    attributes: [
      'owner_id',
      [fn('COUNT', col('id')), 'total'],
      [fn('SUM', literal(`CASE WHEN created_at >= '${dayjs(start).format('YYYY-MM-DD')}' THEN 1 ELSE 0 END`)), 'new_count'],
      [fn('SUM', literal(`CASE WHEN stage = 'deal' THEN 1 ELSE 0 END`)), 'deal_count'],
      [fn('AVG', col('intent_score')), 'avg_intent'],
    ],
    group: ['owner_id'],
    raw: true,
    paranoid: false,
  });
  const custMap = {};
  for (const r of custStats) {
    custMap[r.owner_id] = {
      total: Number(r.total),
      newCount: Number(r.new_count),
      dealCount: Number(r.deal_count),
      avgIntent: Math.round(Number(r.avg_intent) || 0),
    };
  }

  // 每人跟进次数（当前周期）
  const fupStats = await CustomerFollowUp.findAll({
    where: {
      created_by: { [Op.in]: memberIds },
      created_at: { [Op.between]: [start, end] },
    },
    attributes: [
      'created_by',
      [fn('COUNT', col('id')), 'count'],
    ],
    group: ['created_by'],
    raw: true,
  });
  const fupMap = {};
  for (const r of fupStats) {
    fupMap[r.created_by] = Number(r.count);
  }

  // 每人成交金额（当前周期）
  const orderStats = await CustomerOrder.findAll({
    where: {
      tenant_id: auth.tenantId,
      created_by: { [Op.in]: memberIds },
      paid_at: { [Op.between]: [start, end] },
    },
    attributes: [
      'created_by',
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', col('amount')), 'amount'],
    ],
    group: ['created_by'],
    raw: true,
  });
  const orderMap = {};
  for (const r of orderStats) {
    orderMap[r.created_by] = {
      orderCount: Number(r.count),
      revenue: Math.round(Number(r.amount) * 100) / 100,
    };
  }

  const teamMembers = members.map((m) => {
    const cust = custMap[m.id] || { total: 0, newCount: 0, dealCount: 0, avgIntent: 0 };
    const ord = orderMap[m.id] || { orderCount: 0, revenue: 0 };
    return {
      userId: m.id,
      name: m.real_name || m.username,
      avatarUrl: m.avatar_url || null,
      ...cust,
      followupCount: fupMap[m.id] || 0,
      ...ord,
      conversionRate: cust.total > 0
        ? parseFloat(((cust.dealCount / cust.total) * 100).toFixed(1))
        : 0,
    };
  });

  // 排序：按成交金额降序
  teamMembers.sort((a, b) => b.revenue - a.revenue);

  // 团队汇总
  const summary = {
    totalMembers: teamMembers.length,
    totalCustomers: teamMembers.reduce((s, m) => s + m.total, 0),
    totalNew: teamMembers.reduce((s, m) => s + m.newCount, 0),
    totalDeals: teamMembers.reduce((s, m) => s + m.dealCount, 0),
    totalFollowups: teamMembers.reduce((s, m) => s + m.followupCount, 0),
    totalRevenue: Math.round(teamMembers.reduce((s, m) => s + m.revenue, 0) * 100) / 100,
    avgConversion: teamMembers.length > 0
      ? parseFloat((teamMembers.reduce((s, m) => s + m.conversionRate, 0) / teamMembers.length).toFixed(1))
      : 0,
  };

  return { period: periodLabel, members: teamMembers, summary };
}

/**
 * ============================================================
 * 3. 客户分析
 * ============================================================
 */
export async function getCustomerAnalysis(auth, query = {}) {
  const { start, end, periodLabel } = parseDateRange(query);
  const cWhere = await customerWhereScope(auth);

  // --- 来源分布 ---
  const sourceRows = await Customer.findAll({
    where: { ...cWhere },
    attributes: [
      [fn('IFNULL', col('source'), '未填写'), 'label'],
      [fn('COUNT', col('id')), 'value'],
    ],
    group: ['label'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw: true,
    paranoid: false,
  });
  const sourceDistribution = sourceRows.map((r) => ({
    label: r.label,
    value: Number(r.value),
  }));

  // --- 意向度分布 ---
  const intentRows = await Customer.findAll({
    where: { ...cWhere },
    attributes: [
      [fn('IFNULL', col('intent_tier'), '未知'), 'level'],
      [fn('COUNT', col('id')), 'count'],
      [fn('AVG', col('intent_score')), 'avg_score'],
    ],
    group: ['level'],
    raw: true,
  });
  const intentDistribution = intentRows.map((r) => ({
    level: r.level,
    label: { high: '高意向', medium: '中意向', low: '低意向', '未知': '未评分' }[r.level] || r.level,
    count: Number(r.count),
    avgScore: Math.round(Number(r.avg_score) || 0),
  }));

  // --- 新增趋势（按月） ---
  const trendStart = dayjs(start).subtract(5, 'month').startOf('month').toDate();
  const trendEnd = end;
  const trendRows = await Customer.findAll({
    where: { ...cWhere, created_at: { [Op.between]: [trendStart, trendEnd] } },
    attributes: [
      [fn('DATE_FORMAT', col('created_at'), '%Y-%m'), 'month'],
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', literal(`CASE WHEN stage = 'deal' THEN 1 ELSE 0 END`)), 'deals'],
    ],
    group: ['month'],
    order: [['month', 'ASC']],
    raw: true,
    paranoid: false,
  });
  const newCustomerTrend = trendRows.map((r) => ({
    month: r.month,
    count: Number(r.count),
    deals: Number(r.deals),
  }));

  // --- 标签 TOP 10 ---
  const tagRows = await sequelize.query(
    `SELECT t.name AS label, COUNT(ct.customer_id) AS value
     FROM tags t
     JOIN customer_tags ct ON ct.tag_id = t.id
     JOIN customers c ON c.id = ct.customer_id
       AND c.tenant_id = :tenantId
       AND c.deleted_at IS NULL
     WHERE t.tenant_id = :tenantId
     GROUP BY t.id, t.name
     ORDER BY value DESC
     LIMIT 10`,
    {
      replacements: { tenantId: auth.tenantId },
      type: QueryTypes.SELECT,
    },
  );
  const topTags = tagRows.map((r) => ({
    label: r.label,
    value: Number(r.value),
  }));

  // --- 跟进活跃度 ---
  const totalCustomers = await Customer.count({ where: cWhere, paranoid: false });
  const activeCustomers = await CustomerFollowUp.count({
    distinct: true,
    col: 'customer_id',
    where: {
      created_at: { [Op.between]: [start, end] },
    },
    include: [{ model: Customer, required: true, where: cWhere, attributes: [] }],
  });
  const noFollowupDays = await Customer.count({
    where: {
      ...cWhere,
      [Op.or]: [
        { last_contact_at: null },
        { last_contact_at: { [Op.lt]: dayjs().subtract(7, 'day').toDate() } },
      ],
    },
  });

  // 总计跟进记录数
  const totalFollowups = await CustomerFollowUp.count({
    include: [{ model: Customer, required: true, where: cWhere, attributes: [] }],
  });

  return {
    period: periodLabel,
    sourceDistribution,
    intentDistribution,
    newCustomerTrend,
    topTags,
    engagement: {
      totalCustomers,
      activeCustomers,
      activeRate: totalCustomers > 0
        ? parseFloat(((activeCustomers / totalCustomers) * 100).toFixed(1))
        : 0,
      noFollowup7Days: noFollowupDays,
      totalFollowups,
      avgFollowupsPerCustomer: totalCustomers > 0
        ? parseFloat((totalFollowups / totalCustomers).toFixed(1))
        : 0,
    },
  };
}

/**
 * ============================================================
 * 4. 报表汇总（仪表盘用，轻量）
 * ============================================================
 */
export async function getReportSummary(auth, query = {}) {
  const { start, end, periodLabel } = parseDateRange(query);
  const cWhere = await customerWhereScope(auth);

  const [total, newCount, dealCount, dealAmount] = await Promise.all([
    Customer.count({ where: cWhere, paranoid: false }),
    Customer.count({ where: { ...cWhere, created_at: { [Op.between]: [start, end] } }, paranoid: false }),
    CustomerOrder.findAll({
      where: { tenant_id: auth.tenantId, paid_at: { [Op.between]: [start, end] } },
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('amount')), 'amount'],
      ],
      raw: true,
    }),
  ]);
  const deals = Number(dealCount[0]?.count ?? 0);
  const revenue = Math.round(Number(dealCount[0]?.amount ?? 0) * 100) / 100;

  const followupCount = await CustomerFollowUp.count({
    where: { created_at: { [Op.between]: [start, end] } },
    include: [{ model: Customer, required: true, where: cWhere, attributes: [] }],
  });

  return {
    period: periodLabel,
    totalCustomers: total,
    newCustomers: newCount,
    dealCount: deals,
    revenue,
    followupCount,
    conversionRate: newCount > 0 ? parseFloat(((deals / newCount) * 100).toFixed(1)) : 0,
  };
}
