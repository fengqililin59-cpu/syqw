#!/usr/bin/env node
/**
 * 支付宝密钥与网关验签诊断。
 * 用法：cd backend && node scripts/verify-alipay.mjs
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { env } from '../src/config/env.js';
import { createPrecreateOrder, isAlipayConfigured } from '../src/services/alipay.service.js';

function normalizePem(raw, label) {
  const s = String(raw || '').replace(/\\n/g, '\n').trim();
  if (!s) return null;
  if (s.includes('BEGIN')) return s;
  const body = s.replace(/\s/g, '');
  const lines = body.match(/.{1,64}/g) || [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function main() {
  console.log('=== 支付宝配置诊断 ===\n');
  console.log('APP_ID:', env.alipay.appId || '(未设置)');
  console.log('（须与开放平台应用详情页 AppID 一致，wework全行业SaaS = 2021000106623328）');
  console.log('MOCK:', env.alipay.mock);
  console.log('SANDBOX:', env.alipay.sandbox);
  console.log('notifyBase:', env.alipay.notifyBaseUrl || '(未设置)');
  console.log('已配置:', isAlipayConfigured());

  const priv = normalizePem(env.alipay.privateKey, 'RSA PRIVATE KEY');
  const aliPub = normalizePem(env.alipay.publicKey, 'PUBLIC KEY');
  if (!priv) {
    console.error('\n缺少应用私钥：设置 ALIPAY_PRIVATE_KEY 或放置 certs/alipay/app_private_key.pem');
    process.exit(1);
  }

  let localOk = false;
  try {
    const sample = `app_id=${env.alipay.appId}&charset=utf-8&method=alipay.trade.page.pay`;
    const sign = crypto.createSign('RSA-SHA256').update(sample, 'utf8').sign(priv, 'base64');
    const appPub = crypto.createPublicKey(crypto.createPrivateKey(priv)).export({
      type: 'spki',
      format: 'pem',
    });
    localOk = crypto.createVerify('RSA-SHA256').update(sample, 'utf8').verify(appPub, sign, 'base64');
    const outPath = path.join(__dirname, '..', 'certs', 'alipay', 'app_public_key_for_upload.pem');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, appPub, 'utf8');
    console.log('\n本地私钥可正常签名，已从私钥导出「应用公钥」供上传开放平台：');
    console.log(' ', outPath);
  } catch (e) {
    console.error('\n本地私钥无效:', e.message);
    process.exit(1);
  }
  console.log('本地私钥 ↔ 推导应用公钥 验签:', localOk ? '通过' : '失败');

  if (aliPub) {
    const appBody = normalizePem(
      crypto.createPublicKey(crypto.createPrivateKey(priv)).export({ type: 'spki', format: 'pem' }),
      'PUBLIC KEY',
    )
      .replace(/-----[^-]+-----/g, '')
      .replace(/\s/g, '');
    const aliBody = aliPub.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
    console.log('已配置支付宝公钥（用于异步通知验签，长度', aliPub.length, '）');
    if (appBody === aliBody) {
      console.warn(
        '\n⚠️  ALIPAY_PUBLIC_KEY 与「应用公钥」内容相同！\n' +
          '    Downloads 的 alipayPublicKey_RSA2.txt 是「支付宝公钥」，不能上传到「应用公钥」栏。\n' +
          '    请用 app_public_key_for_upload.pem 上传开放平台。',
      );
    }
  } else {
    console.warn('未配置 ALIPAY_PUBLIC_KEY（支付下单不依赖此项，但回调验签需要）');
  }

  if (!env.alipay.appId || env.alipay.mock) {
    console.log('\n跳过网关探测（未配置 APP_ID 或 ALIPAY_MOCK=1）');
    return;
  }

  console.log('\n正在请求支付宝网关 alipay.trade.precreate（0.01 元测试单）…');
}

main();

if (env.alipay.appId && !env.alipay.mock && isAlipayConfigured()) {
  createPrecreateOrder({
    outTradeNo: `VERIFY${Date.now()}`,
    subject: 'ZhiFlow密钥诊断',
    totalAmountYuan: '0.01',
  })
    .then((r) => {
      console.log('网关验签: 通过（已返回二维码）', r.mock ? '(mock)' : '');
      process.exit(0);
    })
    .catch((e) => {
      const msg = e.message || String(e);
      if (msg.includes('ACCESS_FORBIDDEN') || msg.includes('ACQ.ACCESS_FORBIDDEN')) {
        console.log('网关验签: 通过（密钥正确）');
        console.log('产品权限: 未开通 — 请在开放平台为该应用签约「电脑网站支付」或「当面付」等产品');
        process.exit(0);
      }
      console.log('网关验签: 失败');
      console.log(msg.slice(0, 500));
      if (msg.includes('验签') || msg.includes('invalid-signature')) {
        console.log(`
【修复步骤】（网关验签 = 开放平台「应用公钥」须与 .env 私钥成对）
1. 应用 ${env.alipay.appId}（wework全行业SaaS）→ 开发设置 → 接口加签方式 → RSA2
2. 「应用公钥」粘贴：certs/alipay/app_public_key_for_upload.pem（整段 PEM）
   ❌ 勿用 Downloads/alipayPublicKey_RSA2*.txt（那是「支付宝公钥」，只能填 .env 回调验签）
3. 保存后重新下载「支付宝公钥」→ 更新 ALIPAY_PUBLIC_KEY
4. 本机：npm run verify:alipay 直到「网关验签: 通过」
5. ECS：同步 .env 后 pm2 restart（进程名见 pm2 list，常见 syqw-api）
`);
      }
      process.exit(1);
    });
}
