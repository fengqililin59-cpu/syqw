#!/usr/bin/env node
/** 在 ECS 上快速检测支付宝密钥能否被 Node 解析。用法：cd backend && node scripts/test-alipay-pem.mjs */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function tryLoad(label, raw, type) {
  const s = String(raw || '').replace(/\\n/g, '\n').trim();
  if (!s) {
    console.log(`${label}: 未配置`);
    return false;
  }
  try {
    if (type === 'private') crypto.createPrivateKey(s.includes('BEGIN') ? s : `-----BEGIN RSA PRIVATE KEY-----\n${s}\n-----END RSA PRIVATE KEY-----`);
    else crypto.createPublicKey(s.includes('BEGIN') ? s : `-----BEGIN PUBLIC KEY-----\n${s}\n-----END PUBLIC KEY-----`);
    console.log(`${label}: OK (长度 ${s.length})`);
    return true;
  } catch (e) {
    console.log(`${label}: 失败 — ${e.message}`);
    return false;
  }
}

const privPath = path.join(__dirname, '..', 'certs/alipay/app_private_key.pem');
const pubPath = path.join(__dirname, '..', 'certs/alipay/alipay_public_key.pem');

console.log('APP_ID:', process.env.ALIPAY_APP_ID);
if (fs.existsSync(privPath)) {
  tryLoad('私钥文件', fs.readFileSync(privPath, 'utf8'), 'private');
} else {
  tryLoad('ALIPAY_PRIVATE_KEY', process.env.ALIPAY_PRIVATE_KEY, 'private');
}
if (fs.existsSync(pubPath)) {
  tryLoad('公钥文件', fs.readFileSync(pubPath, 'utf8'), 'public');
} else {
  tryLoad('ALIPAY_PUBLIC_KEY', process.env.ALIPAY_PUBLIC_KEY, 'public');
}
