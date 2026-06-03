/**
 * @file 平台方批量导出租户订阅账单 PDF（ZIP）。
 */
import { PassThrough } from 'node:stream';
import archiver from 'archiver';
import dayjs from 'dayjs';
import { Op, fn, col } from 'sequelize';
import { HttpError } from '../utils/httpError.js';
import { PaymentRecord, Plan, Subscription, Tenant } from '../models/index.js';
import {
  buildSubscriptionStatementPdf,
  resolveBillingPdfFontPath,
} from './billingStatement.service.js';

const SCOPE_LABELS = {
  paid_in_month: '当月有已支付订单',
  active_paid: '当前付费订阅使用中',
};

/**
 * @param {string} monthKey YYYY-MM
 * @param {'paid_in_month'|'active_paid'} scope
 */
export async function resolveTenantIdsForStatementExport(monthKey, scope = 'paid_in_month') {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new HttpError(400, 'month 须为 YYYY-MM', 400);
  }

  let tenantIds = [];

  if (scope === 'active_paid') {
    const subs = await Subscription.findAll({
      where: { status: 'active' },
      attributes: ['tenant_id'],
      include: [
        {
          model: Plan,
          as: 'plan',
          required: true,
          attributes: ['code'],
          where: { code: { [Op.ne]: 'free' } },
        },
      ],
    });
    tenantIds = subs.map((s) => s.tenant_id);
  } else {
    const start = dayjs(`${monthKey}-01`).startOf('month').toDate();
    const end = dayjs(`${monthKey}-01`).endOf('month').toDate();
    const rows = await PaymentRecord.findAll({
      attributes: [[fn('DISTINCT', col('tenant_id')), 'tenant_id']],
      where: {
        status: 'paid',
        [Op.or]: [
          { paid_at: { [Op.between]: [start, end] } },
          {
            paid_at: null,
            created_at: { [Op.between]: [start, end] },
          },
        ],
      },
      raw: true,
    });
    tenantIds = rows.map((r) => Number(r.tenant_id)).filter((id) => id > 0);
  }

  if (!tenantIds.length) return [];

  const tenants = await Tenant.findAll({
    where: { id: { [Op.in]: tenantIds }, status: 1 },
    attributes: ['id', 'name'],
    order: [['name', 'ASC']],
  });
  return tenants.map((t) => t.id);
}

/**
 * @param {{ month: string; scope?: string; maxTenants?: number; tenantIds?: number[] }} opts
 */
export async function buildPlatformTenantStatementsZip(opts) {
  const monthKey = String(opts.month || '').trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new HttpError(400, '请指定 month=YYYY-MM', 400);
  }

  if (!resolveBillingPdfFontPath()) {
    throw new HttpError(
      503,
      '未配置 PDF 中文字体，无法批量导出。请设置 BILLING_PDF_FONT_PATH，详见 backend/assets/fonts/README.md',
      503,
    );
  }

  const scope = opts.scope === 'active_paid' ? 'active_paid' : 'paid_in_month';
  const maxTenants = Math.min(100, Math.max(1, Number(opts.maxTenants) || 50));

  let tenantIds = Array.isArray(opts.tenantIds)
    ? opts.tenantIds.map((id) => Number(id)).filter((id) => id > 0)
    : await resolveTenantIdsForStatementExport(monthKey, scope);

  const totalMatched = tenantIds.length;
  if (totalMatched > maxTenants) {
    tenantIds = tenantIds.slice(0, maxTenants);
  }

  if (!tenantIds.length) {
    throw new HttpError(404, `该范围（${SCOPE_LABELS[scope]}）内没有可导出的租户`, 404);
  }

  const manifestLines = [
    'tenant_id,tenant_name,filename,status,paid_total,error',
  ];
  const errors = [];
  let successCount = 0;

  const archive = archiver('zip', { zlib: { level: 6 } });
  const stream = new PassThrough();
  const chunks = [];

  const bufferPromise = new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    archive.on('error', reject);
  });

  archive.pipe(stream);

  for (const tenantId of tenantIds) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const pdf = await buildSubscriptionStatementPdf({ tenantId, month: monthKey });
      const folderName = `statements/${pdf.filename}`;
      archive.append(pdf.buffer, { name: folderName });
      successCount += 1;
      const safeName = (pdf.tenant_name || '').replace(/,/g, ' ');
      manifestLines.push(
        `${tenantId},${safeName},${pdf.filename},ok,,`,
      );
    } catch (e) {
      const msg = e?.message || String(e);
      errors.push({ tenant_id: tenantId, error: msg });
      manifestLines.push(`${tenantId},,,failed,,${msg.replace(/,/g, ';')}`);
    }
  }

  const readme = [
    `ZhiFlow 平台批量账单导出`,
    `账单月份：${monthKey}`,
    `筛选：${SCOPE_LABELS[scope]}`,
    `匹配租户：${totalMatched}（本次导出 ${tenantIds.length}，成功 ${successCount}）`,
    `生成时间：${dayjs().format('YYYY-MM-DD HH:mm')}`,
    totalMatched > maxTenants ? `提示：已截断至最多 ${maxTenants} 家，请缩小范围或分批导出。` : '',
    errors.length ? `失败 ${errors.length} 家，详见 manifest.csv` : '',
  ]
    .filter(Boolean)
    .join('\n');

  archive.append(readme, { name: 'README.txt' });
  archive.append(`${manifestLines.join('\n')}\n`, { name: 'manifest.csv' });
  await archive.finalize();
  const buffer = await bufferPromise;

  const filename = `ZhiFlow-租户账单-${monthKey}-${successCount}份.zip`;

  return {
    buffer,
    filename,
    month: monthKey,
    scope,
    scope_label: SCOPE_LABELS[scope],
    total_matched: totalMatched,
    exported_count: tenantIds.length,
    success_count: successCount,
    failed_count: errors.length,
    errors,
    truncated: totalMatched > maxTenants,
  };
}
