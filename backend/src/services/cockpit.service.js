/**
 * @file 老板驾驶舱：今日/本月经营指标、趋势、AI 今日建议。
 * 所有数字均来自本租户真实数据，不引入任何外部市场数据；无数据时返回 null 而非编造。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op, fn, col } from 'sequelize';
import {
  AdSpendDaily,
  Appointment,
  Customer,
  CustomerCard,
  CustomerOrder,
} from '../models/index.js';
import { REVENUE_ORDER_STATUSES } from './orderRevenue.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';

function dayRange(dateStr) {
  const d = dayjs.tz(dateStr, TZ);
  return { start: d.startOf('day').toDate(), end: d.endOf('day').toDate() };
}

function today() {
  return dayjs().tz(TZ).format('YYYY-MM-DD');
}

function pct(numerator, denominator) {
  const d = Number(denominator) || 0;
  if (d <= 0) return null;
  return Math.round((Number(numerator) / d) * 1000) / 10;
}

function money(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

/** 到店类状态：已到店与已完成都算到店 */
const ARRIVED_STATUSES = ['arrived', 'completed'];

async function countAppointments(tenantId, range, statuses) {
  const where = {
    tenant_id: tenantId,
    start_at: { [Op.between]: [range.start, range.end] },
  };
  if (statuses) where.status = { [Op.in]: statuses };
  return Appointment.count({ where });
}

async function sumRevenue(tenantId, range) {
  const total = await CustomerOrder.sum('amount', {
    where: {
      tenant_id: tenantId,
      status: { [Op.in]: REVENUE_ORDER_STATUSES },
      paid_at: { [Op.between]: [range.start, range.end] },
    },
  });
  return money(total);
}

async function sumCardPaid(tenantId, range) {
  const total = await CustomerCard.sum('paid_amount', {
    where: {
      tenant_id: tenantId,
      status: { [Op.ne]: 'refunded' },
      created_at: { [Op.between]: [range.start, range.end] },
    },
  });
  return money(total);
}

async function sumAdSpend(tenantId, startDate, endDate) {
  try {
    const total = await AdSpendDaily.sum('spend_cny', {
      where: { tenant_id: tenantId, stat_date: { [Op.between]: [startDate, endDate] } },
    });
    return money(total);
  } catch (err) {
    // 广告成本打通是可选模块，未建表的环境不应让整个驾驶舱不可用；
    // 返回 null 会让下游 CAC / ROI 一并留空，符合「没有数据就不编造」。
    if (err?.original?.code === 'ER_NO_SUCH_TABLE' || err?.parent?.code === 'ER_NO_SUCH_TABLE') {
      return null;
    }
    throw err;
  }
}

/**
 * 驾驶舱首屏：今日与本月核心经营指标。
 */
export async function getOverview(tenantId) {
  const t = today();
  const todayRange = dayRange(t);
  const monthStartStr = dayjs().tz(TZ).startOf('month').format('YYYY-MM-DD');
  const monthRange = {
    start: dayjs.tz(monthStartStr, TZ).startOf('day').toDate(),
    end: todayRange.end,
  };

  const [
    todayNewCustomers,
    todayBooked,
    todayArrived,
    todayRevenue,
    todayCardPaid,
    monthNewCustomers,
    monthArrived,
    monthRevenue,
    monthCardPaid,
    monthSpend,
    monthRepeatVisitors,
  ] = await Promise.all([
    Customer.count({ where: { tenant_id: tenantId, created_at: { [Op.between]: [todayRange.start, todayRange.end] } } }),
    countAppointments(tenantId, todayRange, null),
    countAppointments(tenantId, todayRange, ARRIVED_STATUSES),
    sumRevenue(tenantId, todayRange),
    sumCardPaid(tenantId, todayRange),
    Customer.count({ where: { tenant_id: tenantId, created_at: { [Op.between]: [monthRange.start, monthRange.end] } } }),
    countAppointments(tenantId, monthRange, ARRIVED_STATUSES),
    sumRevenue(tenantId, monthRange),
    sumCardPaid(tenantId, monthRange),
    sumAdSpend(tenantId, monthStartStr, t),
    Customer.count({ where: { tenant_id: tenantId, visit_count: { [Op.gte]: 2 } } }),
  ]);

  const totalCustomersWithVisit = await Customer.count({
    where: { tenant_id: tenantId, visit_count: { [Op.gte]: 1 } },
  });

  const monthIncome = money(monthRevenue + monthCardPaid);

  return {
    date: t,
    today: {
      new_customers: todayNewCustomers,
      appointments: todayBooked,
      arrived: todayArrived,
      arrival_rate: pct(todayArrived, todayBooked),
      revenue: money(todayRevenue + todayCardPaid),
    },
    month: {
      new_customers: monthNewCustomers,
      arrived: monthArrived,
      income: monthIncome,
      ad_spend: monthSpend,
      // 无广告消耗数据时不编造 CAC / ROI
      cac: monthSpend > 0 && monthNewCustomers > 0 ? money(monthSpend / monthNewCustomers) : null,
      roi: monthSpend > 0 ? Math.round((monthIncome / monthSpend) * 100) / 100 : null,
      repurchase_rate: pct(monthRepeatVisitors, totalCustomersWithVisit),
    },
  };
}

/**
 * 近 N 天趋势：新增客户、到店、收入。
 */
export async function getTrends(tenantId, days = 30) {
  const n = Math.min(90, Math.max(7, Number(days) || 30));
  const startStr = dayjs().tz(TZ).subtract(n - 1, 'day').format('YYYY-MM-DD');
  const start = dayjs.tz(startStr, TZ).startOf('day').toDate();
  const end = dayjs().tz(TZ).endOf('day').toDate();

  const [customerRows, arrivalRows, orderRows] = await Promise.all([
    Customer.findAll({
      attributes: [[fn('DATE', col('created_at')), 'd'], [fn('COUNT', col('id')), 'c']],
      where: { tenant_id: tenantId, created_at: { [Op.between]: [start, end] } },
      group: [fn('DATE', col('created_at'))],
      raw: true,
    }),
    Appointment.findAll({
      attributes: [[fn('DATE', col('start_at')), 'd'], [fn('COUNT', col('id')), 'c']],
      where: {
        tenant_id: tenantId,
        status: { [Op.in]: ARRIVED_STATUSES },
        start_at: { [Op.between]: [start, end] },
      },
      group: [fn('DATE', col('start_at'))],
      raw: true,
    }),
    CustomerOrder.findAll({
      attributes: [[fn('DATE', col('paid_at')), 'd'], [fn('SUM', col('amount')), 's']],
      where: {
        tenant_id: tenantId,
        status: { [Op.in]: REVENUE_ORDER_STATUSES },
        paid_at: { [Op.between]: [start, end] },
      },
      group: [fn('DATE', col('paid_at'))],
      raw: true,
    }),
  ]);

  const toMap = (rows, key) =>
    new Map(rows.map((r) => [dayjs(r.d).format('YYYY-MM-DD'), Number(r[key]) || 0]));
  const custMap = toMap(customerRows, 'c');
  const arrMap = toMap(arrivalRows, 'c');
  const revMap = toMap(orderRows, 's');

  const series = [];
  for (let i = 0; i < n; i += 1) {
    const d = dayjs().tz(TZ).subtract(n - 1 - i, 'day').format('YYYY-MM-DD');
    series.push({
      date: d,
      new_customers: custMap.get(d) || 0,
      arrived: arrMap.get(d) || 0,
      revenue: money(revMap.get(d) || 0),
    });
  }

  return { days: n, series };
}

/**
 * 今日建议：全部由本店真实数据的规则推导，每条都能点进对应页面。
 * 不调用外部数据，也不生成无依据的市场判断。
 */
export async function getSuggestions(tenantId) {
  const now = new Date();
  const suggestions = [];

  const [lowTimesCount, expiringCount, sleepingCount, todayBookedCount, yesterdayNoShow, unContactedLeads] =
    await Promise.all([
      CustomerCard.count({
        where: {
          tenant_id: tenantId,
          status: 'active',
          card_type: 'times',
          remaining_times: { [Op.lte]: 2, [Op.gt]: 0 },
        },
      }),
      CustomerCard.count({
        where: {
          tenant_id: tenantId,
          status: 'active',
          valid_until: {
            [Op.ne]: null,
            [Op.gte]: dayjs().tz(TZ).format('YYYY-MM-DD'),
            [Op.lte]: dayjs().tz(TZ).add(30, 'day').format('YYYY-MM-DD'),
          },
        },
      }),
      Customer.count({
        where: {
          tenant_id: tenantId,
          last_visit_at: { [Op.ne]: null, [Op.lte]: dayjs().tz(TZ).subtract(60, 'day').toDate() },
          [Op.or]: [{ next_appointment_at: null }, { next_appointment_at: { [Op.lt]: now } }],
        },
      }),
      countAppointments(tenantId, dayRange(today()), ['booked']),
      Appointment.count({
        where: {
          tenant_id: tenantId,
          status: 'no_show',
          start_at: {
            [Op.between]: [
              dayjs().tz(TZ).subtract(1, 'day').startOf('day').toDate(),
              dayjs().tz(TZ).subtract(1, 'day').endOf('day').toDate(),
            ],
          },
        },
      }),
      Customer.count({
        where: {
          tenant_id: tenantId,
          stage: 'new',
          last_contact_at: null,
          created_at: { [Op.lte]: dayjs().tz(TZ).subtract(1, 'day').toDate() },
        },
      }),
    ]);

  if (lowTimesCount > 0) {
    suggestions.push({
      key: 'card_times_low',
      priority: 'high',
      title: `${lowTimesCount} 位客户疗程剩 2 次以内`,
      detail: '这是续卡成功率最高的时机，建议今天优先联系。',
      action_label: '去复购提醒台',
      action_to: '/app/cards/alerts',
    });
  }

  if (todayBookedCount > 0) {
    suggestions.push({
      key: 'today_booked',
      priority: 'high',
      title: `今天有 ${todayBookedCount} 位客户待到店`,
      detail: '提前一小时提醒可以明显降低爽约率。',
      action_label: '查看今日到店',
      action_to: '/app/appointments/today',
    });
  }

  if (yesterdayNoShow > 0) {
    suggestions.push({
      key: 'yesterday_no_show',
      priority: 'high',
      title: `昨天有 ${yesterdayNoShow} 位客户爽约`,
      detail: '24 小时内二次邀约的挽回成功率最高。',
      action_label: '查看预约档期',
      action_to: '/app/appointments',
    });
  }

  if (expiringCount > 0) {
    suggestions.push({
      key: 'card_expiring',
      priority: 'medium',
      title: `${expiringCount} 张卡将在 30 天内到期`,
      detail: '过期作废前联系客户，既能促成到店也能减少纠纷。',
      action_label: '去复购提醒台',
      action_to: '/app/cards/alerts',
    });
  }

  if (unContactedLeads > 0) {
    suggestions.push({
      key: 'lead_untouched',
      priority: 'medium',
      title: `${unContactedLeads} 条线索超过一天没有联系`,
      detail: '线索的转化率随时间快速衰减，建议今天清空。',
      action_label: '查看客户',
      action_to: '/app/customers?stage=new',
    });
  }

  if (sleepingCount > 0) {
    suggestions.push({
      key: 'customer_sleeping',
      priority: 'low',
      title: `${sleepingCount} 位客户超过 60 天没到店`,
      detail: '可以配一条自动唤醒流程，让系统每天替你跟进。',
      action_label: '去复购提醒台',
      action_to: '/app/cards/alerts',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => order[a.priority] - order[b.priority]);

  return { generated_at: now, suggestions: suggestions.slice(0, 5) };
}
