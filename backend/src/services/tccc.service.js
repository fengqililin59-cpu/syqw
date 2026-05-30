/**
 * @file 腾讯云 TCCC 外呼服务封装。
 * @description TCCC_MOCK=1 时仅记录日志并返回模拟会话，不真实拨号。
 */
import crypto from 'crypto';
import { env } from '../config/env.js';

function hmacSha256(key, data, output = undefined) {
  const h = crypto.createHmac('sha256', key);
  h.update(data);
  return output ? h.digest(output) : h.digest();
}

function sign(secretKey, date, service, stringToSign) {
  const kDate = hmacSha256(`TC3${secretKey}`, date);
  const kService = hmacSha256(kDate, service);
  const kSigning = hmacSha256(kService, 'tc3_request');
  return hmacSha256(kSigning, stringToSign, 'hex');
}

async function callTcccApi(tenant, action, payload) {
  if (env.tccMock) {
    console.log(`[TCCC Mock] ${action}`, payload);
    return {
      SessionId: `mock_${Date.now()}`,
      RequestId: `req_${Date.now()}`,
    };
  }

  const secretId = String(tenant?.tccc_secret_id || env.tcccSecretId || '').trim();
  const secretKey = String(tenant?.tccc_secret_key || env.tcccSecretKey || '').trim();
  if (!secretId || !secretKey) {
    throw new Error('TCCC 配置不完整：缺少 SecretId 或 SecretKey');
  }

  const host = 'ccc.tencentcloudapi.com';
  const service = 'ccc';
  const version = '2020-02-10';
  const region = 'ap-guangzhou';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload || {});
  const hashedBody = crypto.createHash('sha256').update(body).digest('hex');

  const canonicalRequest = [
    'POST',
    '/',
    '',
    `content-type:application/json\nhost:${host}\n`,
    'content-type;host',
    hashedBody,
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
  ].join('\n');

  const signature = sign(secretKey, date, service, stringToSign);
  const authorization =
    `TC3-HMAC-SHA256 Credential=${secretId}/${credentialScope}, ` +
    'SignedHeaders=content-type;host, ' +
    `Signature=${signature}`;

  const res = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: host,
      Authorization: authorization,
      'X-TC-Action': action,
      'X-TC-Version': version,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': region,
    },
    body,
  });

  const data = await res.json();
  if (data?.Response?.Error) {
    throw new Error(data.Response.Error.Message || 'TCCC API 错误');
  }
  return data.Response || {};
}

function getSdkAppId(tenant) {
  const raw = String(tenant?.tccc_sdk_app_id || env.tcccSdkAppId || '').trim();
  return Number(raw);
}

function getServerNumber(tenant) {
  return String(tenant?.tccc_server_number || env.tcccServerNumber || '').trim();
}

export async function initiatePhoneCall(tenant, callerPhone, customerPhone) {
  return callTcccApi(tenant, 'CreateCallOutSession', {
    SdkAppId: getSdkAppId(tenant),
    UserId: callerPhone,
    Callee: customerPhone,
    Caller: getServerNumber(tenant),
    IsAI: false,
  });
}

export async function initiateWebRtcCall(tenant, staffUserId, customerPhone) {
  return callTcccApi(tenant, 'CreateCallOutSession', {
    SdkAppId: getSdkAppId(tenant),
    UserId: String(staffUserId || ''),
    Callee: customerPhone,
    Caller: getServerNumber(tenant),
    IsAI: false,
  });
}

export async function getCallStatus(tenant, sessionId) {
  return callTcccApi(tenant, 'DescribeCallInMetrics', {
    SdkAppId: getSdkAppId(tenant),
    SessionId: sessionId,
  });
}

export async function hangupCall(tenant, sessionId) {
  return callTcccApi(tenant, 'HangUpCall', {
    SdkAppId: getSdkAppId(tenant),
    SessionId: sessionId,
  });
}
