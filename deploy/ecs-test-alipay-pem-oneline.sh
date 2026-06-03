#!/bin/bash
# 在 ECS 上检测支付宝 PEM（无需 scripts/test-alipay-pem.mjs）
# 用法: bash /tmp/ecs-test-alipay-pem-oneline.sh
cd /var/www/wework-saas/backend || exit 1
node --input-type=module <<'NODE'
import crypto from 'crypto';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

function test(label, pemPath, envKey, type) {
  let raw = pemPath && fs.existsSync(pemPath) ? fs.readFileSync(pemPath, 'utf8') : process.env[envKey];
  if (!raw) {
    console.log(label + ': 未配置');
    return;
  }
  raw = String(raw).replace(/\\n/g, '\n').trim();
  try {
    if (type === 'private') crypto.createPrivateKey(raw);
    else crypto.createPublicKey(raw);
    console.log(label + ': OK');
  } catch (e) {
    console.log(label + ': 失败 — ' + e.message);
  }
}

console.log('APP_ID:', process.env.ALIPAY_APP_ID);
test('私钥', 'certs/alipay/app_private_key.pem', 'ALIPAY_PRIVATE_KEY', 'private');
test('支付宝公钥', 'certs/alipay/alipay_public_key.pem', 'ALIPAY_PUBLIC_KEY', 'public');
NODE
