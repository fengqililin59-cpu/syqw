/**
 * @file 仪表盘「今日必做」：聚合待跟进、收件箱 SLA、意向升温等可执行项。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op } from 'sequelize';
import { Customer, CustomerFollowUp, IntentAlert } from '../models/index.js';
import { customerWhereScope, isAdmin } from '../utils/permissions.js';
import { countOverdueTicketsForTenant } from './ticketSlaReminder.service.js';
import { getInboxSlaBatchSummary } from './inboxSlaBatch.service.js';
import { getChurnRiskSummary } from './churnRisk.service.js';
import * as billingService from './billing.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';
const PRIORITY_RANK = { critical: 0, high: 1, normal: 2 };

/**
 * @param {import('../middlewares/auth.js').AuthContext} auth
 */
export async function getTodayActions(auth) {
  const items = [];
  const cWhere = await customerWhereScope(auth);
  const todayCutoff = dayjs().tz(TZ).endOf('day').toDate();

  const pendingFollowup = await CustomerFollowUp.count({
    distinct: true,
    col: 'customer_id',
    where: {
      next_follow_at: { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: todayCutoff }] },
    },
    include: [{ model: Customer, required: true, where: cWhere, attributes: [] }],
  });

  if (pendingFollowup > 0) {
    items.push({
      key: 'pending_followup',
      priority: 'critical',
      title: `待跟进客户 ${pendingFollowup} 位`,
      description: '计划跟进日已到，今日优先联系可提升成交率',
      count: pendingFollowup,
      link: '/app/follow-ups?overdue=1',
      cta: '去处理',
    });
  }

  try {
    const sla = await getInboxSlaBatchSummary(auth);
    if (sla.sla_overdue_active > 0) {
      items.push({
        key: 'inbox_sla',
        priority: 'critical',
        title: `收件箱超时 ${sla.sla_overdue_active} 条`,
        description: `超过 ${sla.sla_minutes} 分钟未回复，客户体验与转化都会受影响`,
        count: sla.sla_overdue_active,
        link: '/app/inbox?filter=sla_overdue',
        cta: '批量处理',
      });
    }
  } catch {
    /* 无收件箱权限或模块未启用时忽略 */
  }

  const overdueTickets = await countOverdueTicketsForTenant(auth).catch(() => 0);
  if (overdueTickets > 0) {
    items.push({
      key: 'ticket_sla',
      priority: 'high',
      title: `工单 SLA 超时 ${overdueTickets} 条`,
      description: '服务承诺已逾期，请尽快处理避免客诉',
      count: overdueTickets,
      link: '/app/service-desk?sla=overdue',
      cta: '查看工单',
    });
  }

  const since48h = dayjs().subtract(48, 'hour').toDate();
  const recentIntent = await IntentAlert.count({
    where: { tenant_id: auth.tenantId, created_at: { [Op.gte]: since48h } },
  });
  if (recentIntent > 0) {
    items.push({
      key: 'intent_alerts',
      priority: 'high',
      title: `意向升温 ${recentIntent} 条`,
      description: '近 48 小时意向分显著上升，建议优先跟进并复用 AI 话术',
      count: recentIntent,
      link: '/app/intent-alerts',
      cta: '查看预警',
    });
  }

  if (isAdmin(auth)) {
    const churn = await getChurnRiskSummary(auth.tenantId);
    if (churn.level !== 'ok' && churn.risks.length) {
      const top = churn.risks[0];
      items.push({
        key: 'churn_risk',
        priority: churn.level === 'critical' ? 'critical' : 'high',
        title: top.title,
        description: top.detail,
        link: top.action_path || '/app',
        cta: '去处理',
      });
    }

    const billing = await billingService.getSubscription(auth.tenantId);
    const days = billing.days_remaining;
    const planCode = billing.plan?.code;
    if (
      planCode &&
      planCode !== 'free' &&
      days != null &&
      days >= 0 &&
      days <= 7
    ) {
      items.push({
        key: 'subscription_expiring',
        priority: days <= 3 ? 'critical' : 'high',
        title: days === 0 ? '套餐今日到期' : `套餐剩余 ${days} 天`,
        description: '续费后可继续使用专业版配额与 AI 能力',
        count: days,
        link: '/app/billing',
        cta: '去续费',
      });
    }
  }

  items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  return {
    items,
    total: items.length,
    critical_count: items.filter((i) => i.priority === 'critical').length,
    generated_at: new Date().toISOString(),
    headline:
      items.length === 0
        ? '今日暂无紧急待办，可查看本周战果或主动跟进 3 位客户'
        : `你有 ${items.length} 项建议今日处理${items.filter((i) => i.priority === 'critical').length ? `（${items.filter((i) => i.priority === 'critical').length} 项紧急）` : ''}`,
  };
}
