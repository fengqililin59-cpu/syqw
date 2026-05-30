/**
 * @file CSV 上传（内存缓冲，供 import-csv 使用）。
 */
import multer from 'multer';

const storage = multer.memoryStorage();

export const csvUpload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      /\.csv$/i.test(file.originalname || '');
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error('请上传 .csv 文件'));
    }
  },
});
