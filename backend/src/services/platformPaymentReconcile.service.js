/**
 * @file 平台方：全站支付对账导出（CSV / Excel）。
 */
import Joi from 'joi';
import dayjs from 'dayjs';
import { Op } from 'sequelize';
import XLSX from 'xlsx';
import { HttpError } from '../utils/httpError.js';
import { PaymentRecord, Plan, Tenant } from '../models/index.js';
import * as contractAttachmentService from './contractAttachment.service.js';
import { isSmtpConfigured, sendMail } from './mail.service.js';
import { resolveDigestEmailRecipients } from './platformOpsDigest.service.js';

const MAX_ROWS = 5000;

const querySchema = Joi.object({
  from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: Joi.string().valid('pending', 'paid', 'failed', 'refunded', '').optional(),
  pay_channel: Joi.string().valid('wechat', 'alipay', 'manual', '').optional(),
  date_field: Joi.string().valid('created_at', 'paid_at').default('created_at'),
  format: Joi.string().valid('csv', 'xlsx').default('csv'),
}).unknown(false);

const STATUS_LABELS = {
  pending: '待确认',
  paid: '已支付',
  failed: '失败',
  refunded: '已退款',
};

const CHANNEL_LABELS = {
  wechat: '微信',
  alipay: '支付宝',
  manual: '线下/人工',
};

function csvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowToCsv(cells) {
  return cells.map(csvCell).join(',');
}

function parseQuery(query = {}) {
  const { error, value } = querySchema.validate(query || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const to = value.to ? dayjs(value.to).endOf('day').toDate() : dayjs().endOf('day').toDate();
  const from = value.from
    ? dayjs(value.from).startOf('day').toDate()
    : dayjs(to).subtract(90, 'day').startOf('day').toDate();

  if (from > to) throw new HttpError(400, '开始日期不能晚于结束日期', 400);

  return { value, from, to };
}

async function fetchReconcileRows(filters) {
  const { value, from, to } = filters;
  const dateField = value.date_field === 'paid_at' ? 'paid_at' : 'created_at';
  const where = {
    [dateField]: { [Op.between]: [from, to] },
  };
  if (value.status) where.status = value.status;
  if (value.pay_channel) where.pay_channel = value.pay_channel;

  const rows = await PaymentRecord.findAll({
    where,
    include: [
      { model: Plan, as: 'plan', attributes: ['name', 'code'], required: false },
      { model: Tenant, attributes: ['id', 'name'], required: false },
    ],
    order: [['id', 'DESC']],
    limit: MAX_ROWS + 1,
  });

  if (rows.length > MAX_ROWS) {
    throw new HttpError(400, `导出条数超过 ${MAX_ROWS}，请缩小日期范围或增加筛选条件`, 400);
  }

  const attCounts = await contractAttachmentService.countAttachmentsForPayments(rows.map((r) => r.id));

  const detailRows = [];
  let sumPaid = 0;
  let countPaid = 0;

  for (const r of rows) {
    const p = r.get({ plain: true });
    const amount = Number(p.amount);
    if (p.status === 'paid') {
      sumPaid += amount;
      countPaid += 1;
    }
    detailRows.push({
      订单ID: p.id,
      创建时间: p.created_at ? dayjs(p.created_at).format('YYYY-MM-DD HH:mm:ss') : '',
      支付时间: p.paid_at ? dayjs(p.paid_at).format('YYYY-MM-DD HH:mm:ss') : '',
      企业: p.Tenant?.name || '',
      租户ID: p.tenant_id,
      套餐: p.plan?.name || '',
      套餐编码: p.plan?.code || '',
      周期: p.billing_cycle === 'yearly' ? '年付' : '月付',
      '金额(元)': amount,
      币种: p.currency || 'CNY',
      状态: STATUS_LABELS[p.status] || p.status,
      支付渠道: CHANNEL_LABELS[p.pay_channel] || p.pay_channel,
      商户订单号: p.out_trade_no,
      '微信/三方单号': p.wechat_transaction_id || '',
      合同附件数: attCounts[p.id] || 0,
      备注: p.remark || '',
    });
  }

  const dateFieldLabel = value.date_field === 'paid_at' ? '支付时间' : '创建时间';
  const summary = {
    total: rows.length,
    paid_count: countPaid,
    paid_amount: Math.round(sumPaid * 100) / 100,
    from: dayjs(from).format('YYYY-MM-DD'),
    to: dayjs(to).format('YYYY-MM-DD'),
    generated_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    date_field_label: dateFieldLabel,
    status_label: value.status ? STATUS_LABELS[value.status] : '全部',
    channel_label: value.pay_channel ? CHANNEL_LABELS[value.pay_channel] : '全部',
  };

  return { detailRows, summary, from, to, value };
}

export async function buildPaymentsReconcileExport(query = {}) {
  const filters = parseQuery(query);
  const { detailRows, summary, from, to, value } = await fetchReconcileRows(filters);
  const baseName = `zhiflow-payments_${dayjs(from).format('YYYYMMDD')}-${dayjs(to).format('YYYYMMDD')}`;

  if (value.format === 'xlsx') {
    const summarySheet = XLSX.utils.json_to_sheet([
      { 项目: '生成时间', 值: summary.generated_at },
      { 项目: '日期依据', 值: summary.date_field_label },
      { 项目: '区间', 值: `${summary.from} ~ ${summary.to}` },
      { 项目: '筛选状态', 值: summary.status_label },
      { 项目: '筛选渠道', 值: summary.channel_label },
      { 项目: '导出笔数', 值: summary.total },
      { 项目: '已支付笔数', 值: summary.paid_count },
      { 项目: '已支付合计(元)', 值: summary.paid_amount },
    ]);
    const detailSheet = XLSX.utils.json_to_sheet(
      detailRows.length ? detailRows : [{ 订单ID: '', 商户订单号: '' }],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, summarySheet, '汇总');
    XLSX.utils.book_append_sheet(wb, detailSheet, '订单明细');
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    return {
      format: 'xlsx',
      buffer,
      filename: `${baseName}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      summary,
    };
  }

  const header = Object.keys(detailRows[0] || { 订单ID: '' });
  const dataLines = detailRows.map((row) => rowToCsv(header.map((k) => row[k])));
  const metaLines = [
    `# ZhiFlow 支付对账导出`,
    `# 生成时间,${summary.generated_at}`,
    `# 日期字段,${summary.date_field_label}`,
    `# 区间,${summary.from} ~ ${summary.to}`,
    `# 筛选状态,${summary.status_label}`,
    `# 筛选渠道,${summary.channel_label}`,
    `# 导出笔数,${summary.total}`,
    `# 已支付笔数,${summary.paid_count}`,
    `# 已支付合计(元),${summary.paid_amount.toFixed(2)}`,
    '',
  ];

  const csv = [...metaLines, rowToCsv(header), ...dataLines].join('\n');

  return {
    format: 'csv',
    csv,
    filename: `${baseName}.csv`,
    contentType: 'text/csv; charset=utf-8',
    summary,
  };
}

/** @deprecated 使用 buildPaymentsReconcileExport */
export async function buildPaymentsReconcileCsv(query = {}) {
  const r = await buildPaymentsReconcileExport({ ...query, format: 'csv' });
  return { csv: r.csv, filename: r.filename, summary: r.summary };
}

/**
 * 自然月区间；month 为 YYYY-MM，默认上一自然月。
 */
export function resolveReconcileMonthRange(month) {
  const m = String(month || '').trim();
  const base = m && /^\d{4}-\d{2}$/.test(m) ? dayjs(`${m}-01`) : dayjs().subtract(1, 'month');
  const start = base.startOf('month');
  const end = base.endOf('month');
  return {
    from: start.format('YYYY-MM-DD'),
    to: end.format('YYYY-MM-DD'),
    label: start.format('YYYY年MM月'),
    month_key: start.format('YYYY-MM'),
  };
}

/**
 * 将上月（或指定月）对账 Excel 邮件发给平台运营邮箱。
 */
export async function sendMonthlyPaymentReconcileEmail(options = {}) {
  if (!isSmtpConfigured()) {
    return { sent: 0, skipped: 'smtp_not_configured' };
  }

  const recipients = await resolveDigestEmailRecipients();
  if (!recipients.length) {
    return { sent: 0, skipped: 'no_email_recipients' };
  }

  const range = resolveReconcileMonthRange(options.month);
  const exportResult = await buildPaymentsReconcileExport({
    from: range.from,
    to: range.to,
    date_field: 'paid_at',
    format: 'xlsx',
  });

  const { summary } = exportResult;
  const subject = `ZhiFlow ${range.label} 支付对账表`;
  const text = [
    `您好，`,
    ``,
    `附件为 ${range.label} 全站支付对账明细（按支付时间统计）。`,
    `导出笔数：${summary.total}，已支付 ${summary.paid_count} 笔，合计 ¥${summary.paid_amount.toLocaleString('zh-CN')}.`,
    ``,
    `区间：${summary.from} ~ ${summary.to}`,
    `也可在平台后台「订单与兑换码」中手动导出 CSV / Excel。`,
  ].join('\n');

  const html = `<p>附件为 <strong>${range.label}</strong> 支付对账表（Excel）。</p>
<ul>
<li>导出笔数：${summary.total}</li>
<li>已支付：${summary.paid_count} 笔，合计 ¥${summary.paid_amount.toLocaleString('zh-CN')}</li>
<li>统计区间：${summary.from} ~ ${summary.to}（按支付时间）</li>
</ul>
<p style="font-size:12px;color:#64748b">由 ZhiFlow 平台定时任务自动发送。</p>`;

  const targets = [];
  for (const to of recipients) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendMail({
        to,
        subject,
        text,
        html,
        attachments: [
          {
            filename: exportResult.filename,
            content: exportResult.buffer,
          },
        ],
      });
      targets.push({ email: to, sent: true });
    } catch (e) {
      console.error('[paymentReconcile] email failed', to, e);
      targets.push({ email: to, sent: false, reason: e?.message || 'send_failed' });
    }
  }

  return {
    sent: targets.filter((t) => t.sent).length,
    targets,
    month: range.month_key,
    summary,
    filename: exportResult.filename,
  };
}
