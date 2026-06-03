#!/usr/bin/env bash
# ZhiFlow 生产部署前自检（在仓库根目录执行）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> ZhiFlow deploy-check"
echo "Root: $ROOT"
echo ""

fail=0
warn=0

check() {
  if "$@"; then
    echo "  [OK] $*"
  else
    echo "  [FAIL] $*"
    fail=$((fail + 1))
  fi
}

warn_if() {
  if "$@"; then
    echo "  [OK] $*"
  else
    echo "  [WARN] $*"
    warn=$((warn + 1))
  fi
}

echo "-- 工具链"
command -v node >/dev/null && check node -v || { echo "  [FAIL] node 未安装"; fail=$((fail + 1)); }
command -v npm >/dev/null && check npm -v || { echo "  [FAIL] npm 未安装"; fail=$((fail + 1)); }
command -v mysql >/dev/null && warn_if mysql --version || echo "  [WARN] mysql 客户端未安装（无法本地验库）"

echo ""
echo "-- 前端构建"
if [ -d "$ROOT/frontend" ]; then
  (cd "$ROOT/frontend" && npm run build >/dev/null) && echo "  [OK] frontend npm run build" || { echo "  [FAIL] frontend build"; fail=$((fail + 1)); }
else
  echo "  [FAIL] 缺少 frontend/"
  fail=$((fail + 1))
fi

echo ""
echo "-- 后端入口"
warn_if test -f "$ROOT/backend/src/app.js"
warn_if test -f "$ROOT/backend/.env.example"

if [ -f "$ROOT/backend/.env" ]; then
  echo ""
  echo "-- backend/.env 关键项（仅检查是否非空）"
  for key in JWT_SECRET DB_PASSWORD DEEPSEEK_API_KEY FRONTEND_URL APP_URL; do
    if grep -q "^${key}=." "$ROOT/backend/.env" 2>/dev/null && ! grep -q "^${key}=$" "$ROOT/backend/.env" 2>/dev/null && ! grep -q "change_me" "$ROOT/backend/.env" 2>/dev/null; then
      echo "  [OK] $key 已配置"
    else
      echo "  [WARN] $key 未配置或使用占位值"
      warn=$((warn + 1))
    fi
  done
  for key in WEWORK_CORP_ID WEWORK_SECRET PLATFORM_ADMIN_USER_IDS; do
    if grep -q "^${key}=." "$ROOT/backend/.env" 2>/dev/null && ! grep -q "^${key}=$" "$ROOT/backend/.env" 2>/dev/null && ! grep -qE "^${key}=(change_me|your_|placeholder)" "$ROOT/backend/.env" 2>/dev/null; then
      echo "  [OK] $key 已配置"
    else
      echo "  [WARN] $key 未配置或使用占位值（生产必填）"
      warn=$((warn + 1))
    fi
  done
  echo ""
  echo "-- backend/.env 生产危险项（Mock / 跳过验签）"
  for key in WECHAT_PAY_MOCK ALIPAY_MOCK WECHAT_PAY_SKIP_SIGNATURE_VERIFY; do
    if grep -qE "^${key}=1" "$ROOT/backend/.env" 2>/dev/null; then
      echo "  [WARN] $key=1 已开启，生产环境应关闭"
      warn=$((warn + 1))
    fi
  done
  if ! grep -qE '^INBOX_AI_AUTO_SEND=' "$ROOT/backend/.env" 2>/dev/null; then
    echo "  [WARN] INBOX_AI_AUTO_SEND 未设置：默认允许租户侧开关；首发建议显式 INBOX_AI_AUTO_SEND=0（见 docs/deploy/go-live-ai-inbox.md）"
    warn=$((warn + 1))
  fi
  if ! grep -qE '^REGISTER_OTP_REQUIRED=1' "$ROOT/backend/.env" 2>/dev/null; then
    echo "  [WARN] REGISTER_OTP_REQUIRED 未设为 1：公开推广自助注册前建议开启并配置 SMTP/短信（见 docs/deploy/go-live-ai-inbox.md §八）"
    warn=$((warn + 1))
  fi
  if ! grep -qE '^ENABLE_PLATFORM_OPS_DIGEST_CRON=1' "$ROOT/backend/.env" 2>/dev/null; then
    echo "  [WARN] ENABLE_PLATFORM_OPS_DIGEST_CRON 未设为 1：平台运营日报 cron 不会运行（推广平台运营能力前建议开启）"
    warn=$((warn + 1))
  fi
else
  echo "  [WARN] 无 backend/.env，请从 .env.example 复制"
  warn=$((warn + 1))
fi

echo ""
echo "-- 账单 PDF 字体"
pdf_font_path=""
if [ -f "$ROOT/backend/.env" ]; then
  pdf_font_path="$(grep -E '^BILLING_PDF_FONT_PATH=' "$ROOT/backend/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d "'\"" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' || true)"
fi
if [ -z "$pdf_font_path" ]; then
  echo "  [WARN] BILLING_PDF_FONT_PATH 未配置，账单 format=pdf 可能返回 503（见 backend/assets/fonts/README.md）"
  warn=$((warn + 1))
elif [ ! -f "$pdf_font_path" ]; then
  echo "  [WARN] BILLING_PDF_FONT_PATH 指向的文件不存在: $pdf_font_path（format=pdf 可能 503，见 backend/assets/fonts/README.md）"
  warn=$((warn + 1))
else
  echo "  [OK] BILLING_PDF_FONT_PATH 已配置且文件存在"
fi

echo ""
echo "-- 建议执行的 SQL 迁移（请对照生产库是否已跑）"
for f in \
  database/043_billing.sql \
  database/062_billing_promo_codes.sql \
  database/064_ai_assistant_plans.sql \
  database/065_payment_wechat_columns.sql \
  database/072_tenant_inbox_ai_auto_send.sql \
  database/073_tenant_inbox_ai_auto_send_pricing.sql \
  database/074_tenant_inbox_ai_notify_assignee.sql \
  database/075_tenant_inbox_ai_platform_disabled.sql \
  database/076_ai_reply_logs_qa.sql; do
  if [ -f "$ROOT/$f" ]; then
    echo "  - $f"
  fi
done

echo ""
echo "-- 收件箱 AI 上线清单"
test -f "$ROOT/docs/deploy/go-live-ai-inbox.md" && echo "  [OK] docs/deploy/go-live-ai-inbox.md" || echo "  [WARN] 缺少 go-live-ai-inbox.md"

echo ""
echo "-- 后端单测（收件箱 AI 异常分级 + 自动发资格）"
if [ -d "$ROOT/backend" ]; then
  (cd "$ROOT/backend" && npm test >/dev/null 2>&1) && echo "  [OK] backend npm test" || { echo "  [WARN] backend npm test 未通过或未配置"; warn=$((warn + 1)); }
fi

echo ""
echo "-- 文档"
test -f "$ROOT/docs/deploy/production-checklist.md" && echo "  [OK] docs/deploy/production-checklist.md" || echo "  [WARN] 缺少生产清单"

echo ""
if [ "$fail" -gt 0 ]; then
  echo "结果: 失败 ($fail 项错误, $warn 项警告)"
  exit 1
fi
echo "结果: 通过 ($warn 项警告，请查阅 production-checklist.md 后上线)"
exit 0
