/**
 * @file 平台合同开单附件：上传、列表、下载。
 */
import path from 'node:path';
import fs from 'node:fs';
import { BillingContractAttachment, PaymentRecord } from '../models/index.js';
import { HttpError } from '../utils/httpError.js';
import { env } from '../config/env.js';
import { mimeFromExt } from '../middlewares/uploadContractAttachment.js';

const MAX_PER_ORDER = 10;

function mapRow(row) {
  const p = row.get ? row.get({ plain: true }) : row;
  return {
    id: p.id,
    tenant_id: p.tenant_id,
    payment_record_id: p.payment_record_id,
    out_trade_no: p.out_trade_no,
    original_name: p.original_name,
    mime_type: p.mime_type,
    size_bytes: p.size_bytes,
    created_at: p.created_at,
    download_path: `/platform/payments/${encodeURIComponent(p.out_trade_no)}/attachments/${p.id}/download`,
  };
}

function resolveDiskPath(row) {
  return path.join(env.contractUploadDir, String(row.tenant_id), row.out_trade_no, row.stored_name);
}

async function getPaymentByTradeNo(outTradeNo) {
  const trade = String(outTradeNo || '').trim();
  if (!trade) throw new HttpError(400, '订单号无效', 400);
  const pay = await PaymentRecord.findOne({ where: { out_trade_no: trade } });
  if (!pay) throw new HttpError(404, '订单不存在', 404);
  return pay;
}

export async function listContractAttachments(outTradeNo) {
  const pay = await getPaymentByTradeNo(outTradeNo);
  const rows = await BillingContractAttachment.findAll({
    where: { payment_record_id: pay.id },
    order: [['id', 'ASC']],
  });
  return rows.map(mapRow);
}

export async function saveContractAttachment(auth, outTradeNo, file) {
  if (!file) throw new HttpError(400, '请选择文件', 400);

  const pay = await getPaymentByTradeNo(outTradeNo);
  const count = await BillingContractAttachment.count({ where: { payment_record_id: pay.id } });
  if (count >= MAX_PER_ORDER) {
    if (file.path) fs.unlink(file.path, () => {});
    throw new HttpError(400, `每个订单最多 ${MAX_PER_ORDER} 个附件`, 400);
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const storedName = path.basename(file.path);
  const relativeStored = path.join(String(pay.tenant_id), pay.out_trade_no, storedName);

  const row = await BillingContractAttachment.create({
    tenant_id: pay.tenant_id,
    payment_record_id: pay.id,
    out_trade_no: pay.out_trade_no,
    uploaded_by: auth?.userId ?? null,
    original_name: String(file.originalname || 'attachment').slice(0, 255),
    stored_name: storedName,
    mime_type: file.mimetype || mimeFromExt(ext),
    size_bytes: Number(file.size) || 0,
  });

  return mapRow(row);
}

export async function getContractAttachmentFile(outTradeNo, attachmentId) {
  const pay = await getPaymentByTradeNo(outTradeNo);
  const row = await BillingContractAttachment.findOne({
    where: { id: Number(attachmentId), payment_record_id: pay.id },
  });
  if (!row) throw new HttpError(404, '附件不存在', 404);

  const disk = resolveDiskPath(row);
  if (!fs.existsSync(disk)) throw new HttpError(404, '附件文件已丢失', 404);

  return { row, disk };
}

export async function countAttachmentsForPayments(paymentIds) {
  if (!paymentIds?.length) return {};
  const rows = await BillingContractAttachment.findAll({
    attributes: ['payment_record_id'],
    where: { payment_record_id: paymentIds },
    raw: true,
  });
  const map = {};
  for (const r of rows) {
    map[r.payment_record_id] = (map[r.payment_record_id] || 0) + 1;
  }
  return map;
}
