/**
 * @file 租户公域 Webhook 验签配置 API。
 */
import Joi from 'joi';
import { HttpError } from '../utils/httpError.js';
import { isAdmin } from '../utils/permissions.js';
import {
  VERIFY_MODES,
  getOrCreatePublicWebhookSettings,
  signDouyinWebhook,
  signXhsWebhook,
} from './publicWebhookAuth.service.js';

const updateSchema = Joi.object({
  douyin_client_key: Joi.string().trim().max(64).allow('', null).optional(),
  douyin_client_secret: Joi.string().trim().max(255).allow('', null).optional(),
  douyin_verify_mode: Joi.string()
    .valid(...VERIFY_MODES)
    .optional(),
  xhs_webhook_token: Joi.string().trim().max(255).allow('', null).optional(),
  xhs_verify_mode: Joi.string()
    .valid(...VERIFY_MODES)
    .optional(),
}).unknown(false);

function maskSecret(value) {
  const s = String(value || '');
  if (!s) return null;
  if (s.length <= 6) return '******';
  return `${s.slice(0, 3)}***${s.slice(-2)}`;
}

export async function getPublicWebhookSettings(auth) {
  if (!isAdmin(auth)) throw new HttpError(403, '需要管理员权限', 403);
  const row = await getOrCreatePublicWebhookSettings(auth.tenantId);
  const plain = row.get({ plain: true });
  return {
    douyin_client_key: plain.douyin_client_key ?? '',
    douyin_client_secret_set: Boolean(plain.douyin_client_secret),
    douyin_verify_mode: plain.douyin_verify_mode || 'legacy_or_platform',
    xhs_webhook_token_set: Boolean(plain.xhs_webhook_token),
    xhs_verify_mode: plain.xhs_verify_mode || 'legacy_or_platform',
    verify_mode_options: VERIFY_MODES.map((m) => ({
      value: m,
      label:
        m === 'platform_only'
          ? '仅官方签名'
          : m === 'legacy_only'
            ? '仅 Legacy Token'
            : '官方签名或 Legacy Token',
    })),
    docs: {
      douyin_header: 'X-Douyin-Signature',
      douyin_algo: 'SHA1(client_secret + 原始请求体) → hex',
      xhs_header: 'X-Red-Signature',
      xhs_algo: 'SHA1(webhook_token + 原始请求体) → hex，Header 格式 sha1=<hex>',
      legacy_header: 'X-Inbox-Webhook-Token',
    },
  };
}

export async function updatePublicWebhookSettings(auth, body) {
  if (!isAdmin(auth)) throw new HttpError(403, '需要管理员权限', 403);
  const { error, value } = updateSchema.validate(body || {}, { abortEarly: false, stripUnknown: true });
  if (error) throw new HttpError(400, '参数校验失败', 400, error.details);

  const row = await getOrCreatePublicWebhookSettings(auth.tenantId);
  const patch = {};

  if (value.douyin_client_key !== undefined) {
    patch.douyin_client_key = value.douyin_client_key ? String(value.douyin_client_key).trim() : null;
  }
  if (value.douyin_client_secret !== undefined) {
    const s = value.douyin_client_secret ? String(value.douyin_client_secret).trim() : '';
    if (s) patch.douyin_client_secret = s;
    else patch.douyin_client_secret = null;
  }
  if (value.douyin_verify_mode !== undefined) patch.douyin_verify_mode = value.douyin_verify_mode;
  if (value.xhs_webhook_token !== undefined) {
    const s = value.xhs_webhook_token ? String(value.xhs_webhook_token).trim() : '';
    if (s) patch.xhs_webhook_token = s;
    else patch.xhs_webhook_token = null;
  }
  if (value.xhs_verify_mode !== undefined) patch.xhs_verify_mode = value.xhs_verify_mode;

  if (Object.keys(patch).length) await row.update(patch);
  return getPublicWebhookSettings(auth);
}

/**
 * 管理员联调：本地生成签名示例。
 */
export async function buildSignatureExamples(auth, body = {}) {
  if (!isAdmin(auth)) throw new HttpError(403, '需要管理员权限', 403);
  const row = await getOrCreatePublicWebhookSettings(auth.tenantId);
  const sampleBody =
    typeof body.sample_body === 'string' && body.sample_body.trim()
      ? body.sample_body.trim()
      : '{"open_id":"demo_user","text":"你好"}';

  const out = { sample_body: sampleBody };
  if (row.douyin_client_secret) {
    out.douyin_signature = signDouyinWebhook(row.douyin_client_secret, sampleBody);
  }
  if (row.xhs_webhook_token) {
    const hex = signXhsWebhook(row.xhs_webhook_token, sampleBody);
    out.xhs_signature = `sha1=${hex}`;
  }
  return out;
}
