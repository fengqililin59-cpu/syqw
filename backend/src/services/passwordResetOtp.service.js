/**
 * @file 忘记密码：短信 OTP（与注册 OTP 隔离存储键与哈希盐；不依赖 REGISTER_OTP_REQUIRED）。
 *
 * 运维应急（ECS MySQL，勿写入代码库明文密码）：
 *   node -e "const b=require('bcryptjs');b.hash('YOUR_NEW_PASSWORD',10).then(h=>console.log(h))"
 *   UPDATE users SET password_hash='<bcrypt_hash>' WHERE tenant_id=10000 AND (username='13291419021' OR phone='13291419021') AND status=1 LIMIT 1;
 */
import { createHash, randomInt } from 'crypto';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { RegistrationOtpChallenge, User, Tenant } from '../models/index.js';
import * as aliyunSms from './aliyunSms.service.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const TARGET_PREFIX = 'pwd_reset:';

const sendCooldown = new Map();

function hashOtp(code) {
  return createHash('sha256')
    .update(`${code}:${env.jwt.secret}:password_reset_otp`)
    .digest('hex');
}

/** 中国大陆 11 位手机号 */
export function normalizeCnMobile(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (!/^1[3-9]\d{9}$/.test(d)) return null;
  return d;
}

function otpStorageTarget(phone) {
  return `${TARGET_PREFIX}${phone}`;
}

function assertSmsConfigured() {
  const hasAliyun =
    env.registerOtp.aliyunKeyId && env.registerOtp.aliyunKeySecret && env.registerOtp.aliyunTemplateCode;
  const hasWebhook = env.registerOtp.smsWebhookUrl;
  if (!hasAliyun && !hasWebhook) {
    if (env.nodeEnv !== 'production') return;
    throw new HttpError(503, '未配置短信服务（阿里云 SMS 或 Webhook），无法发送重置验证码', 503);
  }
}

async function sendSmsAliyun(phone, code) {
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
    body: JSON.stringify({ phone, code, purpose: 'password_reset' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new HttpError(502, `短信网关返回异常：${res.status} ${t.slice(0, 200)}`, 502);
  }
}

function buildPhoneIdentityWhere(phone) {
  const digits = phone;
  return {
    [Op.or]: [{ username: digits }, { phone: digits }],
  };
}

/**
 * 按手机号查找可重置的账号；多企业且未指定 tenant_id 时返回 409 列表。
 * @returns {{ users: import('sequelize').Model[], tenants?: { tenant_id: number, tenant_name: string }[] }}
 */
export async function resolveUsersForPasswordReset({ phone, tenant_id }) {
  const normalized = normalizeCnMobile(phone);
  if (!normalized) {
    throw new HttpError(400, '请输入有效的中国大陆手机号', 400);
  }

  const where = { status: 1, ...buildPhoneIdentityWhere(normalized) };
  if (tenant_id != null) {
    where.tenant_id = tenant_id;
  }

  const users = await User.findAll({
    where,
    include: [{ model: Tenant, attributes: ['id', 'name'] }],
    limit: 20,
  });

  if (users.length === 0) {
    throw new HttpError(404, '未找到该手机号对应的账号', 404);
  }

  if (tenant_id == null && users.length > 1) {
    const byTenant = new Map();
    for (const u of users) {
      const tid = Number(u.tenant_id);
      if (!byTenant.has(tid)) {
        byTenant.set(tid, {
          tenant_id: tid,
          tenant_name: u.Tenant?.name || '',
        });
      }
    }
    throw new HttpError(409, '该手机号存在于多个企业，请填写企业 ID 后重试', 409, [...byTenant.values()]);
  }

  return { users, normalized };
}

export async function sendPasswordResetOtp({ phone, tenant_id }, clientIp) {
  const tid = tenant_id != null ? Number(tenant_id) : null;
  if (tenant_id != null && (!Number.isInteger(tid) || tid < 1)) {
    throw new HttpError(400, '企业 ID 必须是正整数', 400);
  }

  const { normalized } = await resolveUsersForPasswordReset({
    phone,
    tenant_id: tid ?? undefined,
  });

  if (env.nodeEnv === 'production') {
    assertSmsConfigured();
  }

  const storageTarget = otpStorageTarget(normalized);
  const coolKey = `${clientIp || 'unknown'}:pwd_reset:${normalized}`;
  const last = sendCooldown.get(coolKey) || 0;
  if (env.nodeEnv === 'production' && Date.now() - last < SEND_COOLDOWN_MS) {
    throw new HttpError(429, '发送过于频繁，请稍后再试', 429);
  }
  sendCooldown.set(coolKey, Date.now());

  const code = String(randomInt(100000, 1000000));
  await RegistrationOtpChallenge.create({
    channel: 'sms',
    target: storageTarget,
    code_hash: hashOtp(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS),
  });

  const hasAliyun =
    env.registerOtp.aliyunKeyId && env.registerOtp.aliyunKeySecret && env.registerOtp.aliyunTemplateCode;
  const hasWebhook = Boolean(env.registerOtp.smsWebhookUrl);

  if (!hasAliyun && !hasWebhook) {
    if (env.nodeEnv !== 'production') {
      return {
        ok: true,
        expiresInSec: Math.floor(OTP_TTL_MS / 1000),
        devMode: true,
        devCode: code,
      };
    }
    throw new HttpError(503, '未配置短信服务，无法发送重置验证码', 503);
  }

  try {
    if (hasAliyun) {
      await sendSmsAliyun(normalized, code);
    } else {
      await sendSmsWebhook(normalized, code);
    }
  } catch (err) {
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

export async function consumePasswordResetOtpIfValid({ phone, code }) {
  const normalized = normalizeCnMobile(phone);
  if (!normalized) {
    throw new HttpError(400, '手机号格式不正确', 400);
  }
  const expectHash = hashOtp(String(code).trim());
  const row = await RegistrationOtpChallenge.findOne({
    where: { channel: 'sms', target: otpStorageTarget(normalized), consumed_at: null },
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
