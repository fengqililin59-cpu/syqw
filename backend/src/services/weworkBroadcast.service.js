/**
 * @file 企业微信客户群发：add_msg_template（创建企业群发）。
 * @see https://developer.work.weixin.qq.com/document/path/92135
 */
import { getAccessToken } from './wework.service.js';

const ADD_MSG_TEMPLATE_URL =
  'https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_msg_template?access_token=';

/**
 * @param {object} tenant
 * @param {{
 *   sender: string;
 *   externalUserids: string[];
 *   textContent: string;
 *   attachments?: object[];
 * }} opts
 * @returns {Promise<{ errcode: number; errmsg?: string; msgid?: string; fail_list?: string[] }>}
 */
export async function addMsgTemplate(tenant, opts) {
  const { sender, externalUserids, textContent, attachments = [] } = opts;
  const accessToken = await getAccessToken(tenant);
  const url = `${ADD_MSG_TEMPLATE_URL}${encodeURIComponent(accessToken)}`;
  const body = {
    chat_type: 'single',
    external_userid: externalUserids,
    sender,
    text: { content: textContent ?? '' },
    attachments,
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return response.json();
}
