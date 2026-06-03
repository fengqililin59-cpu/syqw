/**
 * @file 微信支付 API v3（Native 扫码 + 支付通知解密）。
 */
import crypto from 'crypto';
import fs from 'fs';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';
import { isWechatMpOAuthConfigured } from './wechatMpOAuth.service.js';

const API_HOST = 'https://api.mch.weixin.qq.com';

function loadPrivateKeyPem() {
  const inline = env.wechatPay.privateKeyPem;
  if (inline) return inline.replace(/\\n/g, '\n');
  const path = env.wechatPay.privateKeyPath;
  if (path) {
    try {
      return fs.readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  }
  return null;
}

function loadPlatformPublicKeyPem() {
  const inline = env.wechatPay.platformCertPem;
  if (inline) return inline.replace(/\\n/g, '\n');
  return null;
}

export function isWechatPayConfigured() {
  if (env.wechatPay.mock) return true;
  const key = loadPrivateKeyPem();
  return Boolean(
    env.wechatPay.mchId &&
      env.wechatPay.appId &&
      env.wechatPay.apiV3Key &&
      env.wechatPay.serialNo &&
      key &&
      env.wechatPay.notifyBaseUrl,
  );
}

export function isWechatPayMock() {
  return env.wechatPay.mock === true;
}

/** 公众号内 JSAPI 支付（需配置 AppSecret + 用户 OAuth 绑定 openid） */
export function isWechatJsapiEnabled() {
  if (!isWechatPayConfigured()) return false;
  if (isWechatPayMock()) return true;
  return isWechatMpOAuthConfigured();
}

function buildAuthorization(method, urlPath, body) {
  const privateKey = loadPrivateKeyPem();
  if (!privateKey) throw new HttpError(503, '未配置微信支付商户私钥', 503);

  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyStr = body ? JSON.stringify(body) : '';
  const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${bodyStr}\n`;
  const signature = crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');
  const token = [
    `mchid="${env.wechatPay.mchId}"`,
    `nonce_str="${nonce}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${env.wechatPay.serialNo}"`,
    `signature="${signature}"`,
  ].join(',');
  return `WECHATPAY2-SHA256-RSA2048 ${token}`;
}

/**
 * Native 下单，金额单位：分。
 */
export async function createNativeOrder({ outTradeNo, description, amountFen }) {
  if (env.wechatPay.mock) {
    return {
      code_url: `weixin://wxpay/bizpayurl?pr=MOCK_${encodeURIComponent(outTradeNo)}`,
      mock: true,
    };
  }

  const notifyUrl = `${env.wechatPay.notifyBaseUrl.replace(/\/$/, '')}/api/v1/billing/webhooks/wechat`;
  const urlPath = '/v3/pay/transactions/native';
  const body = {
    appid: env.wechatPay.appId,
    mchid: env.wechatPay.mchId,
    description: String(description || 'ZhiFlow套餐').slice(0, 127),
    out_trade_no: String(outTradeNo),
    notify_url: notifyUrl,
    amount: {
      total: Math.max(1, Math.round(Number(amountFen))),
      currency: 'CNY',
    },
  };

  const res = await fetch(`${API_HOST}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: buildAuthorization('POST', urlPath, body),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.detail || `微信下单失败(${res.status})`;
    console.error('[wechatPay] native order failed', res.status, data);
    throw new HttpError(502, msg, 502);
  }
  if (!data?.code_url) throw new HttpError(502, '微信未返回支付二维码', 502);
  return { code_url: data.code_url, mock: false };
}

/**
 * JSAPI 下单（公众号 / 微信内浏览器）。
 */
export async function createJsapiOrder({ outTradeNo, description, amountFen, openid }) {
  if (!openid) throw new HttpError(400, '缺少 openid，请先在微信内完成授权', 400);

  if (env.wechatPay.mock) {
    const prepayId = `mock_prepay_${outTradeNo}`;
    return { prepay_id: prepayId, mock: true, jsapi_params: buildJsapiBridgeParams(prepayId) };
  }

  const notifyUrl = `${env.wechatPay.notifyBaseUrl.replace(/\/$/, '')}/api/v1/billing/webhooks/wechat`;
  const urlPath = '/v3/pay/transactions/jsapi';
  const body = {
    appid: env.wechatPay.appId,
    mchid: env.wechatPay.mchId,
    description: String(description || 'ZhiFlow套餐').slice(0, 127),
    out_trade_no: String(outTradeNo),
    notify_url: notifyUrl,
    amount: {
      total: Math.max(1, Math.round(Number(amountFen))),
      currency: 'CNY',
    },
    payer: { openid: String(openid) },
  };

  const res = await fetch(`${API_HOST}${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: buildAuthorization('POST', urlPath, body),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.message || data?.detail || `微信 JSAPI 下单失败(${res.status})`;
    console.error('[wechatPay] jsapi order failed', res.status, data);
    throw new HttpError(502, msg, 502);
  }
  if (!data?.prepay_id) throw new HttpError(502, '微信未返回 prepay_id', 502);

  return {
    prepay_id: data.prepay_id,
    mock: false,
    jsapi_params: buildJsapiBridgeParams(data.prepay_id),
  };
}

/**
 * 生成前端 WeixinJSBridge 调起参数。
 */
export function buildJsapiBridgeParams(prepayId) {
  const appId = env.wechatPay.appId;
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const packageVal = `prepay_id=${prepayId}`;
  const signType = 'RSA';

  if (env.wechatPay.mock) {
    return {
      appId: appId || 'wx_mock_appid',
      timeStamp,
      nonceStr,
      package: packageVal,
      signType,
      paySign: 'MOCK_SIGN',
    };
  }

  const privateKey = loadPrivateKeyPem();
  if (!privateKey) throw new HttpError(503, '未配置微信支付商户私钥', 503);

  const message = `${appId}\n${timeStamp}\n${nonceStr}\n${packageVal}\n`;
  const paySign = crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64');

  return { appId, timeStamp, nonceStr, package: packageVal, signType, paySign };
}

function decryptResource(resource) {
  const { ciphertext, associated_data: aad, nonce } = resource || {};
  if (!ciphertext || !nonce) throw new HttpError(400, '通知资源无效', 400);

  const key = Buffer.from(env.wechatPay.apiV3Key, 'utf8');
  if (key.length !== 32) throw new HttpError(500, 'WECHAT_PAY_API_V3_KEY 须为 32 字节', 500);

  const buf = Buffer.from(ciphertext, 'base64');
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

function verifyNotifySignature(headers, rawBody) {
  if (env.wechatPay.skipSignatureVerify) return true;
  const pub = loadPlatformPublicKeyPem();
  if (!pub) return false;

  const signature = headers['wechatpay-signature'] || headers['Wechatpay-Signature'];
  const timestamp = headers['wechatpay-timestamp'] || headers['Wechatpay-Timestamp'];
  const nonce = headers['wechatpay-nonce'] || headers['Wechatpay-Nonce'];
  if (!signature || !timestamp || !nonce) return false;

  const message = `${timestamp}\n${nonce}\n${rawBody}\n`;
  return crypto.createVerify('RSA-SHA256').update(message).verify(pub, signature, 'base64');
}

/**
 * 解析支付成功通知，返回 { out_trade_no, transaction_id, amountFen }。
 */
export function parsePayNotification(headers, rawBody) {
  const body = JSON.parse(rawBody || '{}');
  if (body.event_type !== 'TRANSACTION.SUCCESS') {
    return { handled: false, event_type: body.event_type };
  }

  if (!verifyNotifySignature(headers, rawBody) && !env.wechatPay.mock) {
    throw new HttpError(401, '微信支付通知验签失败', 401);
  }

  const plain = decryptResource(body.resource);
  if (plain.trade_state !== 'SUCCESS') {
    return { handled: false, trade_state: plain.trade_state };
  }

  return {
    handled: true,
    out_trade_no: plain.out_trade_no,
    transaction_id: plain.transaction_id,
    amountFen: plain.amount?.total,
  };
}
