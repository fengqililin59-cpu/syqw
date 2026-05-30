/**
 * @file 工单 SLA：按优先级计算截止时间，列表展示状态。
 */
import { env } from '../config/env.js';

const OPEN_STATUSES = ['open', 'in_progress', 'waiting_customer'];

const DEFAULT_MINUTES = {
  urgent: 60,
  high: 240,
  normal: 1440,
  low: 4320,
};

/**
 * @param {string} priority
 */
export function slaMinutesForPriority(priority) {
  const p = String(priority || 'normal').toLowerCase();
  const envKey = `ticketSlaMinutes${p.charAt(0).toUpperCase()}${p.slice(1)}`;
  const fromEnv = Number(env[envKey]);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.max(5, fromEnv);
  return DEFAULT_MINUTES[p] ?? DEFAULT_MINUTES.normal;
}

/**
 * @param {string} priority
 * @param {Date | string} [from]
 */
export function computeTicketDueAt(priority, from = new Date()) {
  const base = from instanceof Date ? from : new Date(from);
  const mins = slaMinutesForPriority(priority);
  return new Date(base.getTime() + mins * 60 * 1000);
}

/**
 * @param {object} ticket plain ticket row
 */
export function enrichTicketSla(ticket) {
  const status = String(ticket.status || '');
  const dueAt = ticket.due_at ? new Date(ticket.due_at) : null;
  const now = Date.now();
  let sla_status = 'none';
  let sla_minutes_remaining = null;
  let sla_overdue_minutes = null;

  if (OPEN_STATUSES.includes(status) && dueAt && !Number.isNaN(dueAt.getTime())) {
    const diffMs = dueAt.getTime() - now;
    sla_minutes_remaining = Math.round(diffMs / 60000);
    if (diffMs < 0) {
      sla_status = 'overdue';
      sla_overdue_minutes = Math.max(0, Math.round(-diffMs / 60000));
    } else if (diffMs <= 60 * 60 * 1000) {
      sla_status = 'due_soon';
    } else {
      sla_status = 'on_track';
    }
    if (ticket.sla_escalated_at) sla_status = 'escalated';
  } else if (['resolved', 'closed'].includes(status)) {
    sla_status = 'closed';
  }

  return {
    ...ticket,
    sla_status,
    sla_minutes_remaining,
    sla_overdue_minutes,
    sla_minutes: slaMinutesForPriority(ticket.priority),
  };
}

export { OPEN_STATUSES as TICKET_OPEN_STATUSES };
