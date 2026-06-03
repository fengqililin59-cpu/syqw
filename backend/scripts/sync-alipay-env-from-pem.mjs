#!/usr/bin/env node
/**
 * 将 certs/alipay/*.pem 写入 .env 的 ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY（内联 \\n）。
 * 用于生产 env.js 尚不支持 ALIPAY_*_PATH 时。
 * 用法：cd backend && node scripts/sync-alipay-env-from-pem.mjs && pm2 restart syqw-api --update-env
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');
const privPath = path.join(root, 'certs/alipay/app_private_key.pem');
const pubPath = path.join(root, 'certs/alipay/alipay_public_key.pem');

if (!fs.existsSync(privPath) || !fs.existsSync(pubPath)) {
  console.error('缺少 certs/alipay/app_private_key.pem 或 alipay_public_key.pem');
  process.exit(1);
}

const privEnv = fs.readFileSync(privPath, 'utf8').trim().replace(/\r?\n/g, '\\n');
const pubEnv = fs.readFileSync(pubPath, 'utf8').trim().replace(/\r?\n/g, '\\n');

let text = fs.readFileSync(envPath, 'utf8');
const setOrReplace = (key, val) => {
  const line = `${key}=${val}`;
  if (new RegExp(`^${key}=`, 'm').test(text)) {
    text = text.replace(new RegExp(`^${key}=.*`, 'm'), line);
  } else {
    text += `\n${line}\n`;
  }
};

setOrReplace('ALIPAY_PRIVATE_KEY', privEnv);
setOrReplace('ALIPAY_PUBLIC_KEY', pubEnv);
text = text.replace(/^ALIPAY_PRIVATE_KEY_PATH=.*\n?/m, '');
text = text.replace(/^ALIPAY_PUBLIC_KEY_PATH=.*\n?/m, '');

fs.writeFileSync(envPath, text);
console.log('已写入 .env: ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY（内联）');
console.log('私钥长度', privEnv.length, '公钥长度', pubEnv.length);
