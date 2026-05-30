/**
 * @file 企微接收消息加解密（WXBizMsgCrypt，AES-256-CBC），与官方文档一致。
 * @see https://developer.work.weixin.qq.com/document/path/90930
 */
import crypto from 'crypto';

/**
 * @param {Buffer} buf 已去 PKCS7 填充
 */
function unpackContent(buf) {
  if (buf.length < 20) throw new Error('解密内容过短');
  const msgLen = buf.readUInt32BE(16);
  if (msgLen < 0 || 20 + msgLen > buf.length) throw new Error('无效的明文长度');
  const msg = buf.subarray(20, 20 + msgLen);
  const receiveId = buf.subarray(20 + msgLen);
  return {
    msgUtf8: msg.toString('utf8'),
    receiveIdUtf8: receiveId.toString('utf8'),
  };
}

/**
 * AES 解密 rawBase64，返回完整明文 Buffer（未 strip random/msg_len 外层）
 * @param {string} encodingAesKey 43 位 EncodingAESKey
 * @param {string} encryptedBase64
 */
export function decryptBase64(encodingAesKey, encryptedBase64) {
  const key = Buffer.from(`${encodingAesKey}=`, 'base64');
  if (key.length !== 32) {
    throw new Error('EncodingAESKey 长度应为 43 位');
  }
  const iv = key.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  decipher.setAutoPadding(false);
  const input = Buffer.from(encryptedBase64, 'base64');
  let out = Buffer.concat([decipher.update(input), decipher.final()]);
  const padLen = out[out.length - 1];
  if (padLen > 32 || padLen < 1) {
    throw new Error('无效的 PKCS7 填充');
  }
  out = out.subarray(0, out.length - padLen);
  return out;
}

/**
 * @param {string} encodingAesKey
 * @param {string} encryptedBase64 接口下发的 Encrypt / echostr
 * @returns {{ msgUtf8: string; receiveIdUtf8: string }}
 */
export function decryptWxMessage(encodingAesKey, encryptedBase64) {
  const plainBuf = decryptBase64(encodingAesKey, encryptedBase64);
  if (plainBuf.length < 20) throw new Error('明文结构无效');
  return unpackContent(plainBuf);
}

/**
 * 校验 msg_signature
 * @param {string} token 租户回调 Token
 */
export function verifySignature(token, timestamp, nonce, encrypt, msgSignature) {
  const sorted = [token, String(timestamp), String(nonce), encrypt].sort().join('');
  const hash = crypto.createHash('sha1').update(sorted).digest('hex');
  return hash === msgSignature;
}
