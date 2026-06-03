#!/bin/bash
# ECS 计费页热修复（NaN 500 + 支付宝 DECODER 前置检查）
# 用法：在 Workbench 粘贴整段，或：
#   cd /var/www/wework-saas/backend && bash /path/to/ecs_hotfix_billing_now.sh
set -euo pipefail

ROOT="${WEWORK_BACKEND:-/var/www/wework-saas/backend}"
cd "$ROOT"

echo "==> 工作目录: $(pwd)"

# --- 1. 修复 balance / addon 使用 req.tenantId => NaN ---
for f in src/controllers/balance.controller.js src/controllers/addon.controller.js; do
  if [ ! -f "$f" ]; then
    echo "WARN: 缺少 $f，请从本仓库上传"
    continue
  fi
  if grep -q 'Number(req\.tenantId)' "$f"; then
    cp -a "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"
    sed -i 's/Number(req\.tenantId)/Number(req.auth.tenantId)/g' "$f"
    echo "OK 已修补: $f"
  else
    echo "OK 已是最新: $f (无 req.tenantId)"
  fi
done

# --- 2. auth.js 注入 req.tenantId（可选双保险）---
AUTH=src/middlewares/auth.js
if [ -f "$AUTH" ] && ! grep -q 'req\.tenantId = req\.auth\.tenantId' "$AUTH"; then
  echo "WARN: $AUTH 未注入 req.tenantId，建议上传本仓库 middlewares/auth.js"
else
  echo "OK auth.js"
fi

# --- 3. 支付宝 loadPem（DECODER 必须）---
if grep -q 'function loadPem' src/services/alipay.service.js 2>/dev/null; then
  echo "OK alipay.service.js 含 loadPem"
else
  echo "ERROR: src/services/alipay.service.js 为旧版，无 loadPem → 请上传本仓库该文件后重跑本脚本"
  exit 1
fi

# --- 4. 密钥自检 ---
if [ -f scripts/test-alipay-pem.mjs ]; then
  node scripts/test-alipay-pem.mjs || true
else
  node --input-type=module -e "
import crypto from 'crypto';
import { env } from './src/config/env.js';
const s = String(env.alipay.privateKey||'').replace(/\\\\n/g,'\\n');
try { crypto.createPrivateKey(s); console.log('私钥: OK'); }
catch(e) { console.error('私钥: FAIL', e.message); process.exit(1); }
"
fi

# --- 5. 重启 API ---
pm2 restart syqw-api --update-env
sleep 2
pm2 show syqw-api | grep -E 'status|exec cwd' | head -6

echo ""
echo "==> 下一步（勿用占位符）："
echo "  1) 浏览器 F12 → Application → Local Storage → 复制 token"
echo "  2) curl -sS -H \"Authorization: Bearer <真实JWT>\" http://127.0.0.1:3010/api/v1/billing/balance"
echo "     应返回 balance 数字，而非 Unknown column NaN"
echo "  3) 取消 pending 支付宝单（须在 mysql 里执行，不要直接在 bash 敲 UPDATE）："
echo "     mysql -u root -p -D wework_saas -e \"UPDATE payment_records SET status='cancelled', pay_code_url=NULL WHERE pay_channel='alipay' AND status='pending';\""
echo "  4) 无痕刷新 https://wework.syzs.top/app/billing"
