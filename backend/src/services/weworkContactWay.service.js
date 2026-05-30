/**
 * @file 企微客户联系「联系我」：创建/更新员工活码（二维码场景）。
 * @description 同一 config_id 下可在后台改成员/备注而无需换印刷物料；二维码链接仍指向企微侧配置。
 * @see https://developer.work.weixin.qq.com/document/path/92228
 */

/** 渠道参数 state 长度上限（企微文档通常为 30，超限会导致接口报错） */
export const CONTACT_WAY_STATE_MAX_LEN = 30;
import { getAccessToken } from './wework.service.js';

/**
 * @param {import('../models/tenant.model.js').Tenant} tenant
 * @param {{
 *   user: string[];
 *   state: string;
 *   remark?: string;
 *   skip_verify?: boolean;
 *   style?: number;
 * }} params
 * @returns {Promise<{ errcode: number; errmsg?: string; config_id?: string; qr_code?: string }>}
 */
export async function addContactWay(tenant, params) {
  const { user, state, remark = '', skip_verify = true, style = 1 } = params;
  if (!user?.length) {
    throw new Error('请至少选择一名企微成员 userid');
  }
  const type = user.length > 1 ? 2 : 1;
  if (type === 1 && user.length !== 1) {
    throw new Error('单人活码需且仅需一名成员');
  }
  const accessToken = await getAccessToken(tenant);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_contact_way?access_token=${encodeURIComponent(accessToken)}`;
  const body = {
    type,
    scene: 2,
    style: Math.min(4, Math.max(1, Number(style) || 1)),
    remark: String(remark).slice(0, 200),
    skip_verify: Boolean(skip_verify),
    state: String(state).slice(0, CONTACT_WAY_STATE_MAX_LEN),
    user,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * @param {import('../models/tenant.model.js').Tenant} tenant
 * @param {{
 *   config_id: string;
 *   user?: string[];
 *   party?: number[];
 *   remark?: string;
 *   skip_verify?: boolean;
 *   style?: number;
 *   state?: string;
 * }} params
 */
export async function updateContactWay(tenant, params) {
  const accessToken = await getAccessToken(tenant);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/update_contact_way?access_token=${encodeURIComponent(accessToken)}`;
  const body = { ...params };
  if (body.style != null) {
    body.style = Math.min(4, Math.max(1, Number(body.style) || 1));
  }
  if (body.state != null) {
    body.state = String(body.state).slice(0, CONTACT_WAY_STATE_MAX_LEN);
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
  return res.json();
}
