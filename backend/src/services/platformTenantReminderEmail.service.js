/**
 * @file 平台方向租户管理员发送到期 / 流失挽回邮件提醒。
 */
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { Role, TenantPlatformOpsNote, User } from '../models/index.js';
import { isSmtpConfigured, sendMail } from './mail.service.js';
import { getTenantDetail, listChurnRiskTenants, listExpiringSubscriptions } from './platformAdmin.service.js';
import { createTenantOpsNote } from './tenantPlatformOps.service.js';
import { resolveDigestEmailRecipients } from './platformOpsDigest.service.js';

const EMAIL_NOTE_PREFIX = {
  expiring: '【邮件提醒·到期】',
  churn: '【邮件提醒·流失】',
};

function appBase() {
  return String(env.appUrl || '').replace(/\/$/, '');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/** @param {number} tenantId */
export async function resolveTenantAdminEmails(tenantId) {
  const users = await User.findAll({
    where: { tenant_id: Number(tenantId) },
    attributes: ['id', 'email', 'role_id'],
    include: [{ model: Role, attributes: ['perm_codes'], required: false }],
  });
  const emails = new Set();
  for (const u of users) {
    const perms = Array.isArray(u.Role?.perm_codes) ? u.Role.perm_codes : [];
    if (!perms.includes('*') && !perms.includes('settings:manage')) continue;
    const e = u.email ? String(u.email).trim().toLowerCase() : '';
    if (isValidEmail(e)) emails.add(e);
  }
  return [...emails];
}

async function hasRecentReminderNote(tenantId, kind, withinDays = 7) {
  const prefix = EMAIL_NOTE_PREFIX[kind];
  const since = dayjs().subtract(withinDays, 'day').toDate();
  const row = await TenantPlatformOpsNote.findOne({
    where: {
      tenant_id: Number(tenantId),
      note_type: 'email',
      content: { [Op.like]: `${prefix}%` },
      created_at: { [Op.gte]: since },
    },
    attributes: ['id'],
  });
  return Boolean(row);
}

function buildExpiringEmail(row, billingUrl) {
  const daysLabel =
    row.days_remaining < 0
      ? `已过期 ${Math.abs(row.days_remaining)} 天`
      : `剩余 ${row.days_remaining} 天`;
  const endDate = dayjs(row.ends_at).format('YYYY年MM月DD日');
  const statusLabel = row.subscription_status === 'trialing' ? '试用' : '订阅';
  const subject = `【ZhiFlow】您的${statusLabel}即将到期（${daysLabel}）`;
  const text = [
    `您好，`,
    '',
    `您的企业「${row.tenant_name}」在 ZhiFlow 的 ${row.plan_name} ${statusLabel}将于 ${endDate} 到期（${daysLabel}）。`,
    '',
    `为避免功能受限，请尽快登录续费或联系商务：`,
    billingUrl,
    '',
    `如有疑问，欢迎回复本邮件或联系您的客户成功经理。`,
    '',
    'ZhiFlow 团队',
  ].join('\n');
  const html = `<!DOCTYPE html><html lang="zh-CN"><body style="font-family:PingFang SC,Microsoft YaHei,sans-serif;font-size:14px;line-height:1.7;color:#0f172a;max-width:560px">
<p>您好，</p>
<p>您的企业 <strong>${escapeHtml(row.tenant_name)}</strong> 在 ZhiFlow 的 <strong>${escapeHtml(row.plan_name)}</strong> ${statusLabel}将于 <strong>${endDate}</strong> 到期（${escapeHtml(daysLabel)}）。</p>
<p>请尽快登录续费，避免自动化、AI 等能力受限：</p>
<p><a href="${billingUrl}" style="color:#0369a1">打开计费中心 →</a></p>
<p style="color:#64748b;font-size:12px">本邮件由平台运营发送，请勿直接回复系统邮箱。</p>
</body></html>`;
  return { subject, text, html };
}

function buildChurnEmail(row, billingUrl) {
  const levelLabel = row.level === 'critical' ? '需尽快关注' : '建议关注';
  const risks = row.risks.map((r) => r.title).join('、');
  const subject = `【ZhiFlow】账号使用提醒（${levelLabel}）`;
  const text = [
    `您好，`,
    '',
    `我们注意到您的企业「${row.tenant_name}」近期使用情况有变化（${risks}）。`,
    `希望了解是否遇到问题，并协助您继续用好私域运营能力。`,
    '',
    `登录查看与续费：${billingUrl}`,
    '',
    'ZhiFlow 客户成功团队',
  ].join('\n');
  const html = `<!DOCTYPE html><html lang="zh-CN"><body style="font-family:PingFang SC,Microsoft YaHei,sans-serif;font-size:14px;line-height:1.7;color:#0f172a;max-width:560px">
<p>您好，</p>
<p>我们注意到企业 <strong>${escapeHtml(row.tenant_name)}</strong> 近期使用情况有变化（${escapeHtml(risks)}），${escapeHtml(levelLabel)}。</p>
<p>如需协助续费、培训或功能开通，欢迎登录：</p>
<p><a href="${billingUrl}" style="color:#0369a1">打开 ZhiFlow →</a></p>
</body></html>`;
  return { subject, text, html };
}

async function recordReminderSent(tenantId, authorUserId, kind, toEmail) {
  await createTenantOpsNote(tenantId, authorUserId, {
    note_type: 'email',
    content: `${EMAIL_NOTE_PREFIX[kind]}已发送至 ${toEmail}（${dayjs().format('YYYY-MM-DD HH:mm')}）`,
    next_follow_at: null,
  });
}

/**
 * @param {number} authorUserId
 * @param {object} options
 */
export async function sendExpiringSubscriptionReminderEmails(authorUserId, options = {}) {
  if (!isSmtpConfigured()) {
    throw new HttpError(503, '未配置 SMTP，无法发送邮件。请配置 SMTP_* 环境变量', 503);
  }

  const days = Math.min(90, Math.max(1, Number(options.days) || 14));
  const urgencyOnly = options.urgency_only !== false && options.urgency_only !== '0';
  const skipEmailed = options.skip_if_emailed !== false && options.skip_if_emailed !== '0';
  const includePastDue = options.include_past_due === true || options.include_past_due === '1';
  const dryRun = options.dry_run === true || options.dry_run === '1';
  const maxSend = Math.min(80, Math.max(1, Number(options.limit) || 50));

  const { list, total } = await listExpiringSubscriptions({
    days,
    limit: 200,
    include_past_due: includePastDue,
  });

  let targets = list;
  if (urgencyOnly) {
    targets = targets.filter((r) => r.urgency === 'critical' || r.urgency === 'warn');
  }

  const billingUrl = `${appBase()}/app/billing`;
  const results = { sent: 0, would_send: 0, skipped: 0, no_email: 0, failed: 0, targets: total, dry_run: dryRun };
  const details = [];

  for (const row of targets) {
    if (results.sent >= maxSend) break;

    // eslint-disable-next-line no-await-in-loop
    if (skipEmailed && (await hasRecentReminderNote(row.tenant_id, 'expiring'))) {
      results.skipped += 1;
      details.push({ tenant_id: row.tenant_id, status: 'skipped', reason: '近期已发过邮件' });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const emails = await resolveTenantAdminEmails(row.tenant_id);
    const to = emails[0];
    if (!to) {
      results.no_email += 1;
      details.push({ tenant_id: row.tenant_id, status: 'no_email' });
      continue;
    }

    if (dryRun) {
      results.would_send += 1;
      details.push({ tenant_id: row.tenant_id, status: 'would_send', email: to });
      continue;
    }

    const mail = buildExpiringEmail(row, billingUrl);
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({ to, subject: mail.subject, text: mail.text, html: mail.html });
      // eslint-disable-next-line no-await-in-loop
      await recordReminderSent(row.tenant_id, authorUserId, 'expiring', to);
      results.sent += 1;
      details.push({ tenant_id: row.tenant_id, status: 'sent', email: to });
    } catch (e) {
      results.failed += 1;
      details.push({
        tenant_id: row.tenant_id,
        status: 'failed',
        reason: e?.message || 'send_failed',
      });
    }
  }

  let ops_summary = null;
  if (options.notify_ops && !dryRun && results.sent > 0) {
    ops_summary = await sendOpsReminderSummaryEmail('expiring', targets.slice(0, maxSend), results);
  }

  return { ...results, details: details.slice(0, 30), ops_summary };
}

/**
 * @param {number} authorUserId
 * @param {object} options
 */
export async function sendChurnRiskReminderEmails(authorUserId, options = {}) {
  if (!isSmtpConfigured()) {
    throw new HttpError(503, '未配置 SMTP，无法发送邮件。请配置 SMTP_* 环境变量', 503);
  }

  const criticalOnly = options.critical_only !== false && options.critical_only !== '0';
  const levelFilter =
    options.level === 'critical' || options.level === 'warn'
      ? options.level
      : criticalOnly
        ? 'critical'
        : '';
  const skipEmailed = options.skip_if_emailed !== false && options.skip_if_emailed !== '0';
  const dryRun = options.dry_run === true || options.dry_run === '1';
  const maxSend = Math.min(80, Math.max(1, Number(options.limit) || 50));

  const { list, total } = await listChurnRiskTenants({
    limit: 100,
    level: levelFilter || undefined,
  });

  const billingUrl = `${appBase()}/app/billing`;
  const results = { sent: 0, would_send: 0, skipped: 0, no_email: 0, failed: 0, targets: total, dry_run: dryRun };
  const details = [];

  for (const row of list) {
    if (results.sent >= maxSend) break;

    // eslint-disable-next-line no-await-in-loop
    if (skipEmailed && (await hasRecentReminderNote(row.tenant_id, 'churn'))) {
      results.skipped += 1;
      details.push({ tenant_id: row.tenant_id, status: 'skipped', reason: '近期已发过邮件' });
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    const emails = await resolveTenantAdminEmails(row.tenant_id);
    const to = emails[0];
    if (!to) {
      results.no_email += 1;
      details.push({ tenant_id: row.tenant_id, status: 'no_email' });
      continue;
    }

    if (dryRun) {
      results.would_send += 1;
      details.push({ tenant_id: row.tenant_id, status: 'would_send', email: to });
      continue;
    }

    const mail = buildChurnEmail(row, billingUrl);
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({ to, subject: mail.subject, text: mail.text, html: mail.html });
      // eslint-disable-next-line no-await-in-loop
      await recordReminderSent(row.tenant_id, authorUserId, 'churn', to);
      results.sent += 1;
      details.push({ tenant_id: row.tenant_id, status: 'sent', email: to });
    } catch (e) {
      results.failed += 1;
      details.push({
        tenant_id: row.tenant_id,
        status: 'failed',
        reason: e?.message || 'send_failed',
      });
    }
  }

  let ops_summary = null;
  if (options.notify_ops && !dryRun && results.sent > 0) {
    ops_summary = await sendOpsReminderSummaryEmail('churn', list.slice(0, maxSend), results);
  }

  return { ...results, details: details.slice(0, 30), ops_summary };
}

function buildExpiringRowFromDetail(tenantId, detail) {
  const sub = detail.subscription;
  const endAt = sub.subscription.current_period_end || sub.subscription.trial_ends_at;
  return {
    tenant_id: Number(tenantId),
    tenant_name: detail.tenant.name,
    plan_name: sub.plan?.name || '—',
    subscription_status: sub.subscription.status,
    billing_cycle: sub.subscription.billing_cycle || 'monthly',
    days_remaining: sub.days_remaining ?? 0,
    ends_at: endAt,
    urgency:
      (sub.days_remaining ?? 99) <= 3
        ? 'critical'
        : (sub.days_remaining ?? 99) <= 7
          ? 'warn'
          : 'normal',
  };
}

/**
 * 单租户：到期/续费提醒邮件。
 */
export async function sendExpiringReminderForTenant(authorUserId, tenantId, options = {}) {
  if (!isSmtpConfigured()) {
    throw new HttpError(503, '未配置 SMTP，无法发送邮件', 503);
  }
  const tid = Number(tenantId);
  const skipEmailed = options.skip_if_emailed !== false && options.skip_if_emailed !== '0';
  if (skipEmailed && (await hasRecentReminderNote(tid, 'expiring'))) {
    return { sent: 0, skipped: true, reason: '近期已发过到期提醒' };
  }

  const detail = await getTenantDetail(tid);
  const row = buildExpiringRowFromDetail(tid, detail);
  const emails = await resolveTenantAdminEmails(tid);
  const to = emails[0];
  if (!to) {
    return { sent: 0, skipped: false, no_email: true };
  }

  const billingUrl = `${appBase()}/app/billing`;
  const mail = buildExpiringEmail(row, billingUrl);
  await sendMail({ to, subject: mail.subject, text: mail.text, html: mail.html });
  await recordReminderSent(tid, authorUserId, 'expiring', to);
  return { sent: 1, email: to, tenant_name: detail.tenant.name };
}

/**
 * 单租户：流失挽回提醒邮件（须在风险扫描中命中，或传入 force）。
 */
export async function sendChurnReminderForTenant(authorUserId, tenantId, options = {}) {
  if (!isSmtpConfigured()) {
    throw new HttpError(503, '未配置 SMTP，无法发送邮件', 503);
  }
  const tid = Number(tenantId);
  const force = options.force === true || options.force === '1';
  const skipEmailed = options.skip_if_emailed !== false && options.skip_if_emailed !== '0';

  const detail = await getTenantDetail(tid);
  const churn = detail.churn_risk;
  if (!force && (!churn || churn.level === 'ok' || !churn.risks?.length)) {
    throw new HttpError(400, '该租户当前无流失风险，无法发送流失提醒（可改用到期提醒）', 400);
  }

  if (skipEmailed && (await hasRecentReminderNote(tid, 'churn'))) {
    return { sent: 0, skipped: true, reason: '近期已发过流失提醒' };
  }

  const row = {
    tenant_id: tid,
    tenant_name: detail.tenant.name,
    level: churn?.level === 'critical' ? 'critical' : 'warn',
    risks: churn?.risks?.length
      ? churn.risks
      : [{ title: '使用情况需关注', detail: '' }],
  };

  const emails = await resolveTenantAdminEmails(tid);
  const to = emails[0];
  if (!to) {
    return { sent: 0, skipped: false, no_email: true };
  }

  const billingUrl = `${appBase()}/app/billing`;
  const mail = buildChurnEmail(row, billingUrl);
  await sendMail({ to, subject: mail.subject, text: mail.text, html: mail.html });
  await recordReminderSent(tid, authorUserId, 'churn', to);
  return { sent: 1, email: to, tenant_name: detail.tenant.name };
}

async function sendOpsReminderSummaryEmail(kind, rows, sendResult) {
  const recipients = await resolveDigestEmailRecipients();
  if (!recipients.length) return { sent: 0, skipped: 'no_ops_recipients' };

  const label = kind === 'expiring' ? '到期提醒' : '流失挽回提醒';
  const lines = rows.slice(0, 20).map((r) => {
    if (kind === 'expiring') {
      return `· ${r.tenant_name}（${r.plan_name}，剩余 ${r.days_remaining} 天）`;
    }
    return `· ${r.tenant_name}（${r.level === 'critical' ? '严重' : '关注'}）`;
  });
  const text = [
    `【ZhiFlow 平台】批量${label}邮件已发送`,
    `成功 ${sendResult.sent} · 跳过 ${sendResult.skipped} · 无邮箱 ${sendResult.no_email} · 失败 ${sendResult.failed}`,
    '',
    ...lines,
    rows.length > 20 ? `…等 ${rows.length} 家` : '',
    '',
    `${appBase()}/app/platform`,
  ].join('\n');

  let sent = 0;
  for (const to of recipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({
        to,
        subject: `ZhiFlow · 批量${label}发送摘要 ${dayjs().format('YYYY-MM-DD')}`,
        text,
      });
      sent += 1;
    } catch (e) {
      console.error('[platformReminder] ops summary failed', to, e);
    }
  }
  return { sent, recipients: recipients.length };
}
