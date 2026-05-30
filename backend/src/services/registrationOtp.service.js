/**
 * @file 注册验证码：生成、发送、校验（邮箱 SMTP / 短信 HTTP Webhook / 阿里云 SMS）。
 */
import { createHash, randomInt } from 'crypto';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { RegistrationOtpChallenge } from '../models/registrationOtpChallenge.model.js';
import * as aliyunSms from './aliyunSms.service.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;

const sendCooldown = new Map();

function hashOtp(code) {
  return createHash('sha256')
    .update(`${code}:${env.jwt.secret}:register_otp`)
    .digest('hex');
}

function normalizeEmail(s) {
  return String(s || '')
    .trim()
    .toLowerCase();
}

/** 中国大陆 11 位手机号 */
function normalizeCnMobile(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (!/^1[3-9]\d{9}$/.test(d)) return null;
  return d;
}

export function isRegisterOtpEnabled() {
  return true;
}

export function getRegisterOtpChannels() {
  const ch = [];
  if (env.registerOtp.smtpHost && (env.registerOtp.smtpFrom || env.registerOtp.smtpUser)) ch.push('email');
  // SMS 优先级：Aliyun > Webhook
  if (env.registerOtp.aliyunKeyId && env.registerOtp.aliyunKeySecret && env.registerOtp.aliyunTemplateCode) {
    ch.push('sms');
  } else if (env.registerOtp.smsWebhookUrl) {
    ch.push('sms');
  }
  // 开发环境兜底：未配置真实通道时，仍允许邮箱/短信两种验证码流程联调
  if (env.nodeEnv !== 'production') {
    if (!ch.includes('email')) ch.push('email');
    if (!ch.includes('sms')) ch.push('sms');
  }
  return ch;
}

function assertChannelConfigured(channel) {
  if (channel === 'email' && (!env.registerOtp.smtpHost || (!env.registerOtp.smtpFrom && !env.registerOtp.smtpUser))) {
    throw new HttpError(503, '未配置发信（SMTP），无法发送邮箱验证码', 503);
  }
  if (channel === 'sms') {
    const hasAliyun = env.registerOtp.aliyunKeyId && env.registerOtp.aliyunKeySecret && env.registerOtp.aliyunTemplateCode;
    const hasWebhook = env.registerOtp.smsWebhookUrl;
    if (!hasAliyun && !hasWebhook) {
      throw new HttpError(503, '未配置短信服务（阿里云 SMS 或 Webhook），无法发送短信验证码', 503);
    }
  }
}

async function sendEmailOtp(to, code) {
  const t = nodemailer.createTransport({
    host: env.registerOtp.smtpHost,
    port: env.registerOtp.smtpPort,
    secure: env.registerOtp.smtpSecure,
    auth:
      env.registerOtp.smtpUser && env.registerOtp.smtpPass
        ? { user: env.registerOtp.smtpUser, pass: env.registerOtp.smtpPass }
        : undefined,
  });
  await t.sendMail({
    from: env.registerOtp.smtpFrom || env.registerOtp.smtpUser,
    to,
    subject: env.registerOtp.mailSubject || '企微私域 SaaS 注册验证码',
    text: `您的注册验证码为：${code}，${Math.floor(OTP_TTL_MS / 60000)} 分钟内有效。请勿告知他人。`,
  });
}

async function sendSmsAliyun(phone, code) {
  // 创建虚拟 tenant 对象，包含 SMS 凭证
  const virtualTenant = {
    sms_access_key_id: env.registerOtp.aliyunKeyId,
    sms_access_key_secret: env.registerOtp.aliyunKeySecret,
  };
  const result = await aliyunSms.sendSms(virtualTenant, {
    phone,
    signName: env.registerOtp.aliyunSignName || '企微私域',
    templateCode: env.registerOtp.aliyunTemplateCode,
    templateParam: { code },
  });
  if (result.Code !== 'OK') {
    throw new Error(`阿里云 SMS 返回异常：${result.Code} ${result.Message || ''}`);
  }
}

async function sendSmsWebhook(phone, code) {
  const url = env.registerOtp.smsWebhookUrl;
  const headers = { 'Content-Type': 'application/json' };
  if (env.registerOtp.smsWebhookAuth) {
    headers.Authorization = env.registerOtp.smsWebhookAuth;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ phone, code, purpose: 'register' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new HttpError(502, `短信网关返回异常：${res.status} ${t.slice(0, 200)}`, 502);
  }
}

export async function sendRegisterOtp({ channel, target }, clientIp) {
  const channels = getRegisterOtpChannels();
  if (channels.length === 0) {
    // 开发环境兜底：未配置真实通道时允许生成验证码用于本地联调
    if (env.nodeEnv !== 'production') {
      let normalized;
      if (channel === 'email') {
        normalized = normalizeEmail(target);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
          throw new HttpError(400, '邮箱格式不正确', 400);
        }
      } else if (channel === 'sms') {
        normalized = normalizeCnMobile(target);
        if (!normalized) throw new HttpError(400, '请输入有效的中国大陆手机号', 400);
      } else {
        throw new HttpError(400, `不支持的发送渠道：${channel}`, 400);
      }

      const code = String(randomInt(100000, 1000000));
      await RegistrationOtpChallenge.create({
        channel,
        target: normalized,
        code_hash: hashOtp(code),
        expires_at: new Date(Date.now() + OTP_TTL_MS),
      });
      return {
        ok: true,
        expiresInSec: Math.floor(OTP_TTL_MS / 1000),
        devMode: true,
        devCode: code,
      };
    }
    throw new HttpError(503, '已开启注册验证码但未配置 SMTP 或 SMS_WEBHOOK_URL', 503);
  }
  if (!channels.includes(channel)) {
    throw new HttpError(400, `不支持的发送渠道：${channel}`, 400);
  }
  if (env.nodeEnv === 'production') {
    assertChannelConfigured(channel);
  }

  let normalized;
  if (channel === 'email') {
    normalized = normalizeEmail(target);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new HttpError(400, '邮箱格式不正确', 400);
    }
  } else {
    normalized = normalizeCnMobile(target);
    if (!normalized) throw new HttpError(400, '请输入有效的中国大陆手机号', 400);
  }

  const coolKey = `${clientIp || 'unknown'}:${channel}:${normalized}`;
  const last = sendCooldown.get(coolKey) || 0;
  if (env.nodeEnv === 'production' && Date.now() - last < SEND_COOLDOWN_MS) {
    throw new HttpError(429, '发送过于频繁，请稍后再试', 429);
  }
  sendCooldown.set(coolKey, Date.now());

  const code = String(randomInt(100000, 1000000));
  const codeHash = hashOtp(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await RegistrationOtpChallenge.create({
    channel,
    target: normalized,
    code_hash: codeHash,
    expires_at: expiresAt,
  });

  try {
    if (channel === 'email') {
      await sendEmailOtp(normalized, code);
    } else {
      // SMS 优先级：Aliyun > Webhook
      const hasAliyun = env.registerOtp.aliyunKeyId && env.registerOtp.aliyunKeySecret && env.registerOtp.aliyunTemplateCode;
      if (hasAliyun) {
        await sendSmsAliyun(normalized, code);
      } else {
        await sendSmsWebhook(normalized, code);
      }
    }
  } catch (err) {
    // 开发环境兜底：已配置通道但发送失败时，返回 devCode 继续本地联调
    if (env.nodeEnv !== 'production') {
      return {
        ok: true,
        expiresInSec: Math.floor(OTP_TTL_MS / 1000),
        devMode: true,
        devCode: code,
        devReason: String(err?.message || 'send_failed'),
      };
    }
    throw err;
  }

  return { ok: true, expiresInSec: Math.floor(OTP_TTL_MS / 1000) };
}

export async function consumeRegisterOtpIfValid({ channel, target, code }) {
  const normalized =
    channel === 'email' ? normalizeEmail(target) : normalizeCnMobile(target);
  if (!normalized) {
    throw new HttpError(400, channel === 'email' ? '邮箱格式不正确' : '手机号格式不正确', 400);
  }
  const expectHash = hashOtp(String(code).trim());
  const row = await RegistrationOtpChallenge.findOne({
    where: { channel, target: normalized, consumed_at: null },
    order: [['id', 'DESC']],
  });
  if (!row) {
    throw new HttpError(400, '请先获取验证码', 400);
  }
  if (new Date(row.expires_at) < new Date()) {
    throw new HttpError(400, '验证码已过期，请重新获取', 400);
  }
  if (row.code_hash !== expectHash) {
    throw new HttpError(400, '验证码错误', 400);
  }
  await row.update({ consumed_at: new Date() });
}
