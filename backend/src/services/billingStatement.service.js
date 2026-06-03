/**
 * @file 租户订阅账单（HTML 可打印 / 服务端 PDF）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dayjs from 'dayjs';
import PDFDocument from 'pdfkit';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { PaymentRecord, Plan, Tenant } from '../models/index.js';
import * as billingService from './billing.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_FONT = path.join(__dirname, '../../assets/fonts/NotoSansSC-Regular.otf');

const STATUS_LABELS = {
  pending: '待确认',
  paid: '已支付',
  failed: '失败',
  refunded: '已退款',
  trialing: '试用中',
  active: '使用中',
  expired: '已到期',
  cancelled: '已取消',
};

const CHANNEL_LABELS = {
  wechat: '微信支付',
  alipay: '支付宝',
  manual: '线下转账',
};

const PDF_FONT_CANDIDATES = [
  () => env.billingPdfFontPath,
  () => BUNDLED_FONT,
  () => '/usr/share/fonts/truetype/noto/NotoSansSC-Regular.ttf',
  () => '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  () => '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
  () => '/System/Library/Fonts/Supplemental/Songti.ttc',
  () => '/System/Library/Fonts/PingFang.ttc',
  () => '/Library/Fonts/Arial Unicode.ttf',
];

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s) {
  if (!s) return '—';
  return dayjs(s).format('YYYY-MM-DD');
}

function fmtDateTime(s) {
  if (!s) return '—';
  return dayjs(s).format('YYYY-MM-DD HH:mm');
}

export function resolveBillingPdfFontPath() {
  for (const pick of PDF_FONT_CANDIDATES) {
    const p = pick();
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * @param {{ tenantId: number; months?: number; month?: string }} opts
 */
export async function gatherSubscriptionStatementData(opts) {
  const tenantId = Number(opts.tenantId);
  const monthKey = String(opts.month || '').trim();
  const months = Math.min(24, Math.max(1, Number(opts.months) || 12));

  const [tenant, subData] = await Promise.all([
    Tenant.findByPk(tenantId, { attributes: ['id', 'name', 'contact_phone'] }),
    billingService.getSubscription(tenantId),
  ]);

  let periodLabel;
  let paymentWhere = { tenant_id: tenantId };

  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const start = dayjs(`${monthKey}-01`).startOf('month');
    const end = start.endOf('month');
    periodLabel = start.format('YYYY年MM月');
    paymentWhere = {
      tenant_id: tenantId,
      [Op.or]: [
        { paid_at: { [Op.between]: [start.toDate(), end.toDate()] } },
        {
          paid_at: null,
          created_at: { [Op.between]: [start.toDate(), end.toDate()] },
        },
      ],
    };
  } else {
    const since = dayjs().subtract(months, 'month').startOf('month').toDate();
    periodLabel = `近 ${months} 个月`;
    paymentWhere = {
      tenant_id: tenantId,
      created_at: { [Op.gte]: since },
    };
  }

  const payments = await PaymentRecord.findAll({
    where: paymentWhere,
    include: [{ model: Plan, as: 'plan', attributes: ['name', 'code'], required: false }],
    order: [['id', 'DESC']],
    limit: 100,
  });

  const tenantName = tenant?.name || `租户 #${tenantId}`;
  const issuedAt = dayjs().format('YYYY-MM-DD HH:mm');
  const billNo = monthKey
    ? `ZS-${tenantId}-${monthKey.replace('-', '')}`
    : `ZS-${tenantId}-${dayjs().format('YYYYMMDD')}`;
  const safeName = tenantName.replace(/[^\w\u4e00-\u9fa5-]+/g, '_').slice(0, 24);
  const htmlFilename = monthKey
    ? `ZhiFlow-订阅账单-${safeName}-${monthKey}.html`
    : `ZhiFlow-订阅账单-${safeName}-${dayjs().format('YYYYMMDD')}.html`;
  const pdfFilename = htmlFilename.replace(/\.html$/i, '.pdf');

  const { subscription, plan, usage, days_remaining: daysRemaining } = subData;
  const cycleLabel = subscription.billing_cycle === 'yearly' ? '年付' : '月付';
  const periodPrice =
    subscription.billing_cycle === 'yearly' ? plan?.price_yearly : plan?.price_monthly;
  const subStatusLabel = STATUS_LABELS[subscription.status] || subscription.status;

  const paymentRows = payments.map((r) => {
    const p = r.get({ plain: true });
    return {
      created_at: fmtDateTime(p.created_at),
      plan_name: p.plan?.name || '—',
      billing_cycle: p.billing_cycle === 'yearly' ? '年付' : '月付',
      amount: fmtMoney(p.amount),
      status: STATUS_LABELS[p.status] || p.status,
      channel: CHANNEL_LABELS[p.pay_channel] || p.pay_channel,
      out_trade_no: p.out_trade_no,
    };
  });

  const paidRows = payments.filter((p) => p.status === 'paid');
  const paidTotal = paidRows.reduce((s, p) => s + Number(p.amount), 0);

  return {
    tenantId,
    tenantName,
    issuedAt,
    billNo,
    periodLabel,
    htmlFilename,
    pdfFilename,
    appUrl: String(env.appUrl || '').replace(/\/$/, ''),
    subscription: {
      planName: plan?.name || '—',
      planCode: plan?.code || '',
      statusLabel: subStatusLabel,
      isTrial: Boolean(subscription.is_trial),
      cycleLabel,
      periodPrice: fmtMoney(periodPrice),
      periodEnd: fmtDate(subscription.current_period_end || subscription.trial_ends_at),
      daysRemaining,
    },
    usage: {
      customers: usage.customers_count,
      seats: usage.seats_count,
      aiCalls: usage.ai_calls_used,
    },
    paymentRows,
    paidTotal: fmtMoney(paidTotal),
    paidCount: paidRows.length,
  };
}

function renderSubscriptionStatementHtml(data) {
  const paymentRowsHtml = data.paymentRows.length
    ? data.paymentRows
        .map(
          (p) => `<tr>
            <td>${escapeHtml(p.created_at)}</td>
            <td>${escapeHtml(p.plan_name)}</td>
            <td>${escapeHtml(p.billing_cycle)}</td>
            <td style="text-align:right">¥${escapeHtml(p.amount)}</td>
            <td>${escapeHtml(p.status)}</td>
            <td>${escapeHtml(p.channel)}</td>
            <td style="font-size:11px">${escapeHtml(p.out_trade_no)}</td>
          </tr>`,
        )
        .join('')
    : `<tr><td colspan="7" style="text-align:center;color:#64748b">所选时间范围内暂无支付记录</td></tr>`;

  const daysHint =
    data.subscription.daysRemaining != null ? `（剩余 ${data.subscription.daysRemaining} 天）` : '';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>ZhiFlow 订阅账单 · ${escapeHtml(data.tenantName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; color: #0f172a; margin: 0; padding: 28px; background: #f1f5f9; }
    .page { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 10px; padding: 36px 40px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
    .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0c4a6e; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 700; color: #0c4a6e; }
    .bill-meta { text-align: right; font-size: 13px; color: #64748b; line-height: 1.6; }
    h2 { font-size: 14px; color: #334155; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: .05em; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 14px; }
    .info-grid dt { color: #64748b; margin: 0; }
    .info-grid dd { margin: 0 0 8px; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    th { background: #f8fafc; color: #475569; font-weight: 600; }
    .summary { margin-top: 16px; text-align: right; font-size: 14px; }
    .summary strong { font-size: 18px; color: #0c4a6e; }
    .note { margin-top: 24px; padding: 12px 14px; background: #f0f9ff; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #0369a1; }
    .footer { margin-top: 28px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 14px; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; max-width: none; padding: 24px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="head">
      <div>
        <div class="brand">ZhiFlow 订阅账单</div>
        <div style="font-size:13px;color:#64748b;margin-top:4px">Subscription Statement</div>
      </div>
      <div class="bill-meta">
        <div>账单编号：${escapeHtml(data.billNo)}</div>
        <div>开具日期：${escapeHtml(data.issuedAt)}</div>
        <div>账单对象：${escapeHtml(data.tenantName)}</div>
      </div>
    </div>

    <h2>当前订阅</h2>
    <dl class="info-grid">
      <dt>套餐</dt><dd>${escapeHtml(data.subscription.planName)}（${escapeHtml(data.subscription.planCode)}）</dd>
      <dt>状态</dt><dd>${escapeHtml(data.subscription.statusLabel)}${data.subscription.isTrial ? ' · 试用' : ''}</dd>
      <dt>计费周期</dt><dd>${escapeHtml(data.subscription.cycleLabel)}</dd>
      <dt>牌价参考</dt><dd>¥${escapeHtml(data.subscription.periodPrice)} / ${escapeHtml(data.subscription.cycleLabel)}</dd>
      <dt>服务截止</dt><dd>${escapeHtml(data.subscription.periodEnd)}${daysHint}</dd>
      <dt>本月用量</dt><dd>客户 ${data.usage.customers} · 坐席 ${data.usage.seats} · AI ${data.usage.aiCalls} 次</dd>
    </dl>

    <h2>支付记录（${escapeHtml(data.periodLabel)}，最多 100 条）</h2>
    <table>
      <thead>
        <tr>
          <th>时间</th><th>套餐</th><th>周期</th><th>金额</th><th>状态</th><th>渠道</th><th>订单号</th>
        </tr>
      </thead>
      <tbody>${paymentRowsHtml}</tbody>
    </table>
    <p class="summary">期间已支付合计：<strong>¥${escapeHtml(data.paidTotal)}</strong>（${data.paidCount} 笔）</p>

    <div class="note">
      本账单为系统根据订阅与支付记录自动生成，仅供对账与存档。<strong>如需增值税发票</strong>，请登录 ZhiFlow 在「套餐计费 → 发票申请」提交开票信息。
    </div>

    <p class="footer">
      计费中心：${escapeHtml(data.appUrl)}/app/billing · 客服与合同事宜请联系平台商务<br/>
      ZhiFlow 企微私域 · 本文件不构成税务发票
    </p>
    <p class="no-print" style="margin-top:16px;font-size:13px;color:#64748b">提示：也可在计费页使用「下载 PDF」直接获取服务端生成的 PDF。</p>
  </div>
</body>
</html>`;

  return html;
}

function drawPdfTableRow(doc, cols, y, isHeader = false) {
  const widths = [95, 52, 36, 48, 42, 48, 118];
  const startX = doc.page.margins.left;
  let x = startX;
  doc.fontSize(isHeader ? 9 : 8);
  for (let i = 0; i < cols.length; i += 1) {
    const w = widths[i] || 50;
    doc.text(String(cols[i] ?? ''), x, y, { width: w - 4, lineBreak: false, ellipsis: true });
    x += w;
  }
}

async function renderSubscriptionStatementPdfBuffer(data) {
  const fontPath = resolveBillingPdfFontPath();
  if (!fontPath) {
    throw new HttpError(
      503,
      '未配置 PDF 中文字体：请设置 BILLING_PDF_FONT_PATH 或安装 Noto CJK 字体，详见 backend/assets/fonts/README.md',
      503,
    );
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      doc.registerFont('zh', fontPath);
      doc.font('zh');
    } catch (e) {
      reject(
        new HttpError(
          503,
          `PDF 字体加载失败（${fontPath}）：${e?.message || e}。请改用 TTF/OTF 或设置 BILLING_PDF_FONT_PATH`,
          503,
        ),
      );
      return;
    }

    const sub = data.subscription;
    const daysHint = sub.daysRemaining != null ? `（剩余 ${sub.daysRemaining} 天）` : '';

    doc.fillColor('#0c4a6e').fontSize(18).text('ZhiFlow 订阅账单', { continued: false });
    doc.fillColor('#64748b').fontSize(10).text('Subscription Statement');
    doc.moveDown(0.5);
    doc.fillColor('#334155').fontSize(10);
    doc.text(`账单编号：${data.billNo}`);
    doc.text(`开具日期：${data.issuedAt}`);
    doc.text(`账单对象：${data.tenantName}`);
    doc.moveDown(0.8);
    doc.strokeColor('#0c4a6e').lineWidth(1.5).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(0.8);

    doc.fillColor('#334155').fontSize(11).text('当前订阅', { underline: true });
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor('#0f172a');
    const infoLines = [
      `套餐：${sub.planName}（${sub.planCode}）`,
      `状态：${sub.statusLabel}${sub.isTrial ? ' · 试用' : ''}`,
      `计费周期：${sub.cycleLabel} · 牌价参考 ¥${sub.periodPrice}`,
      `服务截止：${sub.periodEnd}${daysHint}`,
      `本月用量：客户 ${data.usage.customers} · 坐席 ${data.usage.seats} · AI ${data.usage.aiCalls} 次`,
    ];
    for (const line of infoLines) doc.text(line);
    doc.moveDown(0.8);

    doc.fontSize(11).fillColor('#334155').text(`支付记录（${data.periodLabel}）`);
    doc.moveDown(0.4);

    const headerY = doc.y;
    drawPdfTableRow(doc, ['时间', '套餐', '周期', '金额', '状态', '渠道', '订单号'], headerY, true);
    doc.moveDown(0.6);

    let rowY = doc.y;
    const pageBottom = doc.page.height - doc.page.margins.bottom - 120;

    if (!data.paymentRows.length) {
      doc.fontSize(9).fillColor('#64748b').text('所选时间范围内暂无支付记录', { align: 'center' });
    } else {
      for (const row of data.paymentRows) {
        if (rowY > pageBottom) {
          doc.addPage();
          doc.font('zh');
          rowY = doc.page.margins.top;
        }
        drawPdfTableRow(
          doc,
          [row.created_at, row.plan_name, row.billing_cycle, `¥${row.amount}`, row.status, row.channel, row.out_trade_no],
          rowY,
        );
        rowY += 14;
        doc.y = rowY;
      }
    }

    doc.moveDown(1);
    doc.fontSize(11).fillColor('#0c4a6e').text(`期间已支付合计：¥${data.paidTotal}（${data.paidCount} 笔）`, {
      align: 'right',
    });
    doc.moveDown(0.8);
    doc.fontSize(9).fillColor('#0369a1').text(
      '本账单为系统根据订阅与支付记录自动生成，仅供对账与存档。如需增值税发票，请在「套餐计费 → 发票申请」提交。',
      { width: 500 },
    );
    doc.moveDown(0.6);
    doc.fillColor('#94a3b8').fontSize(8).text(
      `计费中心：${data.appUrl}/app/billing · ZhiFlow 企微私域 · 本文件不构成税务发票`,
      { width: 500 },
    );

    doc.end();
  });
}

export async function buildSubscriptionStatementHtml(opts) {
  const data = await gatherSubscriptionStatementData(opts);
  const html = renderSubscriptionStatementHtml(data);
  return {
    html,
    filename: data.htmlFilename,
    bill_no: data.billNo,
    tenant_name: data.tenantName,
    period_label: data.periodLabel,
  };
}

export async function buildSubscriptionStatementPdf(opts) {
  const data = await gatherSubscriptionStatementData(opts);
  const buffer = await renderSubscriptionStatementPdfBuffer(data);
  return {
    buffer,
    filename: data.pdfFilename,
    bill_no: data.billNo,
    tenant_name: data.tenantName,
    period_label: data.periodLabel,
  };
}
