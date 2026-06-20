/**
 * @file 每周价值战报：聚合 AI / 跟进 / 成交等指标。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { Op } from 'sequelize';
import {
  Customer,
  CustomerFollowUp,
  UsageStat,
  Tenant,
  User,
} from '../models/index.js';
import { customerWhereScope, isAdmin } from '../utils/permissions.js';
import { sendAgentTextMessage } from './wework.service.js';
import { env } from '../config/env.js';
import { getRoiSummary } from './adTracking.service.js';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Shanghai';
const MINUTES_PER_AI = 3;

function currentMonth() {
  return dayjs().tz(TZ).format('YYYY-MM');
}

function weekRange() {
  const end = dayjs().tz(TZ).endOf('day');
  const start = end.subtract(6, 'day').startOf('day');
  return { start: start.toDate(), end: end.toDate(), label: `${start.format('MM-DD')} ~ ${end.format('MM-DD')}` };
}

/**
 * 仪表盘「本周战果」。
 */
export async function getWeeklyWins(auth) {
  const tenantId = auth.tenantId;
  const cWhere = customerWhereScope(auth);
  const { start, end, label } = weekRange();

  const followCustWhere = isAdmin(auth)
    ? { tenant_id: tenantId }
    : { tenant_id: tenantId, owner_id: auth.userId };

  const [
    newCustomers,
    followUps,
    newDeals,
    highIntentNew,
    usageRow,
    pendingFollowup,
    dealCustomers,
  ] = await Promise.all([
    Customer.count({
      where: { ...cWhere, created_at: { [Op.gte]: start, [Op.lte]: end } },
    }),
    CustomerFollowUp.count({
      where: { created_at: { [Op.gte]: start, [Op.lte]: end } },
      include: [{ model: Customer, required: true, where: followCustWhere, attributes: [] }],
    }),
    Customer.count({
      where: {
        ...cWhere,
        stage: { [Op.in]: ['deal', 'won'] },
        updated_at: { [Op.gte]: start, [Op.lte]: end },
      },
    }),
    Customer.count({
      where: {
        ...cWhere,
        intent_score: { [Op.gte]: 70 },
        created_at: { [Op.gte]: start, [Op.lte]: end },
      },
    }),
    UsageStat.findOne({
      where: { tenant_id: tenantId, stat_month: currentMonth() },
      attributes: ['ai_calls_used'],
    }),
    CustomerFollowUp.count({
      distinct: true,
      col: 'customer_id',
      where: {
        next_follow_at: { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: end }] },
      },
      include: [{ model: Customer, required: true, where: cWhere, attributes: [] }],
    }),
    Customer.findAll({
      where: {
        ...cWhere,
        stage: { [Op.in]: ['deal', 'won'] },
        updated_at: { [Op.gte]: start, [Op.lte]: end },
      },
      attributes: ['id', 'name', 'nickname'],
      order: [['updated_at', 'DESC']],
      limit: 8,
    }),
  ]);

  const aiUsed = Number(usageRow?.ai_calls_used || 0);
  const minutesSaved = aiUsed * MINUTES_PER_AI;

  // 广告 ROI 周汇总（仅管理员）
  let roiRows = [];
  let totalSpend = 0;
  let totalConversions = 0;
  if (isAdmin(auth)) {
    try {
      const sdStr = dayjs(start).tz(TZ).format('YYYY-MM-DD');
      const edStr = dayjs(end).tz(TZ).format('YYYY-MM-DD');
      roiRows = await getRoiSummary({ tenantId, startDate: sdStr, endDate: edStr });
      totalSpend = roiRows.reduce((s, r) => s + Number(r.spend_cny || 0), 0);
      totalConversions = roiRows.reduce((s, r) => s + Number(r.conversions || 0), 0);
    } catch {
      // 无广告数据时静默跳过
    }
  }

  const highlights = [];
  if (newCustomers > 0) highlights.push(`新增客户 ${newCustomers} 位`);
  if (followUps > 0) highlights.push(`登记跟进 ${followUps} 次`);
  if (newDeals > 0) highlights.push(`推进成交 ${newDeals} 位`);
  if (highIntentNew > 0) highlights.push(`新高意向 ${highIntentNew} 位`);
  if (aiUsed > 0) highlights.push(`本月 AI 已用 ${aiUsed} 次`);

  return {
    week_label: label,
    new_customers: newCustomers,
    follow_ups: followUps,
    new_deals: newDeals,
    high_intent_new: highIntentNew,
    ai_calls_month: aiUsed,
    estimated_hours_saved_month: Math.round((minutesSaved / 60) * 10) / 10,
    pending_followup: pendingFollowup,
    highlights,
    roi: roiRows.length > 0 ? {
      total_spend_cny: Math.round(totalSpend * 100) / 100,
      total_conversions: totalConversions,
      cpa: totalConversions > 0 ? Math.round(totalSpend / totalConversions * 100) / 100 : null,
      by_platform: roiRows.map((r) => ({
        platform: r.platform,
        spend_cny: r.spend_cny,
        conversions: r.conversions,
        roas: r.roas,
      })),
    } : null,
    recent_deal_customers: dealCustomers.map((c) => ({
      id: c.id,
      name: c.name || c.nickname || `客户#${c.id}`,
    })),
    insight:
      pendingFollowup > 0
        ? `仍有 ${pendingFollowup} 位客户计划跟进日已到，建议今日优先处理。`
        : followUps === 0
          ? '本周尚未登记跟进，建议在「待跟进」中处理 3 位客户并试用 AI 写话术。'
          : '保持「待跟进 → AI 话术 → 人发企微」节奏，意向转化更稳。',
    app_url: String(env.appUrl || '').replace(/\/$/, ''),
  };
}

export function formatWeeklyWinsShareText(wins, tenantName, { scopeLabel = '团队' } = {}) {
  const lines = [
    `【ZhiFlow ${scopeLabel}周报】${tenantName || ''}`.trim(),
    `周期：${wins.week_label}`,
    '',
    ...(wins.highlights.length
      ? wins.highlights.map((h) => `· ${h}`)
      : ['· 本周数据较少，建议完成 3 次跟进并试用 AI 写话术']),
    '',
    `本月估算节省写话术时间：约 ${wins.estimated_hours_saved_month} 小时（按每次 AI ${MINUTES_PER_AI} 分钟）`,
    wins.insight,
  ];
  if (wins.recent_deal_customers?.length) {
    lines.push('');
    lines.push(
      `本周成交：${wins.recent_deal_customers.map((c) => c.name).join('、')}`,
    );
  }
  if (wins.pending_followup > 0) {
    lines.push(`待跟进（计划日已到）：${wins.pending_followup} 位`);
  }
  // 广告 ROI 块（有数据才显示）
  if (wins.roi) {
    const r = wins.roi;
    lines.push('');
    lines.push('─── 本周广告投放 ───');
    if (r.total_spend_cny > 0) {
      lines.push(`投入：¥${r.total_spend_cny.toFixed(0)}`);
    }
    lines.push(`带来线索：${r.total_conversions} 个${r.cpa ? `  获客成本：¥${r.cpa.toFixed(0)}/人` : ''}`);
    const topPlatform = r.by_platform.sort((a, b) => (b.conversions || 0) - (a.conversions || 0))[0];
    if (topPlatform && r.by_platform.length > 1) {
      lines.push(`最优渠道：${topPlatform.platform}（${topPlatform.conversions} 个线索）`);
    }
    lines.push(`详情→ ${wins.app_url}/app/ads-roi`);
  }
  lines.push('');
  lines.push(`打开仪表盘：${wins.app_url}/app`);
  return lines.filter(Boolean).join('\n');
}

function formatDigestMessage(wins, tenantName) {
  return formatWeeklyWinsShareText(wins, tenantName, { scopeLabel: '每周战报' });
}

/** 可复制 / 转发用的周报文案 */
export async function getWeeklyWinsShareText(auth) {
  const wins = await getWeeklyWins(auth);
  const tenant = await Tenant.findByPk(auth.tenantId, { attributes: ['name'] });
  const scopeLabel = isAdmin(auth) ? '团队' : '个人';
  const text = formatWeeklyWinsShareText(wins, tenant?.name, { scopeLabel });
  return { text, wins, scope: scopeLabel };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 可打印 HTML 周报（浏览器「另存为 PDF」）。
 */
export async function buildWeeklyWinsExportHtml(auth) {
  const { wins, scope } = await getWeeklyWinsShareText(auth);
  const tenant = await Tenant.findByPk(auth.tenantId, { attributes: ['name'] });
  const tenantName = tenant?.name || '团队';
  const generatedAt = dayjs().tz(TZ).format('YYYY-MM-DD HH:mm');
  const safeName = tenantName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 32);
  const filename = `ZhiFlow-${scope}周报-${wins.week_label.replace(/\s/g, '')}-${safeName}.html`;

  const statRows = [
    ['新增客户', wins.new_customers],
    ['登记跟进', wins.follow_ups],
    ['推进成交', wins.new_deals],
    ['新高意向', wins.high_intent_new],
    ['本月 AI 次数', wins.ai_calls_month],
    ['估算节省(小时/月)', wins.estimated_hours_saved_month],
    ['待跟进(计划日已到)', wins.pending_followup],
  ];

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>ZhiFlow ${escapeHtml(scope)}周报 · ${escapeHtml(tenantName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #0f172a; margin: 0; padding: 32px; background: #f8fafc; }
    .page { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    h1 { font-size: 22px; margin: 0 0 4px; color: #0c4a6e; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
    .stat .label { font-size: 12px; color: #64748b; }
    .stat .value { font-size: 22px; font-weight: 700; color: #0369a1; margin-top: 4px; }
    h2 { font-size: 15px; margin: 20px 0 8px; color: #334155; }
    ul { margin: 0; padding-left: 20px; line-height: 1.7; }
    .insight { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 12px 14px; border-radius: 0 8px 8px 0; font-size: 14px; line-height: 1.6; }
    .footer { margin-top: 28px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; max-width: none; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>ZhiFlow ${escapeHtml(scope)}周报</h1>
    <p class="meta">${escapeHtml(tenantName)} · 周期 ${escapeHtml(wins.week_label)} · 生成于 ${generatedAt}</p>
    <div class="grid">
      ${statRows
        .map(
          ([label, value]) =>
            `<div class="stat"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></div>`,
        )
        .join('')}
    </div>
    <h2>本周亮点</h2>
    <ul>${(wins.highlights.length ? wins.highlights : ['本周数据较少，建议完成跟进并试用 AI']).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>
    ${
      wins.recent_deal_customers?.length
        ? `<h2>本周成交</h2><ul>${wins.recent_deal_customers.map((c) => `<li>${escapeHtml(c.name)}</li>`).join('')}</ul>`
        : ''
    }
    <h2>行动建议</h2>
    <div class="insight">${escapeHtml(wins.insight)}</div>
    <p class="footer">仪表盘：${escapeHtml(wins.app_url)}/app · 由 ZhiFlow 企微私域系统自动生成</p>
    <p class="no-print" style="margin-top:20px;font-size:13px;color:#64748b">提示：按 Ctrl/Cmd+P 选择「另存为 PDF」即可导出。</p>
  </div>
  <script class="no-print">window.addEventListener('load',function(){setTimeout(function(){window.print()},400)})</script>
</body>
</html>`;

  return { html, filename };
}

/** 管理员一键将本周战报推送到本租户企微管理员 */
export async function pushWeeklyWinsToWework(auth) {
  if (!isAdmin(auth)) {
    const err = new Error('仅管理员可推送团队周报');
    err.status = 403;
    err.httpCode = 403;
    throw err;
  }
  return sendWeeklyDigestForTenant(Number(auth.tenantId));
}

/**
 * 向租户管理员推送企微应用消息战报。
 */
export async function sendWeeklyDigestForTenant(tenantId) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant?.wework_corp_id || !tenant?.wework_secret) return { sent: 0, skipped: 'no_wework' };

  const admin = await User.findOne({
    where: { tenant_id: tenantId, status: 1, role: 'admin' },
    attributes: ['id'],
  });
  if (!admin) return { sent: 0, skipped: 'no_admin' };

  const auth = { tenantId: Number(tenantId), userId: admin.id, legacyRole: 'admin' };
  const wins = await getWeeklyWins(auth);
  if (wins.highlights.length === 0 && wins.ai_calls_month === 0) {
    return { sent: 0, skipped: 'no_activity' };
  }

  const content = formatDigestMessage(wins, tenant.name);
  const admins = await User.findAll({
    where: { tenant_id: tenantId, status: 1, role: 'admin' },
    attributes: ['id', 'wework_userid'],
  });

  let sent = 0;
  for (const u of admins) {
    const touser = u.wework_userid ? String(u.wework_userid).trim() : '';
    if (!touser) continue;
    // eslint-disable-next-line no-await-in-loop
    await sendAgentTextMessage(tenant, { touser, content }).catch((e) => {
      console.error('[weeklyDigest] send failed', tenantId, u.id, e);
    });
    sent += 1;
  }
  return { sent, wins };
}

/** 全站活跃租户（已配企微） */
export async function sendWeeklyDigestAllTenants() {
  const tenants = await Tenant.findAll({
    where: {
      status: 1,
      wework_corp_id: { [Op.ne]: null },
      wework_secret: { [Op.ne]: null },
    },
    attributes: ['id'],
  });
  let totalSent = 0;
  for (const t of tenants) {
    // eslint-disable-next-line no-await-in-loop
    const r = await sendWeeklyDigestForTenant(Number(t.id));
    totalSent += r.sent || 0;
  }
  return { tenants: tenants.length, messages: totalSent };
}
