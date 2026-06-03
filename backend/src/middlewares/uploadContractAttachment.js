/**
 * @file 平台合同附件上传（PDF / 图片）。
 */
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

const ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp']);
const MAX_BYTES = 15 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenantId = req.params.tenantId || req.contractUploadTenantId || 'unknown';
    const tradeNo = req.params.outTradeNo || req.contractUploadTradeNo || 'pending';
    const dir = path.join(env.contractUploadDir, String(tenantId), String(tradeNo));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const contractAttachmentUpload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      cb(new Error('仅支持 PDF 与图片（.pdf .png .jpg .jpeg .webp）'));
      return;
    }
    cb(null, true);
  },
});

export function mimeFromExt(ext) {
  const map = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}
