/**
 * @file 企微客户联系：向外部联系人发送文本（单聊）。
 * @description 优先调用「消息推送」类接口；若企业能力不符则回退到 add_msg_template（可能需成员在客户端确认）。
 */
import { env } from '../config/env.js';
import { getAccessToken } from './wework.service.js';
import { addMsgTemplate } from './weworkBroadcast.service.js';

const MESSAGE_SEND_URL =
  'https://qyapi.weixin.qq.com/cgi-bin/externalcontact/message/send?access_token=';

/** @type {Map<string, { count: number; resetAt: number }>} */
const rateBuckets = new Map();

/**
 * 租户级每分钟发送额度（流程直发 + 其他调用共用）。
 * @param {number} tenantId
 * @returns {{ ok: boolean; limit: number }}
 */
export function tryConsumeAutoSendSlot(tenantId) {
  const limit = Math.max(1, Number(env.autoSendRateLimitPerMinute) || 10);
  const key = String(tenantId);
  const now = Date.now();
  let b = rateBuckets.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + 60_000 };
    rateBuckets.set(key, b);
  }
  if (b.count >= limit) {
    return { ok: false, limit };
  }
  b.count += 1;
  return { ok: true, limit };
}

/**
 * 发送文本给外部联系人。
 * @param {object} tenant Sequelize Tenant（需含 wework 凭证）
 * @param {{
 *   externalUserid: string;
 *   text: string;
 *   senderUserid: string;
 * }} opts senderUserid 为跟进成员的企微 userid，与客户关系归属一致
 * @returns {Promise<{ errcode: number; errmsg?: string; msgid?: string; via?: string; fail_list?: string[] }>}
 */
export async function sendExternalTextMessage(tenant, opts) {
  const { externalUserid, text, senderUserid } = opts;
  const content = String(text || '').trim();
  if (!content) {
    return { errcode: -1000, errmsg: 'empty_content' };
  }
  if (!externalUserid || !senderUserid) {
    return { errcode: -1001, errmsg: 'missing_external_or_sender' };
  }

  const accessToken = await getAccessToken(tenant);
  const url = `${MESSAGE_SEND_URL}${encodeURIComponent(accessToken)}`;
  const primaryBody = {
    msgtype: 'text',
    text: { content: content },
    external_userid: externalUserid,
    sender: senderUserid,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(primaryBody),
  });
  const data = await res.json().catch(() => ({}));

  if (data.errcode === 0) {
    return { ...data, via: 'message_send' };
  }

  const fallbackCodes = new Set([404, 40066, 60020, 95001, 48002]);
  const tryFallback =
    fallbackCodes.has(Number(data.errcode)) ||
    String(data.errmsg || '')
      .toLowerCase()
      .includes('api');

  if (tryFallback) {
    const tpl = await addMsgTemplate(tenant, {
      sender: senderUserid,
      externalUserids: [externalUserid],
      textContent: content,
      attachments: [],
    });
    if (tpl.errcode === 0) {
      return { ...tpl, via: 'add_msg_template' };
    }
    return { ...tpl, via: 'add_msg_template' };
  }

  return { ...data, via: 'message_send' };
}
