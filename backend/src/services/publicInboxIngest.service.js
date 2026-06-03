/**
 * @file 公域平台 Webhook 入站（无需 JWT，使用密钥 + 租户 ID）。
 */
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { Tenant, Customer, User } from '../models/index.js';
import { ingestWebhook } from './inbox.service.js';
import { maybeQueueInboxAutoDraft } from './inboxAutoDraft.service.js';
import { verifyPublicWebhookAuth, getOrCreatePublicWebhookSettings } from './publicWebhookAuth.service.js';

const CHANNEL_ALIASES = {
  dy: 'douyin',
  douyin: 'douyin',
  tiktok: 'douyin',
  xhs: 'xiaohongshu',
  xiaohongshu: 'xiaohongshu',
  redbook: 'xiaohongshu',
  wechat: 'wechat_mp',
  wechat_mp: 'wechat_mp',
  mp: 'wechat_mp',
};

const CHANNEL_NAMES = {
  douyin: '抖音私信',
  xiaohongshu: '小红书',
  wechat_mp: '微信公众号',
};

/**
 * 将各平台异构 JSON 规整为 ingestWebhook 所需字段。
 * @param {string} channelCode
 * @param {object} body
 */
export function normalizePublicPayload(channelCode, body) {
  const raw = body && typeof body === 'object' ? body : {};
  if (raw.external_thread_key) {
    return {
      external_thread_key: String(raw.external_thread_key).slice(0, 128),
      customer_id: raw.customer_id,
      external_userid: raw.external_userid ?? raw.external_thread_key,
      direction: raw.direction || 'customer',
      content: raw.content ?? raw.text ?? raw.message ?? null,
      msg_type: raw.msg_type || 'text',
      channel_message_id: raw.channel_message_id ?? raw.msg_id ?? raw.message_id,
      nickname: raw.nickname ?? raw.user_name ?? raw.from_name,
      phone: raw.phone ?? raw.mobile,
    };
  }

  const code = CHANNEL_ALIASES[channelCode] || channelCode;
  const userKey =
    raw.open_id ||
    raw.user_id ||
    raw.sender_id ||
    raw.from_user_id ||
    raw.external_userid ||
    raw.union_id;
  const text =
    raw.text ||
    raw.content ||
    raw.message ||
    raw.msg_content ||
    (raw.data && raw.data.content) ||
    '';

  if (!userKey) {
    throw new HttpError(400, '无法解析用户标识（需 open_id / user_id / external_thread_key）', 400);
  }

  return {
    external_thread_key: String(userKey).slice(0, 128),
    external_userid: String(userKey).slice(0, 64),
    direction: 'customer',
    content: text ? String(text).slice(0, 8000) : '（无文本内容）',
    msg_type: 'text',
    channel_message_id:
      raw.msg_id || raw.message_id || raw.event_id || `${code}:${userKey}:${Date.now()}`,
    nickname: raw.nickname ?? raw.user_name,
    phone: raw.phone ?? raw.mobile,
  };
}

async function getDefaultOwnerId(tenantId) {
  const u = await User.findOne({
    where: { tenant_id: tenantId, status: 1 },
    order: [['id', 'ASC']],
    attributes: ['id'],
  });
  return u?.id ?? null;
}

async function resolveCustomerId(tenantId, normalized, ownerUserId) {
  if (normalized.customer_id) return normalized.customer_id;
  if (normalized.external_userid) {
    const byExt = await Customer.findOne({
      where: { tenant_id: tenantId, external_userid: normalized.external_userid },
    });
    if (byExt) return byExt.id;
  }
  if (normalized.phone) {
    const byPhone = await Customer.findOne({
      where: { tenant_id: tenantId, phone: normalized.phone },
    });
    if (byPhone) return byPhone.id;
  }
  const name = normalized.nickname ? String(normalized.nickname).slice(0, 50) : null;
  if (!name && !normalized.phone) return null;

  if (!ownerUserId) return null;

  const row = await Customer.create({
    tenant_id: tenantId,
    owner_id: ownerUserId,
    name: name || '公域访客',
    nickname: name,
    phone: normalized.phone ?? null,
    external_userid: normalized.external_userid ?? null,
    source: CHANNEL_NAMES[normalized._channel] || '公域私信',
    stage: 'new',
  });
  return row.id;
}

/**
 * @param {number} tenantId
 * @param {string} channelCode
 * @param {object} body
 * @param {{
 *   legacyToken?: string;
 *   headers?: Record<string, string | string[] | undefined>;
 *   rawBody?: string;
 * }} authCtx
 */
export async function ingestPublicWebhook(tenantId, channelCode, body, authCtx = {}) {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant || tenant.status !== 1) {
    throw new HttpError(404, '租户不存在', 404);
  }

  const code = CHANNEL_ALIASES[String(channelCode || '').toLowerCase()] || String(channelCode).toLowerCase();
  await verifyPublicWebhookAuth(tenantId, code, {
    legacyToken: authCtx.legacyToken,
    headers: authCtx.headers,
    rawBody: authCtx.rawBody,
  });
  const normalized = normalizePublicPayload(code, body);
  normalized._channel = code;

  const ownerId = await getDefaultOwnerId(tenantId);
  const auth = {
    tenantId: Number(tenantId),
    userId: null,
    roleName: 'system',
  };

  const customerId = await resolveCustomerId(tenantId, normalized, ownerId);
  const payload = {
    external_thread_key: normalized.external_thread_key,
    customer_id: customerId ?? undefined,
    external_userid: normalized.external_userid,
    direction: normalized.direction,
    content: normalized.content,
    msg_type: normalized.msg_type,
    channel_message_id: normalized.channel_message_id
      ? String(normalized.channel_message_id).slice(0, 96)
      : undefined,
  };

  const result = await ingestWebhook(auth, code, payload);
  if (payload.direction === 'customer' && payload.content && !result.deduplicated) {
    maybeQueueInboxAutoDraft(
      tenantId,
      result.thread.id,
      payload.content,
      result.message?.id,
    );
  }
  return result;
}

export async function getPublicWebhookInfo(tenantId) {
  const base = (env.weworkCallbackBaseUrl || '').replace(/\/$/, '');
  const apiBase = base.includes('/api/v1') ? base : `${base}/api/v1`;
  const exampleDouyinUrl = `${apiBase}/callback/inbox/${tenantId}/douyin`;
  const examplePayloads = {
    douyin: {
      open_id: 'douyin_open_id_demo',
      text: '你好，想了解一下产品',
      msg_id: 'dy_msg_001',
    },
    xiaohongshu: {
      user_id: 'xhs_user_demo',
      content: '私信咨询价格和方案',
      message_id: 'xhs_msg_001',
    },
    wechat_mp: {
      from_user_id: 'mp_openid_demo',
      content: '公众号留言咨询',
      msg_id: 'mp_msg_001',
    },
    standard: {
      external_thread_key: 'visitor_001',
      content: '标准格式测试消息',
      channel_message_id: 'std_msg_001',
      nickname: '公域访客',
    },
  };
  let platformHints = {
    douyin_secret_configured: false,
    xhs_token_configured: false,
  };
  try {
    const settings = await getOrCreatePublicWebhookSettings(tenantId);
    platformHints = {
      douyin_secret_configured: Boolean(settings.douyin_client_secret),
      xhs_token_configured: Boolean(settings.xhs_webhook_token),
    };
  } catch {
    /* table may not exist yet */
  }
  return {
    tenant_id: tenantId,
    header: 'X-Inbox-Webhook-Token',
    platform_headers: {
      douyin: 'X-Douyin-Signature',
      xiaohongshu: 'X-Red-Signature',
    },
    platform_hints: platformHints,
    channels: ['douyin', 'xiaohongshu', 'wechat_mp'],
    url_template: `${apiBase}/callback/inbox/${tenantId}/{channel}`,
    example_douyin: exampleDouyinUrl,
    example_xiaohongshu: `${apiBase}/callback/inbox/${tenantId}/xiaohongshu`,
    example_wechat_mp: `${apiBase}/callback/inbox/${tenantId}/wechat_mp`,
    example_payloads: examplePayloads,
    curl_example: [
      `curl -X POST '${exampleDouyinUrl}' \\`,
      `  -H 'Content-Type: application/json' \\`,
      `  -H 'X-Inbox-Webhook-Token: <PUBLIC_INBOX_WEBHOOK_SECRET>' \\`,
      `  -H 'X-Douyin-Signature: <SHA1(client_secret+body)>' \\`,
      `  -d '${JSON.stringify(examplePayloads.douyin)}'`,
    ].join('\n'),
    note:
      '验签方式三选一或组合：① 抖音官方 X-Douyin-Signature（需在设置中配置 client_secret）；② 小红书 X-Red-Signature（配置 webhook token）；③ Legacy 头 X-Inbox-Webhook-Token 与 PUBLIC_INBOX_WEBHOOK_SECRET 一致。签名均基于原始请求体，勿先解析再序列化。相同 channel_message_id 会自动去重。',
  };
}

/**
 * 管理员联调：模拟公域 Webhook 入站（走与公网回调相同的规整逻辑）。
 * @param {object} auth
 * @param {{ channel?: string, payload?: object }} body
 */
export async function testPublicWebhookSimulation(auth, body = {}) {
  const channel = String(body.channel || 'douyin').toLowerCase();
  const code = CHANNEL_ALIASES[channel] || channel;
  const defaultPayload = {
    open_id: `test_${code}_${Date.now()}`,
    text: `[Webhook 测试] ${new Date().toLocaleString('zh-CN')}`,
    msg_id: `test_${Date.now()}`,
  };
  const payload = body.payload && typeof body.payload === 'object' ? body.payload : defaultPayload;
  const normalized = normalizePublicPayload(code, payload);
  normalized._channel = code;

  const ownerId = await getDefaultOwnerId(auth.tenantId);
  const customerId = await resolveCustomerId(auth.tenantId, normalized, ownerId);

  const ingestBody = {
    external_thread_key: normalized.external_thread_key,
    customer_id: customerId ?? undefined,
    external_userid: normalized.external_userid,
    direction: normalized.direction || 'customer',
    content: normalized.content,
    msg_type: normalized.msg_type,
    channel_message_id: normalized.channel_message_id
      ? String(normalized.channel_message_id).slice(0, 96)
      : undefined,
  };

  const result = await ingestWebhook(auth, code, ingestBody);
  if (ingestBody.direction === 'customer' && ingestBody.content && !result.deduplicated) {
    maybeQueueInboxAutoDraft(
      auth.tenantId,
      result.thread.id,
      ingestBody.content,
      result.message?.id,
    );
  }
  return { channel: code, normalized: ingestBody, ...result };
}
