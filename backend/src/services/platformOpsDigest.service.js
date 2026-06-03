/**
 * @file 平台运营每日摘要（企微推送给 PLATFORM_ADMIN_USER_IDS）。
 */
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { User, Tenant } from '../models/index.js';
import { sendAgentTextMessage } from './wework.service.js';
import { isSmtpConfigured, sendMail } from './mail.service.js';
import {
  getOverview,
  listChurnRiskTenants,
  listExpiringSubscriptions,
} from './platformAdmin.service.js';
import { listDueOpsFollowups } from './tenantPlatformOps.service.js';
import { formatMrrMomDigestLine, getMrrMonthOverMonth } from './platformMrrSnapshot.service.js';
import { listInboxAiAnomalyTenants } from './platformInboxAiAnomaly.service.js';

function appBase() {
  return String(env.appUrl || '').replace(/\/$/, '');
}

export async function buildPlatformOpsDigest() {
  const [overview, churn, followups, expiring, mrrMom, aiAnomalies] = await Promise.all([
    getOverview(),
    listChurnRiskTenants({ limit: 100 }),
    listDueOpsFollowups({ scope: 'due', limit: 20 }),
    listExpiringSubscriptions({ days: 14, limit: 100 }),
    getMrrMonthOverMonth(),
    listInboxAiAnomalyTenants({ limit: 20, days: 7 }),
  ]);

  const criticalChurn = churn.list.filter((t) => t.level === 'critical');
  const warnChurn = churn.list.filter((t) => t.level === 'warn');
  const criticalExpiring = expiring.list.filter((t) => t.urgency === 'critical');
  const warnExpiring = expiring.list.filter((t) => t.urgency === 'warn');
  const overdueFollow = followups.list.filter((f) => f.due_status === 'overdue');
  const todayFollow = followups.list.filter((f) => f.due_status === 'today');
  const criticalAi = aiAnomalies.list.filter((t) => t.level === 'critical');
  const warnAi = aiAnomalies.list.filter((t) => t.level === 'warn');

  const lines = [
    `【ZhiFlow 平台运营日报】${dayjs().format('YYYY-MM-DD')}`,
    '',
    '📊 全站概览',
    `· 注册企业：${overview.tenants_total}`,
    `· 付费使用中：${overview.subscription.paid_active} · 试用中：${overview.subscription.trialing}`,
    `· 待确认收款：${overview.pending_payments.count} 笔（¥${overview.pending_payments.amount}）`,
    `· 待处理开票：${overview.pending_invoice_requests ?? 0} 笔`,
    `· 估算 MRR：${formatMrrMomDigestLine(mrrMom)}`,
    '',
    '📅 即将到期（14 天内）',
    `· 付费/试用将到期：${expiring.total} 家（≤3 天 ${criticalExpiring.length} · ≤7 天 ${warnExpiring.length}）`,
    '',
    '⚠️ 流失风险',
    `· 风险租户：${churn.total}（严重 ${criticalChurn.length} · 关注 ${warnChurn.length}）`,
  ];

  if (aiAnomalies.total > 0) {
    lines.push('');
    lines.push('🤖 AI 自动发异常');
    lines.push(
      `· 异常租户：${aiAnomalies.total}（严重 ${criticalAi.length} · 关注 ${warnAi.length}）`,
    );
    const aiHighlight = [...criticalAi, ...warnAi].slice(0, 5);
    if (aiHighlight.length > 0) {
      aiHighlight.forEach((t) => {
        const tags = t.reasons.map((r) => r.title).join('、');
        lines.push(`  - ${t.tenant_name} (#${t.tenant_id})：${tags}`);
      });
      if (aiAnomalies.total > aiHighlight.length) {
        lines.push(`  …等 ${aiAnomalies.total} 家`);
      }
    }
  }

  if (criticalChurn.length > 0) {
    lines.push('· 严重：');
    criticalChurn.slice(0, 5).forEach((t) => {
      lines.push(`  - ${t.tenant_name} (#${t.tenant_id})`);
    });
    if (criticalChurn.length > 5) lines.push(`  …等 ${criticalChurn.length} 家`);
  }

  const expiringHighlight = [...criticalExpiring, ...warnExpiring].slice(0, 5);
  if (expiringHighlight.length > 0) {
    lines.push('');
    lines.push('· 优先续费：');
    expiringHighlight.forEach((t) => {
      const d =
        t.days_remaining < 0
          ? `已过期 ${Math.abs(t.days_remaining)} 天`
          : `剩余 ${t.days_remaining} 天`;
      lines.push(`  - ${t.tenant_name}（${t.plan_name}，${d}）`);
    });
    if (expiring.total > expiringHighlight.length) {
      lines.push(`  …等 ${expiring.total} 家`);
    }
  }

  lines.push('');
  lines.push('📞 待平台回访');
  lines.push(
    `· 待处理：${followups.counts.due}（逾期 ${followups.counts.overdue} · 今日 ${followups.counts.today}）`,
  );
  if (overdueFollow.length > 0) {
    overdueFollow.slice(0, 3).forEach((f) => {
      const snippet =
        f.content.length > 40 ? `${f.content.slice(0, 40)}…` : f.content;
      lines.push(`  - ${f.tenant_name}：${snippet}`);
    });
  }

  const base = appBase();
  lines.push('');
  lines.push('🔗 快捷入口');
  lines.push(`运营后台：${base}/app/platform`);
  lines.push(`即将到期：${base}/app/platform/subscriptions/expiring`);
  lines.push(`流失风险：${base}/app/platform/churn-risks`);
  if (aiAnomalies.total > 0) {
    lines.push(`AI 自动发异常：${base}/app/platform/inbox-ai-anomalies`);
  }
  lines.push(`待回访：${base}/app/platform/ops-followups`);
  lines.push(`订单确认：${base}/app/platform/billing`);

  const message = lines.join('\n');

  return {
    message,
    stats: {
      tenants_total: overview.tenants_total,
      pending_payments: overview.pending_payments.count,
      churn_total: churn.total,
      churn_critical: criticalChurn.length,
      expiring_total: expiring.total,
      expiring_critical: criticalExpiring.length,
      pending_invoices: overview.pending_invoice_requests ?? 0,
      followups_due: followups.counts.due,
      followups_overdue: followups.counts.overdue,
      inbox_ai_anomaly_total: aiAnomalies.total,
      inbox_ai_anomaly_critical: criticalAi.length,
      inbox_ai_anomaly_warn: warnAi.length,
      mrr_current: mrrMom.current_mrr,
      mrr_previous: mrrMom.previous_mrr,
      mrr_delta_pct: mrrMom.delta_pct,
      mrr_mom_label: formatMrrMomDigestLine(mrrMom),
    },
    mrr_mom: mrrMom,
  };
}

async function resolveDigestSenderTenant() {
  const configured = env.platformDigest.tenantId;
  if (configured) {
    const t = await Tenant.findByPk(configured);
    if (t?.wework_corp_id && t?.wework_secret) return t;
  }

  const adminIds = env.platformAdminUserIds;
  for (const uid of adminIds) {
    // eslint-disable-next-line no-await-in-loop
    const user = await User.findByPk(uid, { attributes: ['id', 'tenant_id'] });
    if (!user?.tenant_id) continue;
    // eslint-disable-next-line no-await-in-loop
    const t = await Tenant.findByPk(user.tenant_id);
    if (t?.wework_corp_id && t?.wework_secret) return t;
  }
  return null;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const DELIVERY_LABELS = {
  both: '企微 + 邮件',
  email_only: '仅邮件',
  wework_only: '仅企微',
};

function normalizeChannels(channels) {
  const v = String(channels || '').trim().toLowerCase();
  if (v === 'email' || v === 'email_only') return 'email_only';
  if (v === 'wework' || v === 'wework_only') return 'wework_only';
  if (v === 'both') return 'both';
  return null;
}

/** @param {{ channels?: string, cron?: boolean }} options */
export function resolveDigestDelivery(options = {}) {
  const mode = normalizeChannels(options.channels) || env.platformDigest.delivery;
  let sendWework = mode === 'both' || mode === 'wework_only';
  let sendEmail = mode === 'both' || mode === 'email_only';

  if (options.cron) {
    if (mode === 'email_only') {
      sendWework = false;
      sendEmail = env.platformDigest.emailOnCron;
    } else if (mode === 'wework_only') {
      sendWework = true;
      sendEmail = false;
    } else {
      sendWework = true;
      sendEmail = env.platformDigest.emailOnCron;
    }
  }

  return { mode, sendWework, sendEmail, mode_label: DELIVERY_LABELS[mode] || mode };
}

function buildDigestHtml(message, appUrl, stats = {}) {
  const base = appUrl.replace(/\/$/, '');
  const body = escapeHtml(message).replace(/\n/g, '<br/>');
  const mrrKpi =
    stats.mrr_mom_label != null
      ? String(stats.mrr_mom_label)
      : stats.mrr_current != null
        ? `¥${stats.mrr_current}`
        : '—';
  const mrrPctKpi =
    stats.mrr_delta_pct != null
      ? `${stats.mrr_delta_pct > 0 ? '+' : ''}${stats.mrr_delta_pct}%`
      : '—';

  const kpi = [
    ['估算 MRR', mrrKpi],
    ['MRR 环比', mrrPctKpi],
    ['待确认收款', stats.pending_payments ?? '—'],
    ['待处理开票', stats.pending_invoices ?? '—'],
    ['14 天内到期', stats.expiring_total ?? '—'],
    ['≤3 天到期', stats.expiring_critical ?? '—'],
    ['流失风险租户', stats.churn_total ?? '—'],
    ['严重流失', stats.churn_critical ?? '—'],
    ['AI 自动发异常', stats.inbox_ai_anomaly_total ?? '—'],
    ['AI 异常·严重', stats.inbox_ai_anomaly_critical ?? '—'],
    ['待回访', stats.followups_due ?? '—'],
    ['回访逾期', stats.followups_overdue ?? '—'],
  ];
  const kpiRows = kpi
    .map(
      ([label, val]) =>
        `<td style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:13px">${escapeHtml(label)}</td>` +
        `<td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:600;font-size:13px">${escapeHtml(val)}</td>`,
    )
    .join('</tr><tr>');

  return `<!DOCTYPE html><html lang="zh-CN"><body style="font-family:PingFang SC,Microsoft YaHei,sans-serif;font-size:14px;color:#0f172a;line-height:1.6;max-width:640px;margin:0 auto;padding:16px">
<h2 style="margin:0 0 12px;font-size:18px">ZhiFlow 平台运营日报</h2>
<table style="border-collapse:collapse;width:100%;margin-bottom:16px"><tr>${kpiRows}</tr></table>
<div style="background:#f8fafc;border-radius:8px;padding:12px 14px;font-size:13px">${body}</div>
<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>
<p style="font-size:13px"><a href="${base}/app/platform">运营后台</a> ·
<a href="${base}/app/platform/subscriptions/expiring">即将到期</a> ·
<a href="${base}/app/platform/churn-risks">流失风险</a> ·
<a href="${base}/app/platform/inbox-ai-anomalies">AI 自动发异常</a> ·
<a href="${base}/app/platform/ops-followups">待回访</a> ·
<a href="${base}/app/platform/billing">订单确认</a></p>
<p style="font-size:11px;color:#64748b">本邮件由 ZhiFlow 平台定时任务发送，请勿直接回复。</p>
</body></html>`;
}

export async function resolveDigestEmailRecipients() {
  const set = new Set(env.platformDigest.emails);
  const adminIds = env.platformAdminUserIds;
  if (adminIds.length) {
    const admins = await User.findAll({
      where: { id: adminIds },
      attributes: ['email'],
    });
    for (const u of admins) {
      const e = u.email ? String(u.email).trim().toLowerCase() : '';
      if (e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) set.add(e);
    }
  }
  return [...set];
}

/** 邮件发送运营日报（SMTP 与注册验证码共用配置） */
export async function sendPlatformOpsDigestEmails() {
  if (!isSmtpConfigured()) {
    return { sent: 0, skipped: 'smtp_not_configured' };
  }
  const recipients = await resolveDigestEmailRecipients();
  if (!recipients.length) {
    return { sent: 0, skipped: 'no_email_recipients' };
  }

  const { message, stats } = await buildPlatformOpsDigest();
  const appUrl = appBase();
  const subject = `ZhiFlow 平台运营日报 ${dayjs().format('YYYY-MM-DD')}`;
  const html = buildDigestHtml(message, appUrl, stats);
  const targets = [];

  for (const to of recipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({ to, subject, text: message, html });
      targets.push({ email: to, sent: true });
    } catch (e) {
      console.error('[platformDigest] email failed', to, e);
      targets.push({ email: to, sent: false, reason: e?.message || 'send_failed' });
    }
  }

  return {
    sent: targets.filter((t) => t.sent).length,
    targets,
  };
}

/**
 * 向平台超管推送企微摘要。
 */
export async function sendPlatformOpsDigestWework() {
  const adminIds = env.platformAdminUserIds;
  if (!adminIds.length) {
    return { sent: 0, skipped: 'no_platform_admin_configured' };
  }

  const senderTenant = await resolveDigestSenderTenant();
  if (!senderTenant) {
    return { sent: 0, skipped: 'no_wework_tenant_for_digest' };
  }

  const { message, stats } = await buildPlatformOpsDigest();
  const targets = [];

  for (const uid of adminIds) {
    // eslint-disable-next-line no-await-in-loop
    const user = await User.findByPk(uid, {
      attributes: ['id', 'username', 'real_name', 'wework_userid', 'tenant_id'],
    });
    if (!user) continue;
    const touser = user.wework_userid ? String(user.wework_userid).trim() : '';
    if (!touser) {
      targets.push({ user_id: uid, sent: false, reason: 'no_wework_userid' });
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendAgentTextMessage(senderTenant, { touser, content: message });
      targets.push({
        user_id: uid,
        username: user.username,
        sent: true,
      });
    } catch (e) {
      console.error('[platformDigest] send failed', uid, e);
      targets.push({
        user_id: uid,
        username: user.username,
        sent: false,
        reason: e?.message || 'send_failed',
      });
    }
  }

  const sent = targets.filter((t) => t.sent).length;
  return { sent, targets, stats, sender_tenant_id: senderTenant.id };
}

/**
 * 发送运营日报。
 * @param {{ channels?: 'both'|'email'|'wework'|'email_only'|'wework_only', forceEmail?: boolean, cron?: boolean }} options
 */
export async function sendPlatformOpsDigest(options = {}) {
  const { sendWework, sendEmail, mode, mode_label } = resolveDigestDelivery(options);

  const wework = sendWework
    ? await sendPlatformOpsDigestWework()
    : { sent: 0, skipped: 'delivery_disabled' };
  const email =
    sendEmail && (options.forceEmail || isSmtpConfigured())
      ? await sendPlatformOpsDigestEmails()
      : { sent: 0, skipped: sendEmail ? 'smtp_not_configured' : 'delivery_disabled' };

  return { wework, email, delivery_mode: mode, delivery_mode_label: mode_label };
}

/** 定时任务：由 PLATFORM_OPS_DIGEST_DELIVERY 与 EMAIL_ON_CRON 控制渠道 */
export async function sendPlatformOpsDigestCron() {
  return sendPlatformOpsDigest({ cron: true });
}

export async function getPlatformOpsDigestPreview() {
  const { message, stats } = await buildPlatformOpsDigest();
  const senderTenant = await resolveDigestSenderTenant();
  const emailRecipients = await resolveDigestEmailRecipients();
  const admins = await User.findAll({
    where: { id: env.platformAdminUserIds },
    attributes: ['id', 'username', 'real_name', 'wework_userid', 'email'],
  });

  const cronPlan = resolveDigestDelivery({ cron: true });

  return {
    message,
    stats,
    delivery_mode: env.platformDigest.delivery,
    delivery_mode_label: DELIVERY_LABELS[env.platformDigest.delivery] || env.platformDigest.delivery,
    cron_delivery: {
      mode: cronPlan.mode,
      mode_label: cronPlan.mode_label,
      will_send_wework: cronPlan.sendWework,
      will_send_email: cronPlan.sendEmail,
    },
    can_send_wework: Boolean(senderTenant && admins.some((u) => u.wework_userid)),
    can_send_email: Boolean(isSmtpConfigured() && emailRecipients.length > 0),
    smtp_configured: isSmtpConfigured(),
    sender_tenant_id: senderTenant?.id ?? null,
    email_recipients: emailRecipients,
    recipients: admins.map((u) => ({
      id: u.id,
      username: u.username,
      real_name: u.real_name,
      has_wework: Boolean(u.wework_userid),
      email: u.email || null,
    })),
    /** @deprecated 使用 can_send_wework */
    can_send: Boolean(senderTenant && admins.some((u) => u.wework_userid)),
  };
}
