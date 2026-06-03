#!/bin/bash
# 若 Nginx 仍指向 3002 / zhiflow-api：把 wework-saas 已修好的支付宝 .env 同步到 zhiflow 并重启
set -euo pipefail
SRC="/var/www/wework-saas/backend"
DST="/var/www/zhiflow/backend"

if [ ! -d "$DST" ]; then
  echo "无 $DST，跳过；请改用 ecs_point_nginx_to_3010.sh"
  exit 1
fi

echo "同步 PEM 与 alipay 服务文件..."
mkdir -p "$DST/certs/alipay"
cp -f "$SRC/certs/alipay/app_private_key.pem" "$DST/certs/alipay/"
cp -f "$SRC/certs/alipay/alipay_public_key.pem" "$DST/certs/alipay/"
cp -f "$SRC/src/services/alipay.service.js" "$DST/src/services/"
[ -f "$SRC/src/config/env.js" ] && cp -f "$SRC/src/config/env.js" "$DST/src/config/" || true

# 从 wework-saas .env 提取支付宝相关行写入 zhiflow .env
python3 << PY
import re
from pathlib import Path
src = Path("$SRC/.env").read_text(encoding="utf-8", errors="ignore").splitlines()
dst_path = Path("$DST/.env")
dst_lines = dst_path.read_text(encoding="utf-8", errors="ignore").splitlines() if dst_path.exists() else []
keys = {l.split("=",1)[0] for l in src if "=" in l and l.startswith("ALIPAY_")}
keys |= {"BILLING_NOTIFY_BASE_URL"}
dst_lines = [l for l in dst_lines if l.split("=",1)[0] not in keys]
for l in src:
    if "=" in l and (l.startswith("ALIPAY_") or l.startswith("BILLING_NOTIFY_BASE_URL")):
        dst_lines.append(l)
dst_path.write_text("\n".join(dst_lines) + "\n", encoding="utf-8")
print("OK: 已合并支付宝配置到", dst_path)
PY

# 若无内联密钥且 env 过旧，用 wework 同样 python 内联写法
cd "$DST"
priv_len=$(node --input-type=module -e "import {env} from './src/config/env.js'; console.log(env.alipay.privateKey.length)" 2>/dev/null || echo 0)
if [ "$priv_len" = "0" ] && [ -f "$SRC/.env" ]; then
  echo "zhiflow privLen=0，从 wework-saas 复制 ALIPAY_PRIVATE_KEY/PUBLIC_KEY 行..."
  grep -E '^ALIPAY_PRIVATE_KEY=|^ALIPAY_PUBLIC_KEY=|^ALIPAY_DISABLED=|^ALIPAY_APP_ID=|^BILLING_NOTIFY' "$SRC/.env" >> "$DST/.env" || true
fi

grep -q '^PORT=3002' "$DST/.env" || echo 'PORT=3002' >> "$DST/.env"

pm2 restart zhiflow-api --update-env 2>/dev/null || {
  cd "$DST" && pm2 start src/app.js --name zhiflow-api --update-env
}
pm2 save 2>/dev/null || true
sleep 2

cd "$DST"
node --input-type=module -e "
import * as a from './src/services/alipay.service.js';
import { env } from './src/config/env.js';
console.log('zhiflow privLen', env.alipay.privateKey.length);
console.log('zhiflow isAlipayConfigured', a.isAlipayConfigured());
"
