/**
 * @file 公域 Webhook 验签：抖音 X-Douyin-Signature、小红书 X-Red-Signature、兼容 legacy token。
 */
import crypto from 'crypto';
import { TenantPublicWebhookSetting } from '../models/index.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export const VERIFY_MODES = ['legacy_or_platform', 'platform_only', 'legacy_only'];

function timingSafeEqualHex(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  if (!left || !right || left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * 抖音：SHA1(client_secret + rawBody) → hex，对应 X-Douyin-Signature。
 * @param {string} clientSecret
 * @param {string} rawBody
 */
export function signDouyinWebhook(clientSecret, rawBody) {
  const h = crypto.createHash('sha1');
  h.update(String(clientSecret || ''));
  h.update(typeof rawBody === 'string' ? rawBody : '');
  return h.digest('hex');
}

/**
 * @param {string} clientSecret
 * @param {string} rawBody
 * @param {string} signatureHeader
 */
export function verifyDouyinSignature(clientSecret, rawBody, signatureHeader) {
  const expected = signDouyinWebhook(clientSecret, rawBody);
  const got = String(signatureHeader || '').trim();
  return timingSafeEqualHex(expected, got);
}

/**
 * 小红书线索/私信推送：SHA1(token + rawBody) → hex，Header 形如 sha1=xxx。
 * @param {string} token
 * @param {string} rawBody
 */
export function signXhsWebhook(token, rawBody) {
  const h = crypto.createHash('sha1');
  h.update(String(token || ''));
  h.update(typeof rawBody === 'string' ? rawBody : '');
  return h.digest('hex');
}

/**
 * @param {string} token
 * @param {string} rawBody
 * @param {string} signatureHeader
 */
export function verifyXhsSignature(token, rawBody, signatureHeader) {
  const expected = signXhsWebhook(token, rawBody);
  let got = String(signatureHeader || '').trim();
  if (got.toLowerCase().startsWith('sha1=')) got = got.slice(5);
  return timingSafeEqualHex(expected, got);
}

/**
 * @param {object} body parsed JSON
 * @returns {number | string | null}
 */
export function parseDouyinVerifyChallenge(body) {
  if (!body || typeof body !== 'object') return null;
  if (String(body.event || '') !== 'verify_webhook') return null;
  const challenge = body.content?.challenge;
  if (challenge == null) return null;
  return challenge;
}

export async function getOrCreatePublicWebhookSettings(tenantId) {
  const tid = Number(tenantId);
  let row = await TenantPublicWebhookSetting.findByPk(tid);
  if (!row) {
    try {
      row = await TenantPublicWebhookSetting.create({ tenant_id: tid });
    } catch {
      row = await TenantPublicWebhookSetting.findByPk(tid);
      if (!row) throw new HttpError(500, '公域 Webhook 配置不可用', 500);
    }
  }
  return row;
}

function headerValue(headers, name) {
  if (!headers) return '';
  const v = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(v)) return String(v[0] || '');
  return v != null ? String(v) : '';
}

function verifyLegacyToken(tokenHeader) {
  const secret = env.publicIngestSecret;
  if (!secret) return true;
  return tokenHeader === secret;
}

/**
 * @param {number} tenantId
 * @param {string} channelCode normalized channel
 * @param {{
 *   headers?: Record<string, string | string[] | undefined>;
 *   rawBody?: string;
 *   legacyToken?: string;
 * }} ctx
 */
export async function verifyPublicWebhookAuth(tenantId, channelCode, ctx = {}) {
  const settings = await getOrCreatePublicWebhookSettings(tenantId);
  const plain = settings.get({ plain: true });
  const rawBody = typeof ctx.rawBody === 'string' ? ctx.rawBody : '';
  const headers = ctx.headers || {};
  const legacyOk = verifyLegacyToken(ctx.legacyToken);

  const douyinSig = headerValue(headers, 'x-douyin-signature');
  const xhsSig = headerValue(headers, 'x-red-signature');

  const douyinSecret = String(plain.douyin_client_secret || '').trim();
  const xhsToken = String(plain.xhs_webhook_token || '').trim();
  const douyinMode = plain.douyin_verify_mode || 'legacy_or_platform';
  const xhsMode = plain.xhs_verify_mode || 'legacy_or_platform';

  if (channelCode === 'douyin') {
    const douyinSigOk = douyinSecret && douyinSig && verifyDouyinSignature(douyinSecret, rawBody, douyinSig);
    if (douyinSigOk) return { method: 'douyin_signature' };
    if (douyinMode === 'platform_only' && douyinSecret) {
      throw new HttpError(401, '需有效的 X-Douyin-Signature 官方签名', 401);
    }
    if (douyinMode === 'legacy_only' || !douyinSecret) {
      if (!legacyOk) throw new HttpError(401, 'Webhook 密钥无效', 401);
      return { method: 'legacy_token' };
    }
    if (legacyOk) return { method: 'legacy_token' };
    throw new HttpError(401, '抖音 Webhook 验签失败（需 X-Douyin-Signature 或 legacy token）', 401);
  }

  if (channelCode === 'xiaohongshu') {
    const xhsSigOk = xhsToken && xhsSig && verifyXhsSignature(xhsToken, rawBody, xhsSig);
    if (xhsSigOk) return { method: 'xhs_signature' };
    if (xhsMode === 'platform_only' && xhsToken) {
      throw new HttpError(401, '需有效的 X-Red-Signature 官方签名', 401);
    }
    if (xhsMode === 'legacy_only' || !xhsToken) {
      if (!legacyOk) throw new HttpError(401, 'Webhook 密钥无效', 401);
      return { method: 'legacy_token' };
    }
    if (legacyOk) return { method: 'legacy_token' };
    throw new HttpError(401, '小红书 Webhook 验签失败（需 X-Red-Signature 或 legacy token）', 401);
  }

  if (!legacyOk) throw new HttpError(401, 'Webhook 密钥无效', 401);
  return { method: 'legacy_token' };
}
