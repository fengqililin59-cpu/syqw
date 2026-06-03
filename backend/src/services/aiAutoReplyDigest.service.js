/**
 * @file 每日 18:00 向租户管理员企微推送「今日 AI 自动回复」摘要。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op } from 'sequelize';
import { Tenant, User, AutomationLog, AiReplyLog } from '../models/index.js';
import { env } from '../config/env.js';
import { sendAgentTextMessage } from './wework.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';
const TRIGGER = 'ai_auto_reply_evening_digest';

function todayRange() {
  const start = dayjs().tz(TZ).startOf('day').toDate();
  const end = dayjs().tz(TZ).endOf('day').toDate();
  return { start, end };
}

/**
 * @param {number} tenantId
 */
export async function getTodayAiAutoReplyStats(tenantId) {
  const { start, end } = todayRange();
  const baseWhere = {
    tenant_id: Number(tenantId),
    status: 'approved',
    approved_by: null,
    created_at: { [Op.gte]: start, [Op.lte]: end },
  };

  const [auto_sent_count, threads_count, faq_count, pricing_count] = await Promise.all([
    AiReplyLog.count({ where: baseWhere }),
    AiReplyLog.count({ where: baseWhere, distinct: true, col: 'thread_id' }),
    AiReplyLog.count({ where: { ...baseWhere, risk_level: 'p0' } }),
    AiReplyLog.count({ where: { ...baseWhere, risk_level: 'p1' } }),
  ]);

  return {
    auto_sent_count,
    threads_count,
    faq_count,
    pricing_count,
  };
}

export function formatAiAutoReplyDigestMessage(tenantName, stats) {
  const base = String(env.appUrl || '').replace(/\/$/, '');
  const d = dayjs().tz(TZ);
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.day()];

  const lines = [
    `【ZhiFlow AI 自动回复日报】${tenantName || ''}`.trim(),
    `${d.format('YYYY-MM-DD')} 周${wd}`,
    '',
    `今日 AI 自动发送：${stats.auto_sent_count} 条`,
    `涉及会话：${stats.threads_count} 个`,
  ];

  if (stats.faq_count > 0 || stats.pricing_count > 0) {
    lines.push(`其中 资料类 ${stats.faq_count} · 询价类 ${stats.pricing_count}`);
  }

  lines.push('');
  lines.push('建议抽查自动回复是否准确，必要时人工跟进。');
  lines.push('');
  lines.push(`质检复盘：${base}/app/ai-review?tab=auto_sent`);
  lines.push(`收件箱筛选：${base}/app/inbox?filter=ai_auto_sent`);
  return lines.join('\n');
}

async function sentDigestToday(tenantId) {
  const todayStart = dayjs().tz(TZ).startOf('day').toDate();
  const n = await AutomationLog.count({
    where: {
      tenant_id: Number(tenantId),
      trigger_type: TRIGGER,
      status: 'success',
      executed_at: { [Op.gte]: todayStart },
    },
  });
  return n > 0;
}

async function recordDigestSent(tenantId, preview) {
  await AutomationLog.create({
    tenant_id: Number(tenantId),
    customer_id: null,
    rule_id: null,
    trigger_type: TRIGGER,
    action_taken: 'notify_wework',
    status: 'success',
    message_preview: String(preview).slice(0, 500),
    detail_json: { at: new Date().toISOString() },
    executed_at: new Date(),
  });
}

/**
 * @param {number} tenantId
 * @param {{ force?: boolean }} [options]
 */
export async function sendAiAutoReplyEveningDigestForTenant(tenantId, options = {}) {
  const force = options.force === true;
  const tid = Number(tenantId);
  const tenant = await Tenant.findByPk(tid);
  if (!tenant?.wework_corp_id || !tenant?.wework_secret) {
    return { sent: 0, skipped: 'no_wework' };
  }

  if (!force && (await sentDigestToday(tid))) {
    return { sent: 0, skipped: 'already_sent_today' };
  }

  const stats = await getTodayAiAutoReplyStats(tid);
  if (stats.auto_sent_count <= 0 && !force) {
    return { sent: 0, skipped: 'no_auto_sent_today', ...stats };
  }

  const content = formatAiAutoReplyDigestMessage(tenant.name, stats);
  const admins = await User.findAll({
    where: { tenant_id: tid, status: 1, role: 'admin' },
    attributes: ['id', 'wework_userid'],
  });

  let sent = 0;
  for (const u of admins) {
    const touser = u.wework_userid ? String(u.wework_userid).trim() : '';
    if (!touser) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendAgentTextMessage(tenant, { touser, content });
      sent += 1;
    } catch (e) {
      console.error('[aiAutoReplyDigest] send failed', tid, u.id, e);
    }
  }

  if (sent > 0) {
    await recordDigestSent(tid, content);
  }

  return { sent, ...stats };
}

export async function sendAiAutoReplyEveningDigestAllTenants() {
  const tenants = await Tenant.findAll({
    where: {
      status: 1,
      wework_corp_id: { [Op.ne]: null },
      wework_secret: { [Op.ne]: null },
    },
    attributes: ['id'],
  });

  let messages = 0;
  let tenantsNotified = 0;
  let skipped = 0;

  for (const t of tenants) {
    // eslint-disable-next-line no-await-in-loop
    const r = await sendAiAutoReplyEveningDigestForTenant(Number(t.id));
    if (r.sent > 0) {
      messages += r.sent;
      tenantsNotified += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    tenants: tenants.length,
    tenants_notified: tenantsNotified,
    messages,
    skipped,
  };
}

/** 管理员手动试发（含今日 0 条时也推送说明） */
export async function pushAiAutoReplyDigestToWework(auth) {
  return sendAiAutoReplyEveningDigestForTenant(auth.tenantId, { force: true });
}
