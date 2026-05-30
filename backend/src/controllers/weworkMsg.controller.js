/**
 * @file 企微「接收消息」回调：GET 验证 URL、POST 解密 XML 入库（公开接口，通过签名 + 租户密钥校验）。
 */
import express from 'express';
import { parseStringPromise } from 'xml2js';
import { decryptWxMessage, verifySignature } from '../services/weworkMsgCrypto.service.js';
import { persistInboundXml, resolveTenantFromQuery } from '../services/weworkInboundMsg.service.js';

/** @param {import('express').Request['query']} q */
function qStr(q, key) {
  const v = q[key];
  if (Array.isArray(v)) return v[0] != null ? String(v[0]) : undefined;
  return v != null ? String(v) : undefined;
}

/**
 * GET /wework/msg-callback?tenant_id=&msg_signature=&timestamp=&nonce=&echostr=
 */
export async function verifyCallback(req, res) {
  const tenant = await resolveTenantFromQuery(/** @type {Record<string, string | string[]>} */ (req.query));
  if (!tenant?.wework_token || !tenant.wework_encoding_aes_key) {
    return res.status(400).type('text/plain').send('tenant msg config missing');
  }

  const sig = qStr(req.query, 'msg_signature');
  const timestamp = qStr(req.query, 'timestamp');
  const nonce = qStr(req.query, 'nonce');
  const echostr = qStr(req.query, 'echostr');
  if (!echostr || typeof echostr !== 'string') {
    return res.status(400).type('text/plain').send('missing echostr');
  }

  const okSig = verifySignature(tenant.wework_token, timestamp, nonce, echostr, sig);
  if (!okSig) {
    return res.status(403).type('text/plain').send('invalid signature');
  }

  try {
    const { msgUtf8, receiveIdUtf8 } = decryptWxMessage(tenant.wework_encoding_aes_key, echostr);
    if (receiveIdUtf8 && tenant.wework_corp_id && receiveIdUtf8 !== tenant.wework_corp_id) {
      return res.status(403).type('text/plain').send('corp id mismatch');
    }
    return res.type('text/plain').send(msgUtf8);
  } catch (e) {
    console.error('[wework msg-callback GET]', e);
    return res.status(400).type('text/plain').send('decrypt failed');
  }
}

/**
 * POST：XML 包体，中间件见路由上的 express.text
 */
export async function receiveCallback(req, res) {
  const tenant = await resolveTenantFromQuery(/** @type {Record<string, string | string[]>} */ (req.query));
  if (!tenant?.wework_token || !tenant.wework_encoding_aes_key) {
    return res.status(400).type('text/plain').send('tenant msg config missing');
  }

  const sig = qStr(req.query, 'msg_signature');
  const timestamp = qStr(req.query, 'timestamp');
  const nonce = qStr(req.query, 'nonce');
  const xmlStr = typeof req.body === 'string' ? req.body : '';

  /** @type {Record<string, unknown>} */
  let outer;
  try {
    outer = await parseStringPromise(xmlStr, { trim: true, explicitArray: false, explicitRoot: false });
  } catch {
    return res.status(400).type('text/plain').send('invalid xml');
  }

  const encryptBlock = outer.Encrypt ?? outer.encrypt;
  let encryptStr = '';
  if (typeof encryptBlock === 'string') encryptStr = encryptBlock;
  else if (encryptBlock && typeof encryptBlock === 'object' && '_' in encryptBlock) {
    encryptStr = String(encryptBlock._);
  }
  if (!encryptStr) {
    return res.status(400).type('text/plain').send('missing Encrypt');
  }

  const okSig = verifySignature(tenant.wework_token, timestamp, nonce, encryptStr, sig);
  if (!okSig) {
    return res.status(403).type('text/plain').send('invalid signature');
  }

  try {
    const { msgUtf8, receiveIdUtf8 } = decryptWxMessage(tenant.wework_encoding_aes_key, encryptStr);
    if (receiveIdUtf8 && tenant.wework_corp_id && receiveIdUtf8 !== tenant.wework_corp_id) {
      return res.status(403).type('text/plain').send('corp id mismatch');
    }
    await persistInboundXml(tenant, msgUtf8);
  } catch (e) {
    console.error('[wework msg-callback POST]', e);
  }

  return res.type('text/plain').send('success');
}

/** 供路由挂载：仅对 POST 使用 text body */
export const receiveCallbackBodyParser = express.text({ type: '*/*', limit: '2mb' });
