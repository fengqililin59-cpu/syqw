/**
 * @file 租户开票申请与平台处理。
 */
import Joi from 'joi';
import { Op } from 'sequelize';
import {
  BillingInvoiceRequest,
  PaymentRecord,
  Plan,
  Tenant,
  User,
} from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { paginated } from '../utils/response.js';
import { isSmtpConfigured, sendMail } from './mail.service.js';
import { env } from '../config/env.js';

const INVOICE_TYPE_LABELS = {
  vat_special: '增值税专用发票',
  vat_normal: '增值税普通发票',
  electronic: '电子普通发票',
};

const STATUS_LABELS = {
  pending: '待处理',
  processing: '处理中',
  issued: '已开票',
  rejected: '已驳回',
};

const createSchema = Joi.object({
  invoice_type: Joi.string().valid('vat_special', 'vat_normal', 'electronic').default('electronic'),
  title: Joi.string().trim().min(2).max(200).required(),
  tax_no: Joi.string().trim().min(15).max(32).required(),
  amount: Joi.number().positive().max(9999999).optional(),
  email: Joi.string().trim().email().max(120).required(),
  mailing_address: Joi.string().trim().max(255).allow('', null).optional(),
  remark: Joi.string().trim().max(500).allow('', null).optional(),
  payment_record_id: Joi.number().integer().positive().optional(),
}).unknown(false);

const updateSchema = Joi.object({
  status: Joi.string().valid('pending', 'processing', 'issued', 'rejected').required(),
  admin_remark: Joi.string().trim().max(500).allow('', null).optional(),
}).unknown(false);

function mapRow(row) {
  const p = row.get ? row.get({ plain: true }) : row;
  const {
    Tenant: tenantRow,
    PaymentRecord: payRow,
    requester: requesterRow,
    ...rest
  } = p;
  return {
    ...rest,
    amount: Number(rest.amount),
    invoice_type_label: INVOICE_TYPE_LABELS[rest.invoice_type] || rest.invoice_type,
    status_label: STATUS_LABELS[rest.status] || rest.status,
    tenant: tenantRow ? { id: tenantRow.id, name: tenantRow.name } : null,
    payment: payRow
      ? {
          id: payRow.id,
          out_trade_no: payRow.out_trade_no,
          amount: Number(payRow.amount),
          paid_at: payRow.paid_at,
          plan_name: payRow.plan?.name,
        }
      : null,
    requester: requesterRow
      ? {
          id: requesterRow.id,
          username: requesterRow.username,
          real_name: requesterRow.real_name,
        }
      : null,
  };
}

const includeOpts = [
  { model: Tenant, attributes: ['id', 'name'] },
  {
    model: PaymentRecord,
    required: false,
    attributes: ['id', 'out_trade_no', 'amount', 'paid_at', 'status'],
    include: [{ model: Plan, as: 'plan', attributes: ['name'], required: false }],
  },
  { model: User, as: 'requester', attributes: ['id', 'username', 'real_name'], required: false },
];

export async function createInvoiceRequest(auth, body) {
  const { error, value } = createSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const tenantId = Number(auth.tenantId);
  let amount = value.amount != null ? Number(value.amount) : null;
  let paymentRecordId = value.payment_record_id ? Number(value.payment_record_id) : null;

  if (paymentRecordId) {
    const pay = await PaymentRecord.findOne({
      where: { id: paymentRecordId, tenant_id: tenantId, status: 'paid' },
    });
    if (!pay) throw new HttpError(400, '关联订单不存在或未支付', 400);
    if (amount == null) amount = Number(pay.amount);
  }

  if (amount == null || amount <= 0) {
    const lastPaid = await PaymentRecord.findOne({
      where: { tenant_id: tenantId, status: 'paid' },
      order: [['paid_at', 'DESC']],
    });
    if (!lastPaid) throw new HttpError(400, '请填写开票金额或先完成一笔付款', 400);
    amount = Number(lastPaid.amount);
    paymentRecordId = paymentRecordId || lastPaid.id;
  }

  if (value.invoice_type === 'vat_special' && !String(value.mailing_address || '').trim()) {
    throw new HttpError(400, '增值税专用发票需填写邮寄地址', 400);
  }

  const pending = await BillingInvoiceRequest.count({
    where: { tenant_id: tenantId, status: { [Op.in]: ['pending', 'processing'] } },
  });
  if (pending >= 3) {
    throw new HttpError(400, '当前待处理开票申请较多，请等待平台处理后再提交', 400);
  }

  const row = await BillingInvoiceRequest.create({
    tenant_id: tenantId,
    requested_by: auth.userId,
    payment_record_id: paymentRecordId,
    invoice_type: value.invoice_type,
    title: value.title,
    tax_no: value.tax_no,
    amount,
    email: value.email,
    mailing_address: value.mailing_address || null,
    remark: value.remark || null,
    status: 'pending',
  });

  const full = await BillingInvoiceRequest.findByPk(row.id, { include: includeOpts });
  return mapRow(full);
}

export async function listTenantInvoiceRequests(auth, query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(50, Math.max(1, Number(query.size) || 20));

  const { rows, count } = await BillingInvoiceRequest.findAndCountAll({
    where: { tenant_id: Number(auth.tenantId) },
    include: includeOpts,
    order: [['id', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  return paginated(rows.map(mapRow), count, page, size);
}

export async function listPlatformInvoiceRequests(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size) || 30));
  const where = {};
  if (query.status && STATUS_LABELS[query.status]) where.status = query.status;

  const { rows, count } = await BillingInvoiceRequest.findAndCountAll({
    where,
    include: includeOpts,
    order: [['id', 'DESC']],
    limit: size,
    offset: (page - 1) * size,
  });

  return paginated(rows.map(mapRow), count, page, size);
}

export async function updatePlatformInvoiceRequest(requestId, body) {
  const { error, value } = updateSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const row = await BillingInvoiceRequest.findByPk(Number(requestId), { include: includeOpts });
  if (!row) throw new HttpError(404, '申请不存在', 404);

  const patch = {
    status: value.status,
    admin_remark: value.admin_remark ?? row.admin_remark,
  };
  if (value.status === 'issued') patch.issued_at = new Date();

  await row.update(patch);
  const updated = await BillingInvoiceRequest.findByPk(row.id, { include: includeOpts });
  const mapped = mapRow(updated);

  if (isSmtpConfigured() && ['issued', 'rejected'].includes(value.status)) {
    const subject =
      value.status === 'issued'
        ? `【ZhiFlow】发票已开具 · ¥${mapped.amount}`
        : `【ZhiFlow】开票申请未通过`;
    const text = [
      `您好，`,
      value.status === 'issued'
        ? `您提交的开票申请（${mapped.invoice_type_label}，¥${mapped.amount}）已处理完成。`
        : `您提交的开票申请未能通过：${value.admin_remark || '请联系平台客服'}`,
      mapped.admin_remark && value.status === 'issued' ? `备注：${mapped.admin_remark}` : '',
      '',
      `抬头：${mapped.title}`,
      `税号：${mapped.tax_no}`,
      '',
      `${env.appUrl.replace(/\/$/, '')}/app/billing`,
    ]
      .filter(Boolean)
      .join('\n');
    await sendMail({ to: mapped.email, subject, text }).catch((e) => {
      console.warn('[invoice] notify tenant email failed', e?.message);
    });
  }

  return mapped;
}

export async function countPendingInvoiceRequests() {
  return BillingInvoiceRequest.count({ where: { status: 'pending' } });
}

/**
 * 生成简易HTML发票（可打印为PDF）。
 */
export function generateInvoiceHtml(invoice) {
  const row = invoice.get ? invoice.get({ plain: true }) : invoice;
  const tenantName = row.Tenant?.name || row.tenant?.name || '企业';
  const invoiceType = INVOICE_TYPE_LABELS[row.invoice_type] || row.invoice_type;
  const invoiceNo = row.invoice_number || `ZF-${String(row.id).padStart(6, '0')}`;
  const issuedDate = row.issued_at
    ? new Date(row.issued_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const amount = Number(row.amount);

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${invoiceType} - ${row.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 12px; color: #333; padding: 40px; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 18px; margin-bottom: 4px; }
    .header p { font-size: 11px; color: #666; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 16px; }
    .meta-item { flex: 1; }
    .meta-item label { font-size: 10px; color: #888; display: block; }
    .meta-item span { font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: 500; }
    .amount-row td { font-weight: bold; }
    .footer { margin-top: 16px; font-size: 10px; color: #888; }
    .footer p { margin-bottom: 2px; }
    .stamp { float: right; width: 80px; height: 80px; border: 1px dashed #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #ccc; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${invoiceType}</h1>
    <p>发票号码：${invoiceNo}</p>
  </div>
  <div class="meta">
    <div class="meta-item"><label>购买方名称</label><span>${row.title}</span></div>
    <div class="meta-item"><label>纳税人识别号</label><span>${row.tax_no}</span></div>
    <div class="meta-item"><label>开票日期</label><span>${issuedDate}</span></div>
  </div>
  <table>
    <thead>
      <tr><th>项目</th><th>规格</th><th>数量</th><th>单价</th><th>金额</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>ZhiFlow SaaS服务费</td>
        <td>套餐订阅</td>
        <td>1</td>
        <td>${amount.toFixed(2)}</td>
        <td>${amount.toFixed(2)}</td>
      </tr>
      <tr class="amount-row">
        <td colspan="3">合计（大写）：${numberToChinese(amount)}</td>
        <td colspan="2">${amount.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <div class="footer">
    <p>销货方：${tenantName}</p>
    <p>备注：${row.remark || '—'}</p>
    <p>本发票由ZhiFlow平台代开具，电子发票与纸质发票具有同等法律效力。</p>
  </div>
</body>
</html>`;
}

/**
 * 数字转中文大写（简化版，用于发票）。
 */
function numberToChinese(n) {
  if (!n || n === 0) return '零元整';
  const digits = '零壹贰叁肆伍陆柒捌玖';
  const units = ['', '拾', '佰', '仟', '万'];
  const yuan = Math.floor(n);
  const jiao = Math.round((n - yuan) * 100);
  if (yuan === 0 && jiao === 0) return '零元整';
  let result = '';
  if (yuan > 0) {
    const s = String(yuan);
    for (let i = 0; i < s.length; i++) {
      const d = parseInt(s[i]);
      const u = s.length - i - 1;
      if (d === 0) { if (result && !result.endsWith('零')) result += '零'; }
      else result += digits[d] + units[u % 4] + (u >= 4 && u % 4 === 0 ? '万' : '');
    }
    result += '元';
  }
  if (jiao > 0) {
    const j = Math.floor(jiao / 10);
    const f = jiao % 10;
    if (j > 0) result += digits[j] + '角';
    if (f > 0) result += digits[f] + '分';
  } else {
    result += '整';
  }
  return result;
}
