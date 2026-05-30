/**
 * @file 迁移名单导入：CSV / Excel（内存）。
 */
import multer from 'multer';

const storage = multer.memoryStorage();

export const migrationImportUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname || '';
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      /\.(csv|xlsx?)$/i.test(name);
    if (ok) cb(null, true);
    else cb(new Error('请上传 .csv 或 .xlsx 文件'));
  },
});
