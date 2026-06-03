/**
 * @file 通用 SMTP 发信（复用注册验证码 SMTP 配置）。
 */
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export function isSmtpConfigured() {
  return Boolean(env.registerOtp.smtpHost && (env.registerOtp.smtpFrom || env.registerOtp.smtpUser));
}

function createTransport() {
  if (!isSmtpConfigured()) {
    throw new HttpError(503, '未配置 SMTP 发信', 503);
  }
  return nodemailer.createTransport({
    host: env.registerOtp.smtpHost,
    port: env.registerOtp.smtpPort,
    secure: env.registerOtp.smtpSecure,
    auth:
      env.registerOtp.smtpUser && env.registerOtp.smtpPass
        ? { user: env.registerOtp.smtpUser, pass: env.registerOtp.smtpPass }
        : undefined,
  });
}

/**
 * @param {{
 *   to: string;
 *   subject: string;
 *   text: string;
 *   html?: string;
 *   attachments?: { filename: string; content: Buffer | string }[];
 * }} opts
 */
export async function sendMail(opts) {
  const to = String(opts.to || '').trim();
  if (!to) throw new HttpError(400, '收件邮箱无效', 400);
  const transport = createTransport();
  await transport.sendMail({
    from: env.registerOtp.smtpFrom || env.registerOtp.smtpUser,
    to,
    subject: String(opts.subject || 'ZhiFlow 通知').slice(0, 200),
    text: opts.text,
    html: opts.html || undefined,
    attachments: opts.attachments,
  });
  return { to };
}
