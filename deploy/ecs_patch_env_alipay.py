#!/usr/bin/env python3
"""在 ECS 上为旧版 env.js 打上 readPemFromEnvOrFile + alipay 块。用法：
  python3 /var/www/wework-saas/deploy/ecs_patch_env_alipay.py
"""
from pathlib import Path
import re
import shutil
import sys

ENV_JS = Path('/var/www/wework-saas/backend/src/config/env.js')

READ_PEM_FN = '''
/** 优先读环境变量 PEM；否则读 ALIPAY_*_PATH 或 certs 下默认文件 */
function readPemFromEnvOrFile(inlineEnv, pathEnv, defaultRelativePath) {
  const inline = (process.env[inlineEnv] || '').trim();
  if (inline) return inline;
  const rel = (process.env[pathEnv] || defaultRelativePath || '').trim();
  if (!rel) return '';
  const abs = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
  try {
    if (fs.existsSync(abs)) return fs.readFileSync(abs, 'utf8').trim();
  } catch {
    /* ignore */
  }
  return '';
}
'''

ALIPAY_BLOCK = '''  alipay: {
    disabled: process.env.ALIPAY_DISABLED === '1',
    mock: process.env.ALIPAY_MOCK === '1',
    sandbox: process.env.ALIPAY_SANDBOX === '1',
    appId: (process.env.ALIPAY_APP_ID || '').trim(),
    privateKey: readPemFromEnvOrFile(
      'ALIPAY_PRIVATE_KEY',
      'ALIPAY_PRIVATE_KEY_PATH',
      'certs/alipay/app_private_key.pem',
    ),
    publicKey: readPemFromEnvOrFile(
      'ALIPAY_PUBLIC_KEY',
      'ALIPAY_PUBLIC_KEY_PATH',
      'certs/alipay/alipay_public_key.pem',
    ),
    notifyBaseUrl: (
      process.env.BILLING_NOTIFY_BASE_URL ||
      process.env.WEWORK_CALLBACK_URL ||
      process.env.APP_URL ||
      ''
    )
      .trim()
      .replace(/\\/$/, ''),
    skipSignatureVerify: process.env.ALIPAY_SKIP_SIGNATURE_VERIFY === '1',
  },'''


def main():
    if not ENV_JS.is_file():
        print('找不到', ENV_JS)
        sys.exit(1)
    text = ENV_JS.read_text(encoding='utf-8')
    if 'readPemFromEnvOrFile' in text:
        print('env.js 已含 readPemFromEnvOrFile，无需补丁')
        return
    bak = ENV_JS.with_suffix('.js.bak-alipay')
    shutil.copy2(ENV_JS, bak)
    print('已备份 ->', bak)

    if "import fs from 'node:fs'" not in text and 'import fs from' not in text:
        text = text.replace(
            "import dotenv from 'dotenv';",
            "import dotenv from 'dotenv';\nimport fs from 'node:fs';\nimport path from 'node:path';",
            1,
        )
    elif "import path from 'node:path'" not in text and "import path from 'path'" not in text:
        text = text.replace(
            "import fs from 'node:fs';",
            "import fs from 'node:fs';\nimport path from 'node:path';",
            1,
        )

    if 'dotenv.config();' in text and 'readPemFromEnvOrFile' not in text:
        text = text.replace('dotenv.config();', 'dotenv.config();' + READ_PEM_FN, 1)

    # 替换整个 alipay: { ... }, 块
    m = re.search(r'\n\s*alipay:\s*\{', text)
    if not m:
        print('ERROR: 未找到 alipay: { 块，请手动上传完整 env.js')
        sys.exit(1)
    start = m.start()
    depth = 0
    i = m.end() - 1
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                if end < len(text) and text[end] == ',':
                    end += 1
                text = text[:start] + '\n' + ALIPAY_BLOCK + text[end:]
                break
        i += 1
    else:
        print('ERROR: alipay 块括号不匹配')
        sys.exit(1)

    ENV_JS.write_text(text, encoding='utf-8')
    print('OK: 已补丁 env.js，请 pm2 restart syqw-api --update-env')


if __name__ == '__main__':
    main()
