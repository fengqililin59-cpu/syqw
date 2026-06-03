#!/bin/bash
# 在 ECS Workbench 执行：bash ecs_install_alipay_service.sh
# 将 alipay.service.js 写入 backend/src/services/（该文件未随旧包部署）
set -euo pipefail
DEST="/var/www/wework-saas/backend/src/services/alipay.service.js"
mkdir -p "$(dirname "$DEST")"
cat > "$DEST" << 'ALIPAY_EOF'
/**
 * @file 支付宝电脑网站支付（trade.page.pay 跳转）+ 扫码支付 + 异步通知验签。
 */
import crypto from 'crypto';
import dayjs from 'dayjs';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const GATEWAY_PROD = 'https://openapi.alipay.com/gateway.do';
const GATEWAY_SANDBOX = 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';

function wrapPemBody(body, label) {
  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function loadPem(raw, type) {
  const s = String(raw || '').replace(/\\n/g, '\n').trim();
  if (!s) return null;
  const tryKey = (pem) => {
    try {
      if (type === 'private') crypto.createPrivateKey(pem);
      else crypto.createPublicKey(pem);
      return pem;
    } catch {
      return null;
    }
  };
  if (s.includes('BEGIN')) {
    const ok = tryKey(s);
    if (ok) return ok;
  }
  const body = s.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  if (!body) return null;
  const labels = type === 'private' ? ['PRIVATE KEY', 'RSA PRIVATE KEY'] : ['PUBLIC KEY'];
  for (const label of labels) {
    const pem = wrapPemBody(body, label);
    const ok = tryKey(pem);
    if (ok) return ok;
  }
  return null;
}

let cachedPrivateKeyObject = null;
let cachedPublicKeyObject = null;

function loadPrivateKey() {
  if (!cachedPrivateKeyObject) {
    const pem = loadPem(env.alipay.privateKey, 'private');
    if (!pem) return null;
    cachedPrivateKeyObject = crypto.createPrivateKey(pem);
  }
  return cachedPrivateKeyObject;
}

function loadPublicKey() {
  if (!cachedPublicKeyObject) {
    const pem = loadPem(env.alipay.publicKey, 'public');
    if (!pem) return null;
    cachedPublicKeyObject = crypto.createPublicKey(pem);
  }
  return cachedPublicKeyObject;
}

export function isAlipayConfigured() {
  if (env.alipay.mock) return true;
  return Boolean(env.alipay.appId && loadPrivateKey() && loadPublicKey() && env.alipay.notifyBaseUrl);
}

export const notifyBaseUrl = env.alipay.notifyBaseUrl;

export function isAlipayMock() {
  return env.alipay.mock === true;
}

function gatewayUrl() {
  return env.alipay.sandbox ? GATEWAY_SANDBOX : GATEWAY_PROD;
}

function signParams(params) {
  const privateKey = loadPrivateKey();
  if (!privateKey) {
    throw new HttpError(503, '支付宝应用私钥无效或格式错误（请使用 PEM 文件或检查 .env 中 \\n 转义）', 503);
  }
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] != null && k !== 'sign')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createSign('RSA-SHA256').update(sorted, 'utf8').sign(privateKey, 'base64');
}

function verifySign(params) {
  const publicKey = loadPublicKey();
  if (!publicKey) return false;
  const sign = params.sign;
  if (!sign) return false;
  const sorted = Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] != null && k !== 'sign' && k !== 'sign_type')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createVerify('RSA-SHA256').update(sorted, 'utf8').verify(publicKey, sign, 'base64');
}

async function gatewayRequest(method, bizContent) {
  const notifyUrl = `${env.alipay.notifyBaseUrl.replace(/\/$/, '')}/api/v1/billing/webhooks/alipay`;
  const params = {
    app_id: env.alipay.appId,
    method,
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    version: '1.0',
    notify_url: notifyUrl,
    biz_content: JSON.stringify(bizContent),
  };
  params.sign = signParams(params);
  const res = await fetch(gatewayUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('[alipay] invalid gateway response', text.slice(0, 500));
    throw new HttpError(502, '支付宝网关响应异常', 502);
  }
  const respKey = `${method.replace(/\./g, '_')}_response`;
  const payload = data[respKey] || {};
  if (payload.code !== '10000') {
    const msg = payload.sub_msg || payload.msg || '支付宝下单失败';
    console.error('[alipay] precreate failed', payload);
    throw new HttpError(502, msg, 502);
  }
  return payload;
}

export async function createPrecreateOrder({ outTradeNo, subject, totalAmountYuan }) {
  if (env.alipay.mock) {
    const qr = `alipays://platformapi/startapp?appId=${encodeURIComponent(env.alipay.appId)}&orderId=${encodeURIComponent(outTradeNo)}`;
    return { qr_code: qr, mock: true };
  }
  const payload = await gatewayRequest('alipay.trade.precreate', {
    out_trade_no: String(outTradeNo),
    total_amount: Number(totalAmountYuan).toFixed(2),
    subject: String(subject || 'ZhiFlow套餐').slice(0, 256),
  });
  if (!payload.qr_code) throw new HttpError(502, '支付宝未返回支付二维码', 502);
  return { qr_code: payload.qr_code, mock: false };
}

export function buildPagePayUrl({ outTradeNo, subject, totalAmountYuan, returnUrl }) {
  if (env.alipay.mock) {
    return `https://openapi.alipay.com/gateway.do?mock=1&out_trade_no=${encodeURIComponent(outTradeNo)}`;
  }
  const notifyUrl = `${env.alipay.notifyBaseUrl.replace(/\/$/, '')}/api/v1/billing/webhooks/alipay`;
  const bizContent = JSON.stringify({
    out_trade_no: String(outTradeNo),
    total_amount: Number(totalAmountYuan).toFixed(2),
    subject: String(subject || 'ZhiFlow套餐').slice(0, 256),
    product_code: 'FAST_INSTANT_TRADE_PAY',
    ...(returnUrl ? { return_url: returnUrl } : {}),
  });
  const params = {
    app_id: env.alipay.appId,
    method: 'alipay.trade.page.pay',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    version: '1.0',
    notify_url: notifyUrl,
    biz_content: bizContent,
  };
  params.sign = signParams(params);
  const qs = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  return `${gatewayUrl()}?${qs}`;
}

function parseNotifyBody(rawBody, bodyObj) {
  if (bodyObj && typeof bodyObj === 'object' && bodyObj.out_trade_no) return bodyObj;
  const params = {};
  const raw = String(rawBody || '');
  if (!raw) return params;
  for (const part of raw.split('&')) {
    const [k, v] = part.split('=');
    if (!k) continue;
    params[decodeURIComponent(k)] = decodeURIComponent((v || '').replace(/\+/g, ' '));
  }
  return params;
}

export function parsePayNotification(rawBody, bodyObj) {
  const params = parseNotifyBody(rawBody, bodyObj);
  if (!params.out_trade_no) {
    return { handled: false, reason: 'missing_out_trade_no' };
  }
  if (!isAlipayMock() && !verifySign(params) && !env.alipay.skipSignatureVerify) {
    throw new HttpError(401, '支付宝通知验签失败', 401);
  }
  const tradeStatus = params.trade_status;
  const success = tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED';
  if (!success) {
    return { handled: false, out_trade_no: params.out_trade_no, trade_status: tradeStatus };
  }
  return {
    handled: true,
    out_trade_no: params.out_trade_no,
    trade_no: params.trade_no,
    total_amount: params.total_amount,
  };
}
ALIPAY_EOF

echo "OK 已写入 $DEST ($(wc -l < "$DEST") 行)"
grep -q 'function loadPem' "$DEST" && echo "OK 含 loadPem"
cd /var/www/wework-saas/backend
pm2 restart syqw-api --update-env
echo "完成。请无痕刷新 billing 页再试支付宝。"
