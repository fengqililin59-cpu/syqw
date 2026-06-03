# ECS 支付宝 + 计费页修复清单

## 现象对照

| 现象 | 原因 |
|------|------|
| 支付宝跳转 URL 里 `app_id=2021006156617373` | **生产 `.env` 仍是旧应用**，未同步本机已改好的 `2021000106623328` |
| 本机 `npm run verify:alipay` 显示「网关验签: 通过」 | 本机密钥已对，**只差 ECS 同步** |
| `/billing/balance`、`/addons/mine`、`/subscription/auto-renew` 500，消息含 **`Unknown column 'NaN'`** | 生产 `auth.js` 未注入 `req.tenantId`；**部署** `balance.controller.js`、`addon.controller.js`（改用 `req.auth.tenantId`）或 `middlewares/auth.js` |
| `/billing/balance` 等 500（其它 SQL 报错） | **库表缺列**（见下方 SQL） |

Mac `rsync` 到 `wework.syzs.top:22` 会被安全组断开，请用 **阿里云 Workbench** 改服务器文件。

## 弹窗 `error:1E08010C:DECODER routines::unsupported`

`.env` 里内联私钥粘贴损坏（换行/引号错误）时会出现。推荐改用 **PEM 文件**（最稳）：

```bash
# Workbench 上传到 /var/www/wework-saas/backend/certs/alipay/
#   app_private_key.pem
#   alipay_public_key.pem

cd /var/www/wework-saas/backend
nano .env
```

注释掉整行 `ALIPAY_PRIVATE_KEY=` / `ALIPAY_PUBLIC_KEY=`，改为：

```bash
ALIPAY_PRIVATE_KEY_PATH=certs/alipay/app_private_key.pem
ALIPAY_PUBLIC_KEY_PATH=certs/alipay/alipay_public_key.pem
```

检测：

```bash
node scripts/test-alipay-pem.mjs   # 需先部署含该脚本的 backend/src
pm2 restart syqw-api --update-env
```

---

## 一、在 ECS 上更新支付宝（必做）

路径以实际为准，常见：

- `/var/www/wework-saas/backend/.env`
- 或 `/var/www/zhiflow/backend/.env`

在 Workbench 终端：

```bash
cd /var/www/wework-saas/backend   # 按 pm2 进程 cwd 调整
pm2 show syqw-api | grep -E 'exec cwd|script path'   # 确认目录
nano .env   # 或 vi .env
```

**必须修改的三项（与本机 `backend/.env` 一致）：**

```bash
ALIPAY_APP_ID=2021000106623328
ALIPAY_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...（整段应用私钥，来自密钥工具 密钥20260602233428）\n-----END RSA PRIVATE KEY-----
ALIPAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...（开放平台「支付宝公钥」）\n-----END PUBLIC KEY-----
ALIPAY_MOCK=0
ALIPAY_SANDBOX=0
BILLING_NOTIFY_BASE_URL=https://wework.syzs.top
```

也可直接上传本机文件（Workbench 文件管理）：

- `backend/certs/alipay/app_private_key.pem`
- `backend/certs/alipay/alipay_public_key.pem`

并在 `.env` 中只写路径（若代码支持）或继续用内联 PEM。

保存后：

```bash
pm2 restart syqw-api --update-env    # 名称以 pm2 list 为准
cd /var/www/wework-saas/backend && node scripts/verify-alipay.mjs
```

应看到：**网关验签: 通过**（若仍 `ACCESS_FORBIDDEN` 需在开放平台签约「电脑网站支付」）。

---

## 二、验证生产是否已切到新 AppID

浏览器打开支付宝报错页，看 URL 里的 `app_id=`：

- ✅ 应为 `2021000106623328`
- ❌ 若仍是 `2021006156617373` → `.env` 未生效或未 restart PM2

---

## 三、计费页 500（balance / transactions / auto-renew / addons）

**你已配好密钥仍 500 时**：多半是 **未改 controller**，错误为 `Unknown column 'NaN'`。

在 ECS 执行（或上传 `deploy/ecs_hotfix_billing_now.sh` 后 `bash`）：

```bash
cd /var/www/wework-saas/backend
sed -i 's/Number(req\.tenantId)/Number(req.auth.tenantId)/g' \
  src/controllers/balance.controller.js \
  src/controllers/addon.controller.js
grep -q 'function loadPem' src/services/alipay.service.js || echo '请上传新版 alipay.service.js'
pm2 restart syqw-api --update-env
```

`curl` 测 balance 必须用 **浏览器里复制的真实 JWT**，不能写 `你的JWT` 或 `<JWT>`（会 401）。

1. **部署** `balance.controller.js`、`addon.controller.js`、`alipay.service.js`（含 `loadPem`）
2. **在 MySQL 执行**（库名以生产为准，如 `wework_saas` / `zhiflow_prod`）：

```bash
mysql -u root -p -D wework_saas < deploy/ecs_fix_billing.sql
```

3. 重启 API 后刷新 `https://wework.syzs.top/app/billing`（建议无痕窗口）

---

## 四、本机一键导出说明（不上传私钥到聊天）

```bash
cd /Users/591464076qq.com/syqw/backend
npm run import:alipay-keys -- \
  "/Users/591464076qq.com/Documents/支付宝开放平台密钥工具/密钥20260602233428" \
  --alipay-public "/Users/591464076qq.com/Downloads/alipayPublicKey_RSA2 (5).txt"
npm run verify:alipay
```

然后把 **整个 `backend/.env` 里 ALIPAY_* 段** 复制到 ECS（勿提交 Git）。
