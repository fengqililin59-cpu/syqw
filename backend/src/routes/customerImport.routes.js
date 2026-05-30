/**
 * @file 客户批量导入路由。
 */
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { HttpError } from '../utils/httpError.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as importController from '../controllers/customerImport.controller.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = `/tmp/imports/${req.auth?.tenantId || 'unknown'}`;
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `tmp_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv', '.numbers'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('只支持 .xlsx .xls .csv 格式（Numbers 用户请先导出为 Excel 或 CSV）'));
  },
});

const router = Router();
router.use(requireAuth);

router.get('/history', requirePerm('customer:import'), asyncHandler(importController.listHistory));

router.post(
  '/upload',
  requirePerm('customer:import'),
  (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      if (err) return next(new HttpError(400, err.message || '上传失败', 400));
      return next();
    }),
  asyncHandler(importController.uploadAndParse),
);

router.post('/:jobId/confirm', requirePerm('customer:import'), asyncHandler(importController.confirmImport));
router.get('/:jobId/status', requirePerm('customer:import'), asyncHandler(importController.getStatus));
router.get('/:jobId/result', requirePerm('customer:import'), asyncHandler(importController.getResult));

export default router;
