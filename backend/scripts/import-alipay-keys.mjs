#!/usr/bin/env node
/**
 * 从支付宝密钥工具目录导入应用私钥 + 更新支付宝公钥。
 * 用法：
 *   node scripts/import-alipay-keys.mjs "/path/to/密钥20260602233428"
 *   node scripts/import-alipay-keys.mjs --private ./app_private.pem --alipay-public ~/Downloads/alipayPublicKey_RSA2.txt
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

function toPem(body, label) {
  const b = String(body).replace(/\s/g, '');
  const lines = b.match(/.{1,64}/g) || [b];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function readMaybePem(filePath, label) {
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (raw.includes('BEGIN')) return raw;
  return toPem(raw, label);
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (!args.length) return null;
  let toolDir = null;
  let privPath = null;
  let aliPath = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--private') privPath = args[++i];
    else if (args[i] === '--alipay-public') aliPath = args[++i];
    else if (!args[i].startsWith('-')) toolDir = args[i];
  }
  return { toolDir, privPath, aliPath };
}

function main() {
  const opts = parseArgs();
  if (!opts) {
    console.error(`用法:
  node scripts/import-alipay-keys.mjs "<支付宝密钥工具目录>"
  node scripts/import-alipay-keys.mjs --private <应用私钥.txt> --alipay-public <支付宝公钥.txt>`);
    process.exit(1);
  }

  let privPem;
  let appPubPem;
  let aliPem;

  if (opts.toolDir) {
    const dir = path.resolve(opts.toolDir);
    const privFile = path.join(dir, '应用私钥RSA2048-敏感数据，请妥善保管.txt');
    const pubFile = path.join(dir, '应用公钥RSA2048.txt');
    if (!fs.existsSync(privFile)) {
      console.error('未找到:', privFile);
      process.exit(1);
    }
    privPem = readMaybePem(privFile, 'RSA PRIVATE KEY');
    if (fs.existsSync(pubFile)) {
      appPubPem = readMaybePem(pubFile, 'PUBLIC KEY') + '\n';
    }
    const aliCandidates = fs
      .readdirSync(path.dirname(dir))
      .filter((f) => f.startsWith('alipayPublicKey') || f.includes('支付宝公钥'));
    /* 支付宝公钥在开放平台下载，不在工具目录 */
  }

  if (opts.privPath) {
    privPem = readMaybePem(path.resolve(opts.privPath), 'RSA PRIVATE KEY');
  }
  if (opts.aliPath) {
    aliPem = readMaybePem(path.resolve(opts.aliPath), 'PUBLIC KEY') + '\n';
  }

  if (!privPem) {
    console.error('缺少应用私钥');
    process.exit(1);
  }

  const derivedBody = crypto
    .createPublicKey(crypto.createPrivateKey(privPem))
    .export({ type: 'spki', format: 'pem' })
    .replace(/-----[^-]+-----/g, '')
    .replace(/\s/g, '');

  if (appPubPem) {
    const uploadedBody = appPubPem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    if (derivedBody !== uploadedBody) {
      console.error('私钥与工具目录中的应用公钥不匹配，请确认目录正确');
      process.exit(1);
    }
  }

  const certDir = path.join(backendRoot, 'certs', 'alipay');
  fs.mkdirSync(certDir, { recursive: true });
  fs.writeFileSync(path.join(certDir, 'app_private_key.pem'), privPem + '\n');
  if (appPubPem) {
    fs.writeFileSync(path.join(certDir, 'app_public_key_for_upload.pem'), appPubPem);
  }
  if (aliPem) {
    fs.writeFileSync(path.join(certDir, 'alipay_public_key.pem'), aliPem);
  }

  dotenv.config({ path: path.join(backendRoot, '.env') });
  let envText = fs.readFileSync(path.join(backendRoot, '.env'), 'utf8');
  const privEnv = privPem.trim().replace(/\n/g, '\\n');
  if (envText.includes('ALIPAY_PRIVATE_KEY=')) {
    envText = envText.replace(/ALIPAY_PRIVATE_KEY=[^\n]*/, `ALIPAY_PRIVATE_KEY=${privEnv}`);
  } else {
    envText += `\nALIPAY_PRIVATE_KEY=${privEnv}\n`;
  }
  if (aliPem && envText.includes('ALIPAY_PUBLIC_KEY=')) {
    const aliEnv = aliPem.trim().replace(/\n/g, '\\n');
    envText = envText.replace(/ALIPAY_PUBLIC_KEY=[^\n]*/, `ALIPAY_PUBLIC_KEY=${aliEnv}`);
  }
  if (!envText.includes('ALIPAY_APP_ID=2021000106623328')) {
    envText = envText.replace(/ALIPAY_APP_ID=[^\n]*/, 'ALIPAY_APP_ID=2021000106623328');
  }
  fs.writeFileSync(path.join(backendRoot, '.env'), envText);

  console.log('已写入 certs/alipay/app_private_key.pem 与 .env ALIPAY_PRIVATE_KEY');
  if (aliPem) console.log('已更新 ALIPAY_PUBLIC_KEY / alipay_public_key.pem');
  console.log('请执行: npm run verify:alipay');
}

main();
