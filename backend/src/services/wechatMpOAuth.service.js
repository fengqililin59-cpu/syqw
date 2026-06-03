/**
 * @file 微信公众号 OAuth（snsapi_base）获取 JSAPI 支付 openid。
 */
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { User } from '../models/index.js';

const OAUTH_SCOPE = 'snsapi_base';

export function isWechatMpOAuthConfigured() {
  return Boolean(env.wechatPay.appId && env.wechatMp.appSecret);
}

function oauthCallbackUrl() {
  const base = env.wechatPay.notifyBaseUrl || env.appUrl;
  return `${String(base).replace(/\/$/, '')}/api/v1/billing/wechat/mp-oauth-callback`;
}

export function signMpOAuthState(userId, returnTo) {
  return jwt.sign(
    { sub: Number(userId), return_to: String(returnTo || '/app/billing').slice(0, 500), purpose: 'wx_mp_pay' },
    env.jwt.secret,
    { expiresIn: '15m' },
  );
}

export function verifyMpOAuthState(state) {
  const payload = jwt.verify(state, env.jwt.secret);
  if (payload.purpose !== 'wx_mp_pay' || !payload.sub) {
    throw new HttpError(400, '授权状态无效', 400);
  }
  return { userId: Number(payload.sub), returnTo: payload.return_to || '/app/billing' };
}

export function buildMpOAuthUrl(userId, returnTo) {
  if (!isWechatMpOAuthConfigured()) {
    throw new HttpError(503, '未配置公众号 AppSecret（WECHAT_MP_APP_SECRET）', 503);
  }
  const state = signMpOAuthState(userId, returnTo);
  const redirectUri = encodeURIComponent(oauthCallbackUrl());
  const url =
    `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${encodeURIComponent(env.wechatPay.appId)}` +
    `&redirect_uri=${redirectUri}&response_type=code&scope=${OAUTH_SCOPE}` +
    `&state=${encodeURIComponent(state)}#wechat_redirect`;
  return url;
}

export async function exchangeCodeAndBindUser(code, state) {
  const { userId, returnTo } = verifyMpOAuthState(state);
  const tokenUrl =
    `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${encodeURIComponent(env.wechatPay.appId)}` +
    `&secret=${encodeURIComponent(env.wechatMp.appSecret)}` +
    `&code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`;

  const res = await fetch(tokenUrl);
  const data = await res.json().catch(() => ({}));
  if (!data?.openid) {
    const msg = data?.errmsg || '获取 openid 失败';
    throw new HttpError(502, msg, 502);
  }

  const user = await User.findByPk(userId);
  if (!user || user.status !== 1) throw new HttpError(404, '用户不存在', 404);

  await user.update({ wechat_mp_openid: String(data.openid).slice(0, 64) });
  return { userId, returnTo, openid: data.openid };
}

export async function getUserMpOpenid(userId) {
  const user = await User.findByPk(Number(userId), { attributes: ['id', 'wechat_mp_openid', 'status'] });
  if (!user || user.status !== 1) return null;
  return user.wechat_mp_openid || null;
}
