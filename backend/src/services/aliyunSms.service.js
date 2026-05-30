import crypto from 'crypto';
import { env } from '../config/env.js';

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/(%7E)/g, '~');
}

function sign(accessKeySecret, stringToSign) {
  return crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
}

async function callSmsApi(tenant, params) {
  if (env.smsMock) {
    console.log('[SMS Mock] 发送短信', params);
    return {
      Code: 'OK',
      BizId: `mock_${Date.now()}`,
      Message: 'OK',
      RequestId: `req_${Date.now()}`,
    };
  }

  if (!tenant?.sms_access_key_id || !tenant?.sms_access_key_secret) {
    throw new Error('短信服务未配置，请在设置中填写阿里云 AccessKey');
  }

  const baseParams = {
    Format: 'JSON',
    Version: '2017-05-25',
    AccessKeyId: tenant.sms_access_key_id,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID().replace(/-/g, ''),
    Action: 'SendSms',
    ...params,
  };

  const sortedKeys = Object.keys(baseParams).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${percentEncode(k)}=${percentEncode(String(baseParams[k]))}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalQuery)}`;
  const signature = sign(tenant.sms_access_key_secret, stringToSign);
  const body = new URLSearchParams({ ...baseParams, Signature: signature });

  const res = await fetch('https://dysmsapi.aliyuncs.com', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  return res.json();
}

export async function sendSms(tenant, { phone, signName, templateCode, templateParam }) {
  return callSmsApi(tenant, {
    PhoneNumbers: phone,
    SignName: signName,
    TemplateCode: templateCode,
    TemplateParam: typeof templateParam === 'string' ? templateParam : JSON.stringify(templateParam || {}),
  });
}

export async function sendSmsBatch(tenant, { phones, signName, templateCode, templateParam }) {
  return callSmsApi(tenant, {
    Action: 'SendBatchSms',
    PhoneNumberJson: JSON.stringify(phones || []),
    SignNameJson: JSON.stringify((phones || []).map(() => signName)),
    TemplateCode: templateCode,
    TemplateParamJson: JSON.stringify((phones || []).map(() => templateParam || {})),
  });
}
