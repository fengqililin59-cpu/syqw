/**
 * @file 全局错误处理中间件：HttpError 与未知异常分流。
 * @description 数据库连接类错误不向客户端暴露内部地址/栈，避免误导且更安全。
 */
import { fail } from '../utils/response.js';
import { HttpError } from '../utils/httpError.js';

function isDatabaseConnectivityError(err) {
  const name = err?.name || '';
  const msg = String(err?.message || '');
  const code = err?.parent?.code || err?.original?.code;
  return (
    name.includes('SequelizeConnection') ||
    name === 'SequelizeTimeoutError' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('connect ETIMEDOUT') ||
    msg.includes('getaddrinfo ENOTFOUND')
  );
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof HttpError) {
    return fail(res, err.code, err.message, err.details, err.status);
  }
  /** multer 文件类型不符合（uploadCsv 内文案） */
  if (err?.message === '请上传 .csv 文件') {
    return fail(res, 400, err.message, null, 400);
  }
  console.error(err);
  if (isDatabaseConnectivityError(err)) {
    return fail(
      res,
      503,
      '数据库未连接或不可访问。请在本机启动 MySQL（默认 3306），或在项目根目录执行：docker compose up -d mysql，并核对 backend/.env 中的 DB_HOST、DB_PORT、DB_USER、DB_PASSWORD。',
      null,
      503,
    );
  }
  const message = err.message || 'Internal Server Error';
  return fail(res, 500, message, null, 500);
}
