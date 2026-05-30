/**
 * @file 工单 SLA：逾期提醒负责人，超时升级通知管理员。
 */
import { Op } from 'sequelize';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import {
  ServiceTicket,
  User,
  Customer,
  Tenant,
  Role,
  AutomationLog,
} from '../models/index.js';
import { env } from '../config/env.js';
import { sendAgentTextMessage } from './wework.service.js';
import { normalizePermissionCodes, isAdmin } from '../utils/permissions.js';
import { TICKET_OPEN_STATUSES, slaMinutesForPriority, enrichTicketSla } from '../utils/ticketSla.util.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TRIGGER_REMINDER = 'ticket_sla_reminder';
const TRIGGER_ESCALATION = 'ticket_sla_escalation';

function escalateGraceMinutes() {
  return Math.max(15, Number(env.ticketSlaEscalateMinutes) || 60);
}

function shanghaiDayStart() {
  return dayjs().tz('Asia/Shanghai').startOf('day').toDate();
}

/**
 * @param {number} tenantId
 * @param {number} customerId
 * @param {number} ticketId
 * @param {string} trigger
 */
async function alreadyNotifiedToday(tenantId, customerId, ticketId, trigger) {
  const rows = await AutomationLog.findAll({
    where: {
      tenant_id: tenantId,
      customer_id: customerId,
      trigger_type: trigger,
      status: 'success',
      executed_at: { [Op.gte]: shanghaiDayStart() },
    },
    attributes: ['id', 'detail_json'],
    limit: 20,
  });
  return rows.some((r) => Number(r.detail_json?.ticket_id) === ticketId);
}

/**
 * @param {import('../models/role.model.js').Role | null | undefined} role
 */
function isAdminRole(role) {
  if (!role) return false;
  if (role.name === '管理员' || role.name === 'admin') return true;
  const perms = normalizePermissionCodes(role.permissions || role.perm_codes || []);
  return perms.includes('*') || perms.includes('settings:manage');
}

/**
 * @param {number} tenantId
 */
async function findTenantAdmins(tenantId) {
  const users = await User.findAll({
    where: { tenant_id: tenantId, status: 1 },
    attributes: ['id', 'username', 'real_name', 'wework_userid'],
    include: [{ model: Role, attributes: ['name', 'permissions', 'perm_codes'] }],
  });
  return users.filter((u) => isAdminRole(u.Role) && String(u.wework_userid || '').trim());
}

/**
 * @param {number} [limitPerRun]
 */
export async function runTicketSlaReminderOnce(limitPerRun = 20) {
  const now = new Date();
  const escalateCutoff = new Date(now.getTime() - escalateGraceMinutes() * 60 * 1000);

  const tickets = await ServiceTicket.findAll({
    where: {
      status: { [Op.in]: TICKET_OPEN_STATUSES },
      due_at: { [Op.ne]: null, [Op.lte]: now },
    },
    order: [['due_at', 'ASC']],
    limit: Math.min(100, limitPerRun * 4),
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone'] },
      { model: User, as: 'owner', attributes: ['id', 'wework_userid', 'real_name', 'username'] },
    ],
  });

  let scanned = 0;
  let ownerNotified = 0;
  let escalated = 0;
  let skipped = 0;

  for (const ticket of tickets) {
    if (ownerNotified + escalated >= limitPerRun) break;
    scanned += 1;

    const tenantId = Number(ticket.tenant_id);
    const ticketId = Number(ticket.id);
    const dueAt = new Date(ticket.due_at);
    const overdueMins = Math.max(0, Math.round((now.getTime() - dueAt.getTime()) / 60000));

    const tenant = await Tenant.findByPk(tenantId, {
      attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id'],
    });
    if (!tenant?.wework_corp_id || !tenant?.wework_secret) {
      skipped += 1;
      continue;
    }

    const cust = ticket.Customer;
    const custLabel =
      cust?.name || cust?.nickname || cust?.phone || `客户#${ticket.customer_id}`;
    const detailUrl = `${env.appUrl.replace(/\/$/, '')}/app/service-desk/tickets/${ticketId}`;

    const shouldEscalate =
      !ticket.sla_escalated_at && dueAt <= escalateCutoff;

    if (shouldEscalate) {
      const admins = await findTenantAdmins(tenantId);
      if (!admins.length) {
        skipped += 1;
        continue;
      }
      if (await alreadyNotifiedToday(tenantId, ticket.customer_id, ticketId, TRIGGER_ESCALATION)) {
        skipped += 1;
        continue;
      }

      const ownerLabel =
        ticket.owner?.real_name || ticket.owner?.username || `用户#${ticket.owner_id || '?'}`;
      const content = [
        '【工单升级】SLA 已严重逾期',
        `工单：${ticket.title}`,
        `客户：${custLabel}`,
        `负责人：${ownerLabel}`,
        `优先级：${ticket.priority}（SLA ${slaMinutesForPriority(ticket.priority)} 分钟）`,
        `已逾期 ${overdueMins} 分钟`,
        `请介入：${detailUrl}`,
      ].join('\n');

      const touser = admins.map((a) => a.wework_userid).join('|');
      try {
        await sendAgentTextMessage(tenant, { touser, content });
        await ticket.update({ sla_escalated_at: now });
        await AutomationLog.create({
          tenant_id: tenantId,
          customer_id: ticket.customer_id,
          rule_id: null,
          trigger_type: TRIGGER_ESCALATION,
          action_taken: 'notify_admin_wework',
          status: 'success',
          message_preview: content.slice(0, 500),
          detail_json: { ticket_id: ticketId, overdue_minutes: overdueMins },
          executed_at: now,
        });
        escalated += 1;
      } catch (e) {
        await AutomationLog.create({
          tenant_id: tenantId,
          customer_id: ticket.customer_id,
          rule_id: null,
          trigger_type: TRIGGER_ESCALATION,
          action_taken: 'notify_admin_wework',
          status: 'failed',
          message_preview: String(e?.message || e).slice(0, 500),
          detail_json: { ticket_id: ticketId },
          executed_at: now,
        });
        console.error('[ticket-sla] escalation failed', ticketId, e?.message || e);
        skipped += 1;
      }
      continue;
    }

    const weworkUserid = String(ticket.owner?.wework_userid || '').trim();
    if (!weworkUserid) {
      skipped += 1;
      continue;
    }
    if (await alreadyNotifiedToday(tenantId, ticket.customer_id, ticketId, TRIGGER_REMINDER)) {
      skipped += 1;
      continue;
    }

    const content = [
      '【工单 SLA】处理已逾期',
      `工单：${ticket.title}`,
      `客户：${custLabel}`,
      `优先级：${ticket.priority}`,
      `应完成：${dueAt.toLocaleString('zh-CN', { hour12: false })}`,
      `已逾期 ${overdueMins} 分钟`,
      `请尽快处理：${detailUrl}`,
    ].join('\n');

    try {
      await sendAgentTextMessage(tenant, { touser: weworkUserid, content });
      await AutomationLog.create({
        tenant_id: tenantId,
        customer_id: ticket.customer_id,
        rule_id: null,
        trigger_type: TRIGGER_REMINDER,
        action_taken: 'notify_owner_wework',
        status: 'success',
        message_preview: content.slice(0, 500),
        detail_json: { ticket_id: ticketId, overdue_minutes: overdueMins },
        executed_at: now,
      });
      ownerNotified += 1;
    } catch (e) {
      await AutomationLog.create({
        tenant_id: tenantId,
        customer_id: ticket.customer_id,
        rule_id: null,
        trigger_type: TRIGGER_REMINDER,
        action_taken: 'notify_owner_wework',
        status: 'failed',
        message_preview: String(e?.message || e).slice(0, 500),
        detail_json: { ticket_id: ticketId },
        executed_at: now,
      });
      console.error('[ticket-sla] reminder failed', ticketId, e?.message || e);
      skipped += 1;
    }
  }

  return { scanned, ownerNotified, escalated, skipped };
}

/**
 * @param {object} auth
 * @param {{ limit?: number }} query
 */
export async function listOverdueTicketsForTenant(auth, query = {}) {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const where = {
    tenant_id: auth.tenantId,
    status: { [Op.in]: TICKET_OPEN_STATUSES },
    due_at: { [Op.ne]: null, [Op.lte]: new Date() },
  };
  if (!isAdmin(auth)) where.owner_id = auth.userId;

  const rows = await ServiceTicket.findAll({
    where,
    limit,
    order: [['due_at', 'ASC']],
    include: [
      { model: Customer, attributes: ['id', 'name', 'nickname', 'phone'] },
      { model: User, as: 'owner', attributes: ['id', 'username', 'real_name'] },
    ],
  });

  return rows.map((r) => enrichTicketSla(r.get({ plain: true })));
}

/**
 * @param {object} auth
 */
export async function countOverdueTicketsForTenant(auth) {
  const where = {
    tenant_id: auth.tenantId,
    status: { [Op.in]: TICKET_OPEN_STATUSES },
    due_at: { [Op.ne]: null, [Op.lte]: new Date() },
  };
  if (!isAdmin(auth)) where.owner_id = auth.userId;
  return ServiceTicket.count({ where });
}
