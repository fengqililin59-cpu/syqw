/**
 * @file 活跃流失 / 用量下降风险检测与企微预警。
 */
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import {
  Tenant,
  User,
  Customer,
  CustomerFollowUp,
  UsageStat,
  Subscription,
  Plan,
  TenantChurnAlert,
} from '../models/index.js';
import { sendAgentTextMessage } from './wework.service.js';
import { env } from '../config/env.js';

const COOLDOWN_DAYS = 7;
const ALERT_KEY = 'churn_composite';

function currentMonth() {
  return dayjs().format('YYYY-MM');
}

function prevMonth() {
  return dayjs().subtract(1, 'month').format('YYYY-MM');
}

async function notifyTenantAdmins(tenantId, content) {
  const [tenant, admins] = await Promise.all([
    Tenant.findByPk(tenantId),
    User.findAll({
      where: { tenant_id: tenantId, status: 1, role: 'admin' },
      attributes: ['id', 'wework_userid'],
    }),
  ]);
  if (!tenant || !admins.length) return 0;

  let sent = 0;
  for (const admin of admins) {
    const touser = admin.wework_userid ? String(admin.wework_userid).trim() : '';
    if (!touser) continue;
    // eslint-disable-next-line no-await-in-loop
    await sendAgentTextMessage(tenant, { touser, content }).catch((e) => {
      console.error('[churnRisk] notify failed', tenantId, admin.id, e);
    });
    sent += 1;
  }
  return sent;
}

async function canSendAlert(tenantId) {
  try {
    const row = await TenantChurnAlert.findOne({
      where: { tenant_id: Number(tenantId), alert_key: ALERT_KEY },
    });
    if (!row) return true;
    return dayjs(row.sent_at).isBefore(dayjs().subtract(COOLDOWN_DAYS, 'day'));
  } catch {
    return true;
  }
}

async function recordAlert(tenantId, risks) {
  try {
    await TenantChurnAlert.upsert({
      tenant_id: Number(tenantId),
      alert_key: ALERT_KEY,
      sent_at: new Date(),
      detail: { risks: risks.map((r) => r.code) },
    });
  } catch (e) {
    console.warn('[churnRisk] record alert skipped (table missing?)', e.message);
  }
}

/**
 * 检测租户流失风险项。
 */
export async function evaluateChurnRisks(tenantId) {
  const tid = Number(tenantId);
  const tenant = await Tenant.findByPk(tid, { attributes: ['id', 'name', 'created_at', 'status'] });
  if (!tenant || tenant.status !== 1) return [];

  const since7 = dayjs().subtract(7, 'day').toDate();
  const tenantAgeDays = dayjs().diff(dayjs(tenant.created_at), 'day');

  const [
    admins,
    customerCount,
    followUps7d,
    usageNow,
    usagePrev,
    subRow,
  ] = await Promise.all([
    User.findAll({
      where: { tenant_id: tid, status: 1, role: 'admin' },
      attributes: ['id', 'last_login_at', 'username'],
    }),
    Customer.count({ where: { tenant_id: tid } }),
    CustomerFollowUp.count({
      where: { created_at: { [Op.gte]: since7 } },
      include: [{ model: Customer, required: true, where: { tenant_id: tid }, attributes: [] }],
    }),
    UsageStat.findOne({ where: { tenant_id: tid, stat_month: currentMonth() } }),
    UsageStat.findOne({ where: { tenant_id: tid, stat_month: prevMonth() } }),
    Subscription.findOne({
      where: { tenant_id: tid },
      include: [{ model: Plan, as: 'plan', attributes: ['code', 'name'], required: false }],
    }),
  ]);

  const risks = [];
  const aiNow = Number(usageNow?.ai_calls_used || 0);
  const aiPrev = Number(usagePrev?.ai_calls_used || 0);

  let latestAdminLogin = null;
  for (const a of admins) {
    if (!a.last_login_at) continue;
    const d = dayjs(a.last_login_at);
    if (!latestAdminLogin || d.isAfter(latestAdminLogin)) latestAdminLogin = d;
  }

  if (admins.length > 0 && (!latestAdminLogin || latestAdminLogin.isBefore(dayjs().subtract(7, 'day')))) {
    risks.push({
      code: 'admin_inactive',
      level: 'critical',
      title: '管理员 7 天未登录',
      detail: '请安排管理员登录后台，检查企微配置与团队使用情况。',
      action_path: '/app',
    });
  }

  if (tenantAgeDays >= 7 && aiNow === 0) {
    risks.push({
      code: 'ai_never_used',
      level: 'warn',
      title: '本月尚未使用 AI',
      detail: '建议在「AI 智能助手」或客户详情「企微消息」试生成话术，提升跟进效率。',
      action_path: '/app/ai-assistant',
    });
  }

  const adminActiveRecently =
    latestAdminLogin && latestAdminLogin.isAfter(dayjs().subtract(3, 'day'));
  const teamStillEngaged = followUps7d >= 3 || adminActiveRecently;

  if (aiPrev >= 20 && aiNow < Math.max(5, Math.floor(aiPrev * 0.3))) {
    if (!teamStillEngaged) {
      risks.push({
        code: 'ai_usage_drop',
        level: 'warn',
        title: 'AI 调用较上月明显下降',
        detail: `上月 ${aiPrev} 次，本月仅 ${aiNow} 次，且近 7 天跟进偏少或管理员久未登录。建议检查配额与使用习惯。`,
        action_path: '/app/billing',
        notify: true,
      });
    } else {
      risks.push({
        code: 'ai_usage_soft_drop',
        level: 'info',
        title: 'AI 用量下降（团队仍活跃）',
        detail: `上月 ${aiPrev} 次，本月 ${aiNow} 次；近期仍有跟进或登录，暂不视为流失风险。`,
        action_path: '/app/ai-assistant',
        notify: false,
      });
    }
  }

  if (customerCount >= 5 && followUps7d === 0) {
    risks.push({
      code: 'followup_stall',
      level: 'warn',
      title: '近 7 天无跟进记录',
      detail: `客户池 ${customerCount} 位，但本周未登记跟进，高意向可能流失。`,
      action_path: '/app/follow-ups?overdue=1',
    });
  }

  const sub = subRow?.get ? subRow.get({ plain: true }) : subRow;
  if (sub?.status === 'trialing' && tenantAgeDays >= 10) {
    const trialEnd = sub.trial_ends_at ? dayjs(sub.trial_ends_at) : null;
    if (trialEnd && trialEnd.diff(dayjs(), 'day') <= 4) {
      risks.push({
        code: 'trial_ending_silent',
        level: 'critical',
        title: '试用将结束且活跃度偏低',
        detail: `试用剩余约 ${Math.max(0, trialEnd.diff(dayjs(), 'day'))} 天，建议推动团队完成 1 次 AI + 3 次跟进。`,
        action_path: '/app/billing',
      });
    }
  }

  return risks;
}

export function churnRisksForDisplay(risks) {
  return risks.filter((r) => r.level !== 'info');
}

function risksForDisplay(risks) {
  return churnRisksForDisplay(risks);
}

function risksForNotify(risks) {
  return risks.filter((r) => r.notify !== false && r.level !== 'info');
}

export async function getChurnRiskSummary(tenantId) {
  const allRisks = await evaluateChurnRisks(tenantId);
  const risks = risksForDisplay(allRisks);
  const level = risks.some((r) => r.level === 'critical')
    ? 'critical'
    : risks.length
      ? 'warn'
      : 'ok';
  return {
    level,
    risks,
    hints: allRisks.filter((r) => r.level === 'info'),
    app_url: String(env.appUrl || '').replace(/\/$/, ''),
  };
}

function formatAlertMessage(tenantName, risks, appUrl) {
  const lines = [
    `【ZhiFlow 活跃提醒】${tenantName || ''}`.trim(),
    '系统检测到以下风险，建议本周处理：',
    '',
    ...risks.map((r, i) => `${i + 1}. ${r.title}\n   ${r.detail}`),
    '',
    `打开后台：${appUrl}/app`,
    `话术库：${appUrl}/app/script-library`,
  ];
  return lines.join('\n');
}

export async function runChurnAlertsForAllTenants() {
  const tenants = await Tenant.findAll({
    where: { status: 1 },
    attributes: ['id', 'name', 'wework_corp_id', 'wework_secret'],
  });

  let checked = 0;
  let sent = 0;
  for (const t of tenants) {
    const tid = Number(t.id);
    if (!t.wework_corp_id || !t.wework_secret) continue;
    // eslint-disable-next-line no-await-in-loop
    const risks = risksForNotify(await evaluateChurnRisks(tid));
    checked += 1;
    if (!risks.length) continue;
    // eslint-disable-next-line no-await-in-loop
    const ok = await canSendAlert(tid);
    if (!ok) continue;

    const appUrl = String(env.appUrl || '').replace(/\/$/, '');
    const content = formatAlertMessage(t.name, risks, appUrl);
    // eslint-disable-next-line no-await-in-loop
    const n = await notifyTenantAdmins(tid, content);
    if (n > 0) {
      // eslint-disable-next-line no-await-in-loop
      await recordAlert(tid, risks);
      sent += 1;
    }
  }
  return { checked, sent };
}
