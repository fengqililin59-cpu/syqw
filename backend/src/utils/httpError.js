/**
 * @file 业务/校验异常类型，供错误处理中间件识别 HTTP 状态码与业务 code。
 */
export class HttpError extends Error {
  /**
   * @param {number} status HTTP 状态码
   * @param {string} message 提示文案
   * @param {number} [code] 业务 code，默认与 status 相同
   * @param {unknown} [details] 额外信息（校验错误等）
   */
  constructor(status, message, code = status, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
