#!/bin/bash
# ECS 一键：后端硬拦截支付宝 + 检查配置（勿在 bash 里粘贴 JS 代码）
set -euo pipefail
BACKEND="/var/www/wework-saas/backend"
CTRL="$BACKEND/src/controllers/billing.controller.js"

echo "==> 1. .env"
grep -E '^ALIPAY_(DISABLED|APP_ID)=' "$BACKEND/.env" || true
grep -q '^ALIPAY_DISABLED=1' "$BACKEND/.env" || echo 'ALIPAY_DISABLED=1' >> "$BACKEND/.env"
sed -i 's/^ALIPAY_APP_ID=.*/ALIPAY_APP_ID=/' "$BACKEND/.env"

echo "==> 2. billing.controller.js 硬拦截"
if grep -q '支付宝支付暂未开放' "$CTRL" 2>/dev/null; then
  echo "OK 已含拦截逻辑"
else
  cp -a "$CTRL" "$CTRL.bak.$(date +%Y%m%d%H%M%S)"
  python3 << 'PY'
from pathlib import Path
p = Path("/var/www/wework-saas/backend/src/controllers/billing.controller.js")
text = p.read_text(encoding="utf-8")
needle = "  if (pay_channel === 'alipay') {\n    const record = await billingService.createAlipayPayment"
if needle not in text:
    needle2 = "  if (pay_channel === 'alipay') {"
    if needle2 in text and "支付宝支付暂未开放" not in text:
        text = text.replace(
            needle2,
            "  if (pay_channel === 'alipay') {\n    throw new HttpError(503, '支付宝支付暂未开放，请使用微信或线下转账', 503);",
            1,
        )
    else:
        raise SystemExit("无法自动修补 controller，请上传本仓库 billing.controller.js")
else:
    pass
if "isAlipayConfigured" not in text and "from '../services/alipay.service.js'" in text:
    text = text.replace(
        "import { isAlipayMock } from '../services/alipay.service.js';",
        "import { isAlipayConfigured, isAlipayMock } from '../services/alipay.service.js';",
    )
p.write_text(text, encoding="utf-8")
print("OK patched", p)
PY
fi

echo "==> 3. 重启 API"
pm2 delete syqw-api 2>/dev/null || true
pm2 start "$BACKEND/src/app.js" --name syqw-api -i 2 --cwd "$BACKEND" --update-env
pm2 save

echo "==> 4. 验证"
cd "$BACKEND"
node --input-type=module -e "import * as a from './src/services/alipay.service.js'; console.log('isAlipayConfigured', a.isAlipayConfigured());"

echo ""
echo "==> 5. 前端 dist 必须是新构建（含 VITE_ALIPAY_ENABLED=0）"
DIST="/var/www/wework-saas/frontend/dist"
if [ -d "$DIST/assets" ]; then
  if grep -rl 'VITE_ALIPAY_ENABLED' "$DIST" 2>/dev/null | head -1 | grep -q .; then
    echo "可能已是新包"
  else
  COUNT=$(grep -rl '支付宝' "$DIST/assets" 2>/dev/null | wc -l | tr -d ' ')
  echo "dist 内仍有「支付宝」字符串的文件数: $COUNT（>0 说明还是旧前端，需上传新 dist）"
  fi
fi
echo "完成。请上传本机 frontend/dist 覆盖 $DIST 后 Ctrl+Shift+R 强刷浏览器。"
