/**
 * @file 每日「今日必做」企微晨间推送（租户管理员）。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op } from 'sequelize';
import { Tenant, User, AutomationLog } from '../models/index.js';
import { env } from '../config/env.js';
import { sendAgentTextMessage } from './wework.service.js';
import { getTodayActions } from './dashboardTodayActions.service.js';
import { normalizePermissionCodes } from '../utils/permissions.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';
const TRIGGER = 'today_actions_morning_digest';
const MAX_ITEMS_IN_MESSAGE = 5;

function buildAdminAuth(tenantId, adminUser) {
  return {
    tenantId: Number(tenantId),
    userId: Number(adminUser.id),
    legacyRole: 'admin',
    roleName: '管理员',
    permissions: normalizePermissionCodes(['*']),
    isDemo: false,
  };
}

/** 销售身份：getTodayActions 会按 owner_id 收敛到此人负责的客户。 */
function buildSalesAuth(tenantId, salesUser) {
  return {
    tenantId: Number(tenantId),
    userId: Number(salesUser.id),
    legacyRole: 'sales',
    roleName: '销售',
    permissions: normalizePermissionCodes([]),
    isDemo: false,
  };
}

export function formatTodayActionsWeworkMessage(tenantName, payload) {
  const base = String(env.appUrl || '').replace(/\/$/, '');
  const lines = [
    `【ZhiFlow 今日必做】${tenantName || ''}`.trim(),
    (() => {
      const d = dayjs().tz(TZ);
      const wd = ['日', '一', '二', '三', '四', '五', '六'][d.day()];
      return `${d.format('YYYY-MM-DD')} 周${wd}`;
    })(),
    '',
  ];

  if (!payload.items?.length) {
    lines.push('今日暂无紧急待办，可主动跟进 3 位客户或试用 AI 写话术。');
    lines.push('');
    lines.push(`打开仪表盘：${base}/app`);
    return lines.join('\n');
  }

  lines.push(payload.headline || `共 ${payload.total} 项建议今日处理`);
  lines.push('');
  payload.items.slice(0, MAX_ITEMS_IN_MESSAGE).forEach((item, i) => {
    const tag = item.priority === 'critical' ? '‼️' : item.priority === 'high' ? '⚠️' : '·';
    lines.push(`${i + 1}. ${tag} ${item.title}`);
    if (item.description) lines.push(`   ${item.description}`);
    lines.push(`   ${base}${item.link}`);
  });
  if (payload.items.length > MAX_ITEMS_IN_MESSAGE) {
    lines.push(`…另有 ${payload.items.length - MAX_ITEMS_IN_MESSAGE} 项，请打开仪表盘查看`);
  }
  lines.push('');
  lines.push(`全部待办：${base}/app`);
  return lines.join('\n');
}

async function sentMorningDigestToday(tenantId) {
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

async function recordMorningDigestSent(tenantId, preview) {
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
 * 向单个租户管理员推送今日必做（仅在有待办时发送，避免空打扰）。
 */
export async function sendTodayActionsMorningDigestForTenant(tenantId, options = {}) {
  const force = options.force === true;
  const tid = Number(tenantId);
  const tenant = await Tenant.findByPk(tid);
  if (!tenant?.wework_corp_id || !tenant?.wework_secret) {
    return { sent: 0, skipped: 'no_wework' };
  }

  if (!force && (await sentMorningDigestToday(tid))) {
    return { sent: 0, skipped: 'already_sent_today' };
  }

  const admin = await User.findOne({
    where: { tenant_id: tid, status: 1, role: 'admin' },
    attributes: ['id', 'username'],
    order: [['id', 'ASC']],
  });
  if (!admin) return { sent: 0, skipped: 'no_admin' };

  const auth = buildAdminAuth(tid, admin);
  const payload = await getTodayActions(auth);
  if (!payload.items?.length && !options.send_when_empty) {
    return { sent: 0, skipped: 'no_actions', total: 0 };
  }

  // 老板/管理员：全公司视角战报
  const content = formatTodayActionsWeworkMessage(tenant.name, payload);
  const admins = await User.findAll({
    where: { tenant_id: tid, status: 1, role: 'admin' },
    attributes: ['id', 'wework_userid'],
  });

  let sent = 0;
  let salesSent = 0;
  for (const u of admins) {
    const touser = u.wework_userid ? String(u.wework_userid).trim() : '';
    if (!touser) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendAgentTextMessage(tenant, { touser, content });
      sent += 1;
    } catch (e) {
      console.error('[todayActionsDigest] send failed', tid, u.id, e);
    }
  }

  // 每个销售：只看自己名下客户的「今日必做」，建立全员日活习惯
  const salesUsers = await User.findAll({
    where: {
      tenant_id: tid,
      status: 1,
      role: { [Op.ne]: 'admin' },
      wework_userid: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
    attributes: ['id', 'username', 'wework_userid'],
  });
  for (const u of salesUsers) {
    const touser = String(u.wework_userid).trim();
    if (!touser) continue;
    try {
      // eslint-disable-next-line no-await-in-loop
      const salesPayload = await getTodayActions(buildSalesAuth(tid, u));
      // 销售无待办则不打扰，避免「狼来了」降低打开率
      if (!salesPayload.items?.length) continue;
      const salesContent = formatTodayActionsWeworkMessage(tenant.name, salesPayload);
      // eslint-disable-next-line no-await-in-loop
      await sendAgentTextMessage(tenant, { touser, content: salesContent });
      salesSent += 1;
    } catch (e) {
      console.error('[todayActionsDigest] sales send failed', tid, u.id, e);
    }
  }

  if (sent > 0 || salesSent > 0) {
    await recordMorningDigestSent(tid, content);
  }

  return {
    sent: sent + salesSent,
    admins_notified: sent,
    sales_notified: salesSent,
    total: payload.total,
    critical_count: payload.critical_count,
  };
}

export async function sendTodayActionsMorningDigestAllTenants() {
  const tenants = await Tenant.findAll({
    where: {
      status: 1,
      wework_corp_id: { [Op.ne]: null },
      wework_secret: { [Op.ne]: null },
    },
    attributes: ['id'],
  });

  let messages = 0;
  let tenantsWithActions = 0;
  let skipped = 0;

  for (const t of tenants) {
    // eslint-disable-next-line no-await-in-loop
    const r = await sendTodayActionsMorningDigestForTenant(Number(t.id));
    if (r.sent > 0) {
      messages += r.sent;
      tenantsWithActions += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    tenants: tenants.length,
    tenants_notified: tenantsWithActions,
    messages,
    skipped,
  };
}

/** 当前登录租户管理员手动推送 */
export async function pushTodayActionsToWework(auth) {
  return sendTodayActionsMorningDigestForTenant(auth.tenantId, { force: true, send_when_empty: true });
}
