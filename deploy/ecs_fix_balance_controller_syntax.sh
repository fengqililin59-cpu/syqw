#!/bin/bash
# 修复不完整 Python 补丁导致的 balance.controller.js 语法错误
set -euo pipefail
F="/var/www/wework-saas/backend/src/controllers/balance.controller.js"
SRC="/var/www/wework-saas-git/backend/src/controllers/balance.controller.js"

if [ -f "$SRC" ] && node --check "$SRC" 2>/dev/null; then
  cp "$SRC" "$F"
  echo "已从 git 目录复制（语法 OK）"
else
  python3 << 'PY'
from pathlib import Path
p = Path("/var/www/wework-saas/backend/src/controllers/balance.controller.js")
t = p.read_text(encoding="utf-8")
# 不完整补丁常见错误：HttpError(400, 'msg' }, 400);
import re
t2 = re.sub(
    r"throw new HttpError\(400, '([^']*)' \}, 400\);",
    r"throw new HttpError(400, '\1', 400);",
    t,
)
if "import { ok }" not in t2:
    t2 = t2.replace(
        "import { env } from '../config/env.js';",
        "import { ok } from '../utils/response.js';\nimport { env } from '../config/env.js';",
    )
if t2 != t:
    p.write_text(t2, encoding="utf-8")
    print("已修复 HttpError 语法")
else:
    print("未发现已知错误模式")
PY
fi

node --check "$F"
grep -c 'return ok(res' "$F" || true
pm2 restart syqw-api --update-env
echo "完成。请重新登录后刷新 /app/billing"
