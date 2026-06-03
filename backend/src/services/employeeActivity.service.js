/**
 * @file 员工活动监控：老板看板数据聚合（纯查询，无需新表）。
 */
import { Op, fn, col, literal } from 'sequelize';
import {
  User, AuditLog, CustomerFollowUp, CallRecord, CustomerOrder,
  Customer, KpiTarget,
} from '../models/index.js';

/** 单日数值汇总辅助 */
function dayTotal(rows, idKey) {
  return rows.reduce((s, r) => s + Number(r.count || r.total_amount || 0), 0);
}

/** COUNT + SUM 两字段合并辅助 */
function daySum(rows, sumKey) {
  return rows.reduce((s, r) => s + Number(r[sumKey] || 0), 0);
}

/** customer_follow_ups 无 tenant_id，经客户表限定租户 */
function followUpsTenantInclude(tenantId) {
  return {
    model: Customer,
    required: true,
    attributes: [],
    where: { tenant_id: tenantId },
  };
}

/**
 * @param {{ tenantId: number; userId: number }} auth
 */
export async function getEmployeeActivity(auth) {
  const tenantId = auth.tenantId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayEnd = new Date(today); // 昨日截止于今日 00:00

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // 本周/上周边界（自然周 Mon-Sun）
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(thisMonday.getDate() - mondayOffset);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const thisWeekStart = new Date(thisMonday); // 本周一 00:00
  const lastWeekStart = new Date(lastMonday); // 上周一 00:00
  const lastWeekEnd = new Date(thisMonday); // 本周一 00:00 = 上周日 24:00
  const todayEnd = new Date(today);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // 获取所有活跃员工
  const users = await User.findAll({
    where: {
      tenant_id: tenantId,
      status: 1, // 启用状态
    },
    attributes: ['id', 'username', 'real_name', 'avatar_url', 'wework_userid', 'last_login_at'],
    order: [['last_login_at', 'DESC']],
  });

  const userIds = users.map((u) => u.id);

  // ============ 今日统计 ============
  const [ todayFollowups, todayCalls, todayOrders, todayNewCustomers, todayInboxReplies ] =
    await Promise.all([
      CustomerFollowUp.findAll({
        attributes: ['user_id', [fn('COUNT', col('CustomerFollowUp.id')), 'count']],
        where: { created_at: { [Op.gte]: today }, user_id: { [Op.in]: userIds } },
        include: [followUpsTenantInclude(tenantId)],
        group: ['user_id'],
        raw: true,
      }),
      CallRecord.findAll({
        attributes: [ 'caller_user_id', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('duration_seconds')), 'total_duration'] ],
        where: { tenant_id: tenantId, created_at: { [Op.gte]: today }, caller_user_id: { [Op.in]: userIds } },
        group: ['caller_user_id'], raw: true,
      }),
      CustomerOrder.findAll({
        attributes: [ 'created_by', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount'] ],
        where: { tenant_id: tenantId, created_at: { [Op.gte]: today }, created_by: { [Op.in]: userIds } },
        group: ['created_by'], raw: true,
      }),
      Customer.findAll({
        attributes: [ 'owner_id', [fn('COUNT', col('id')), 'count'] ],
        where: { tenant_id: tenantId, created_at: { [Op.gte]: today }, owner_id: { [Op.in]: userIds } },
        group: ['owner_id'], raw: true,
      }),
      AuditLog.findAll({
        attributes: [ 'actor_user_id', [fn('COUNT', col('id')), 'count'] ],
        where: { tenant_id: tenantId, created_at: { [Op.gte]: today }, action: 'inbox:reply', actor_user_id: { [Op.in]: userIds } },
        group: ['actor_user_id'], raw: true,
      }),
    ]);

  // ============ 昨日统计（用于环比） ============
  const yestWhere = { [Op.gte]: yesterday, [Op.lt]: yesterdayEnd };
  const [ yestFollowups, yestCalls, yestOrders, yestNewCustomers, yestInboxReplies,
    yestFollowupsPerUser, yestCallsPerUser, yestOrdersPerUser, yestNewCustPerUser, yestRepliesPerUser ] =
    await Promise.all([
      CustomerFollowUp.findAll({
        attributes: [[fn('COUNT', col('CustomerFollowUp.id')), 'count']],
        where: { created_at: yestWhere, user_id: { [Op.in]: userIds } },
        include: [followUpsTenantInclude(tenantId)],
        raw: true,
      }),
      CallRecord.findAll({
        attributes: [[fn('COUNT', col('id')), 'count']],
        where: { tenant_id: tenantId, created_at: yestWhere, caller_user_id: { [Op.in]: userIds } },
        raw: true,
      }),
      CustomerOrder.findAll({
        attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount']],
        where: { tenant_id: tenantId, created_at: yestWhere, created_by: { [Op.in]: userIds } },
        raw: true,
      }),
      Customer.findAll({
        attributes: [[fn('COUNT', col('id')), 'count']],
        where: { tenant_id: tenantId, created_at: yestWhere, owner_id: { [Op.in]: userIds } },
        raw: true,
      }),
      AuditLog.findAll({
        attributes: [[fn('COUNT', col('id')), 'count']],
        where: { tenant_id: tenantId, created_at: yestWhere, action: 'inbox:reply', actor_user_id: { [Op.in]: userIds } },
        raw: true,
      }),
      // 昨日每人数据
      CustomerFollowUp.findAll({
        attributes: ['user_id', [fn('COUNT', col('CustomerFollowUp.id')), 'count']],
        where: { created_at: yestWhere, user_id: { [Op.in]: userIds } },
        include: [followUpsTenantInclude(tenantId)],
        group: ['user_id'],
        raw: true,
      }),
      CallRecord.findAll({
        attributes: ['caller_user_id', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('duration_seconds')), 'total_duration']],
        where: { tenant_id: tenantId, created_at: yestWhere, caller_user_id: { [Op.in]: userIds } },
        group: ['caller_user_id'], raw: true,
      }),
      CustomerOrder.findAll({
        attributes: ['created_by', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount']],
        where: { tenant_id: tenantId, created_at: yestWhere, created_by: { [Op.in]: userIds } },
        group: ['created_by'], raw: true,
      }),
      Customer.findAll({
        attributes: ['owner_id', [fn('COUNT', col('id')), 'count']],
        where: { tenant_id: tenantId, created_at: yestWhere, owner_id: { [Op.in]: userIds } },
        group: ['owner_id'], raw: true,
      }),
      AuditLog.findAll({
        attributes: ['actor_user_id', [fn('COUNT', col('id')), 'count']],
        where: { tenant_id: tenantId, created_at: yestWhere, action: 'inbox:reply', actor_user_id: { [Op.in]: userIds } },
        group: ['actor_user_id'], raw: true,
      }),
    ]);

  const summaryPrev = {
    total_followups: Number(yestFollowups[0]?.count) || 0,
    total_calls: Number(yestCalls[0]?.count) || 0,
    total_orders: Number(yestOrders[0]?.count) || 0,
    total_revenue: Number(yestOrders[0]?.total_amount) || 0,
    total_new_customers: Number(yestNewCustomers[0]?.count) || 0,
    total_inbox_replies: Number(yestInboxReplies[0]?.count) || 0,
  };

  // ============ 本周汇总（本周一 ~ 今天） vs 上周 ============
  const weekWhere = { [Op.gte]: thisWeekStart, [Op.lt]: todayEnd };
  const lastWeekWhere = { [Op.gte]: lastWeekStart, [Op.lt]: lastWeekEnd };
  const [weekFollowups, weekCalls, weekOrders, weekNewCust, weekReplies] =
    await Promise.all([
      CustomerFollowUp.findAll({
        attributes: [[fn('COUNT', col('CustomerFollowUp.id')), 'count']],
        where: { created_at: weekWhere, user_id: { [Op.in]: userIds } },
        include: [followUpsTenantInclude(tenantId)],
        raw: true,
      }),
      CallRecord.findAll({ attributes: [[fn('COUNT', col('id')), 'count']], where: { tenant_id: tenantId, created_at: weekWhere, caller_user_id: { [Op.in]: userIds } }, raw: true }),
      CustomerOrder.findAll({ attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount']], where: { tenant_id: tenantId, created_at: weekWhere, created_by: { [Op.in]: userIds } }, raw: true }),
      Customer.findAll({ attributes: [[fn('COUNT', col('id')), 'count']], where: { tenant_id: tenantId, created_at: weekWhere, owner_id: { [Op.in]: userIds } }, raw: true }),
      AuditLog.findAll({ attributes: [[fn('COUNT', col('id')), 'count']], where: { tenant_id: tenantId, created_at: weekWhere, action: 'inbox:reply', actor_user_id: { [Op.in]: userIds } }, raw: true }),
    ]);
  const [lwFollowups, lwCalls, lwOrders, lwNewCust, lwReplies] =
    await Promise.all([
      CustomerFollowUp.findAll({
        attributes: [[fn('COUNT', col('CustomerFollowUp.id')), 'count']],
        where: { created_at: lastWeekWhere, user_id: { [Op.in]: userIds } },
        include: [followUpsTenantInclude(tenantId)],
        raw: true,
      }),
      CallRecord.findAll({ attributes: [[fn('COUNT', col('id')), 'count']], where: { tenant_id: tenantId, created_at: lastWeekWhere, caller_user_id: { [Op.in]: userIds } }, raw: true }),
      CustomerOrder.findAll({ attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total_amount']], where: { tenant_id: tenantId, created_at: lastWeekWhere, created_by: { [Op.in]: userIds } }, raw: true }),
      Customer.findAll({ attributes: [[fn('COUNT', col('id')), 'count']], where: { tenant_id: tenantId, created_at: lastWeekWhere, owner_id: { [Op.in]: userIds } }, raw: true }),
      AuditLog.findAll({ attributes: [[fn('COUNT', col('id')), 'count']], where: { tenant_id: tenantId, created_at: lastWeekWhere, action: 'inbox:reply', actor_user_id: { [Op.in]: userIds } }, raw: true }),
    ]);
  const weekSummary = {
    total_followups: Number(weekFollowups[0]?.count) || 0,
    total_calls: Number(weekCalls[0]?.count) || 0,
    total_orders: Number(weekOrders[0]?.count) || 0,
    total_revenue: Number(weekOrders[0]?.total_amount) || 0,
    total_new_customers: Number(weekNewCust[0]?.count) || 0,
    total_inbox_replies: Number(weekReplies[0]?.count) || 0,
  };
  const weekPrev = {
    total_followups: Number(lwFollowups[0]?.count) || 0,
    total_calls: Number(lwCalls[0]?.count) || 0,
    total_orders: Number(lwOrders[0]?.count) || 0,
    total_revenue: Number(lwOrders[0]?.total_amount) || 0,
    total_new_customers: Number(lwNewCust[0]?.count) || 0,
    total_inbox_replies: Number(lwReplies[0]?.count) || 0,
  };

  // 30天活动趋势（额外用于时间范围切换）
  const dailyTrendRaw = await AuditLog.findAll({
    attributes: [
      [fn('DATE', col('created_at')), 'date'],
      'action',
      [fn('COUNT', col('id')), 'count'],
    ],
    where: {
      tenant_id: tenantId,
      created_at: { [Op.gte]: thirtyDaysAgo },
    },
    group: [fn('DATE', col('created_at')), 'action'],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  // 整理趋势数据：按日期汇总，分 action 计数（最多30天）
  const KEY_ACTIONS = ['followup:create', 'call:initiate', 'order:create', 'inbox:reply', 'customer:create'];
  const dailyTrend = [];
  for (let i = 30; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayRows = dailyTrendRaw.filter((r) => r.date === dateStr);
    const point = { date: dateStr };
    for (const action of KEY_ACTIONS) {
      const row = dayRows.find((r) => r.action === action);
      point[action] = Number(row?.count) || 0;
    }
    point.total = dayRows.reduce((s, r) => s + Number(r.count), 0);
    dailyTrend.push(point);
  }

  // 今日时段分布（按小时统计所有审计日志，展示团队活跃节奏）
  const hourlyRaw = await AuditLog.findAll({
    attributes: [
      [fn('HOUR', col('created_at')), 'hour'],
      [fn('COUNT', col('id')), 'count'],
    ],
    where: {
      tenant_id: tenantId,
      created_at: { [Op.gte]: today },
    },
    group: [fn('HOUR', col('created_at'))],
    order: [[fn('HOUR', col('created_at')), 'ASC']],
    raw: true,
  });
  const hourlyDistribution = [];
  for (let h = 0; h < 24; h++) {
    const row = hourlyRaw.find((r) => r.hour === h);
    hourlyDistribution.push({ hour: h, count: Number(row?.count) || 0 });
  }

  // 最近操作日志（最近50条）
  const recentLogs = await AuditLog.findAll({
    where: {
      tenant_id: tenantId,
      created_at: { [Op.gte]: sevenDaysAgo },
    },
    include: [{
      model: User, as: 'actor',
      attributes: ['id', 'username', 'real_name'],
      required: false,
    }],
    order: [['id', 'DESC']],
    limit: 50,
  });

  // 近7天活跃员工计数（有操作日志的）
  const activePast7Days = new Set(
    recentLogs.map((l) => l.actor_user_id).filter(Boolean),
  ).size;

  // ============ KPI 目标 ============
  const kpiTargets = await KpiTarget.findAll({
    where: { tenant_id: tenantId },
    raw: true,
  });
  // 构建快速查找表：key = `${userId || 'default'}_${dimension}_${period}`
  const kpiMap = {};
  for (const k of kpiTargets) {
    const uid = k.user_id || 'default';
    kpiMap[`${uid}_${k.dimension}_${k.period}`] = Number(k.target_value);
  }

  // 构建每个员工的今日数据
  const members = users.map((u) => {
    const uid = u.id;
    const fw = todayFollowups.find((r) => r.user_id === uid);
    const call = todayCalls.find((r) => r.caller_user_id === uid);
    const order = todayOrders.find((r) => r.created_by === uid);
    const newCust = todayNewCustomers.find((r) => r.owner_id === uid);
    const inboxReply = todayInboxReplies.find((r) => r.actor_user_id === uid);

    const yFw = yestFollowupsPerUser.find((r) => r.user_id === uid);
    const yCall = yestCallsPerUser.find((r) => r.caller_user_id === uid);
    const yOrder = yestOrdersPerUser.find((r) => r.created_by === uid);
    const yNewCust = yestNewCustPerUser.find((r) => r.owner_id === uid);
    const yReply = yestRepliesPerUser.find((r) => r.actor_user_id === uid);

    // KPI 进度计算
    const kpi = {};
    const DIMENSIONS = ['followups', 'calls', 'revenue', 'orders', 'new_customers'];
    for (const dim of DIMENSIONS) {
      const todayVal = dim === 'revenue'
        ? Number(order?.total_amount) || 0
        : Number(fw?.count) || 0; // placeholder, will override
      let actual = 0;
      if (dim === 'followups') actual = Number(fw?.count) || 0;
      if (dim === 'calls') actual = Number(call?.count) || 0;
      if (dim === 'revenue') actual = Number(order?.total_amount) || 0;
      if (dim === 'orders') actual = Number(order?.count) || 0;
      if (dim === 'new_customers') actual = Number(newCust?.count) || 0;

      const target = kpiMap[`${uid}_${dim}_daily`] ?? kpiMap[`default_${dim}_daily`] ?? 0;
      kpi[dim] = target > 0 ? Math.min(Math.round((actual / target) * 100), 999) : null;
    }

    return {
      id: uid,
      username: u.username,
      real_name: u.real_name,
      avatar_url: u.avatar_url,
      wework_userid: u.wework_userid,
      last_login_at: u.last_login_at,
      is_online: u.last_login_at
        ? (Date.now() - new Date(u.last_login_at).getTime()) < 15 * 60 * 1000
        : false,
      today: {
        followups: Number(fw?.count) || 0,
        calls: Number(call?.count) || 0,
        call_duration_sec: Number(call?.total_duration) || 0,
        orders: Number(order?.count) || 0,
        revenue: Number(order?.total_amount) || 0,
        new_customers: Number(newCust?.count) || 0,
        inbox_replies: Number(inboxReply?.count) || 0,
      },
      yesterday: {
        followups: Number(yFw?.count) || 0,
        calls: Number(yCall?.count) || 0,
        call_duration_sec: Number(yCall?.total_duration) || 0,
        orders: Number(yOrder?.count) || 0,
        revenue: Number(yOrder?.total_amount) || 0,
        new_customers: Number(yNewCust?.count) || 0,
        inbox_replies: Number(yReply?.count) || 0,
      },
      kpi,
    };
  });

  // 汇总
  const summary = {
    total_users: users.length,
    online_users: members.filter((m) => m.is_online).length,
    active_today: members.filter(
      (m) => m.today.followups + m.today.calls + m.today.orders + m.today.new_customers + m.today.inbox_replies > 0,
    ).length,
    total_followups_today: members.reduce((s, m) => s + m.today.followups, 0),
    total_calls_today: members.reduce((s, m) => s + m.today.calls, 0),
    total_orders_today: members.reduce((s, m) => s + m.today.orders, 0),
    total_revenue_today: members.reduce((s, m) => s + m.today.revenue, 0),
    total_new_customers_today: members.reduce((s, m) => s + m.today.new_customers, 0),
    total_inbox_replies_today: members.reduce((s, m) => s + m.today.inbox_replies, 0),
    active_past_7days: activePast7Days,
  };

  // 排行榜（按维度生成 Top N）
  const RANK_DIMENSIONS = [
    { key: 'activity', label: '综合活跃度', pick: (m) => m.today.followups + m.today.calls + m.today.orders + m.today.new_customers + m.today.inbox_replies, format: (v) => `${v} 次操作` },
    { key: 'revenue', label: '今日成单金额', pick: (m) => m.today.revenue, format: (v) => `¥${v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toLocaleString()}` },
    { key: 'orders', label: '今日成单数', pick: (m) => m.today.orders, format: (v) => `${v} 单` },
    { key: 'followups', label: '今日跟进数', pick: (m) => m.today.followups, format: (v) => `${v} 次` },
    { key: 'new_customers', label: '今日新增客户', pick: (m) => m.today.new_customers, format: (v) => `${v} 人` },
  ];
  const rankings = RANK_DIMENSIONS.map((dim) => ({
    key: dim.key,
    label: dim.label,
    items: members
      .filter((m) => dim.pick(m) > 0)
      .sort((a, b) => dim.pick(b) - dim.pick(a))
      .slice(0, 5)
      .map((m, idx) => ({
        rank: idx + 1,
        user_id: m.id,
        real_name: m.real_name || m.username,
        value: dim.pick(m),
        display: dim.format(dim.pick(m)),
      })),
  }));

  // 每人近30天每日活跃度（用于热力图）
  const perUserDailyRaw = await AuditLog.findAll({
    attributes: [
      'actor_user_id',
      [fn('DATE', col('created_at')), 'date'],
      [fn('COUNT', col('id')), 'count'],
    ],
    where: {
      tenant_id: tenantId,
      created_at: { [Op.gte]: thirtyDaysAgo },
      actor_user_id: { [Op.in]: userIds },
    },
    group: ['actor_user_id', fn('DATE', col('created_at'))],
    order: [[fn('DATE', col('created_at')), 'ASC']],
    raw: true,
  });

  const memberDailyMap = {};
  for (const u of users) memberDailyMap[u.id] = {};
  for (const row of perUserDailyRaw) {
    const uid = row.actor_user_id;
    if (!memberDailyMap[uid]) memberDailyMap[uid] = {};
    memberDailyMap[uid][row.date] = Number(row.count) || 0;
  }

  const memberDailyActivity = {};
  for (const u of users) {
    const map = memberDailyMap[u.id] || {};
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      arr.push({ date: dateStr, count: map[dateStr] || 0 });
    }
    memberDailyActivity[u.id] = arr;
  }

  return {
    summary,
    summary_prev: summaryPrev,
    week_summary: weekSummary,
    week_prev: weekPrev,
    daily_trend: dailyTrend,
    hourly_distribution: hourlyDistribution,
    rankings,
    kpi_targets: kpiTargets,
    member_daily_activity: memberDailyActivity,
    members: members.sort((a, b) => {
      // 排序：有今日活动的排前面，再按成交额降序
      const aToday = a.today.followups + a.today.calls + a.today.orders + a.today.new_customers + a.today.inbox_replies;
      const bToday = b.today.followups + b.today.calls + b.today.orders + b.today.new_customers + b.today.inbox_replies;
      if (aToday !== bToday) return bToday - aToday;
      return b.today.revenue - a.today.revenue;
    }),
    recent_logs: recentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      target_type: l.target_type,
      target_id: l.target_id,
      actor: l.actor ? {
        id: l.actor.id,
        real_name: l.actor.real_name,
      } : null,
      created_at: l.created_at,
    })),
  };
}
