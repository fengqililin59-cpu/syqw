#!/bin/bash
# 若无法上传 ecs_patch_env_alipay.py，可在 ECS 用 curl 从本机拉取，或 Workbench 新建该 py 文件后执行。
# 此处提供最小内联：仅当 env.js 无 readPem 时，用 Python 写入补丁（需已存在 deploy/ecs_patch_env_alipay.py）
set -euo pipefail
PY="/var/www/wework-saas/deploy/ecs_patch_env_alipay.py"
if [ ! -f "$PY" ]; then
  echo "请上传 deploy/ecs_patch_env_alipay.py 到 $PY"
  exit 1
fi
python3 "$PY"
cd /var/www/wework-saas/backend
pm2 restart syqw-api --update-env
sleep 2
node --input-type=module -e "
import { env } from './src/config/env.js';
import * as a from './src/services/alipay.service.js';
console.log('privLen', env.alipay.privateKey.length);
console.log('pubLen', env.alipay.publicKey.length);
console.log('disabled', env.alipay.disabled);
console.log('isAlipayConfigured', a.isAlipayConfigured());
"
