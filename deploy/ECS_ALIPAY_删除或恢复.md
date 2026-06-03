# 支付宝：删除（当前方案）或恢复

## 关键发现（为何一直删不掉按钮）

Nginx 配置：

```nginx
root /var/www/wework;   # 实际对外目录
```

你之前只更新了 `/var/www/wework-saas/frontend/dist`，**浏览器仍读旧包**。

正确做法（你已执行过一次，以后每次发版都要做）：

```bash
rsync -a --delete /var/www/wework-saas/frontend/dist/ /var/www/wework/
nginx -s reload
```

或：`bash deploy/ecs_sync_frontend_to_wework.sh`

---

## 方案 A：删除支付宝（推荐，当前已按此执行）

| 项 | 状态 |
|----|------|
| 后端 `ALIPAY_DISABLED=1`、`APP_ID` 空 | `.env` |
| `isAlipayConfigured` | `false` |
| `billing.controller.js` 硬拦截 | 已 `python3` patch |
| 前端 `VITE_ALIPAY_ENABLED=0` | `index-CleyPqw2.js` |
| 同步到 Nginx | `rsync` → `/var/www/wework` |

### 验收（ECS）

```bash
# 1. 对外目录是新 JS
grep -o 'index-[^"]*\.js' /var/www/wework/index.html
# 应为 index-CleyPqw2.js

# 2. 后端关闭
cd /var/www/wework-saas/backend
node --input-type=module -e "import * as a from './src/services/alipay.service.js'; console.log(a.isAlipayConfigured())"
# false

# 3. 拦截已写入
grep '支付宝支付暂未开放' src/controllers/billing.controller.js
```

### 验收（浏览器）

1. 清 Local Storage → 无痕打开 `https://wework.syzs.top/app/billing`
2. F12 → Network：加载 **`/assets/index-CleyPqw2.js`**
3. 企业版：**无「支付宝」**，仅有微信 / 线下转账
4. 若仍点出 DECODER → 强刷或确认 Network 里 JS 文件名不是 `C6E6MFYY`

---

## 方案 B：恢复支付宝（以后需要时）

### 1. 开放平台

- 应用 `2021000106623328`
- 签约 **电脑网站支付**
- 应用私钥与开放平台「支付宝公钥」成对

### 2. ECS `.env`

```bash
ALIPAY_DISABLED=0
ALIPAY_APP_ID=2021000106623328
ALIPAY_PRIVATE_KEY_PATH=certs/alipay/app_private_key.pem
ALIPAY_PUBLIC_KEY_PATH=certs/alipay/alipay_public_key.pem
BILLING_NOTIFY_BASE_URL=https://wework.syzs.top
```

（或内联 PEM，需 `alipay.service.js` 含 `loadPem`）

### 3. 后端文件（须存在）

- `src/services/alipay.service.js`
- `src/config/env.js`（支持 PATH）
- `src/controllers/billing.controller.js`（去掉「暂未开放」那行 throw，或上传仓库新版）

### 4. 前端重新构建并同步

```bash
# 本机
# frontend/.env.production 改为 VITE_ALIPAY_ENABLED=1
cd frontend && npm run build
# 上传 dist，ECS 执行：
rsync -a --delete /var/www/wework-saas/frontend/dist/ /var/www/wework/
pm2 restart syqw-api --update-env
```

### 5. 验证

```bash
node scripts/test-alipay-pem.mjs   # 私钥 OK
node scripts/verify-alipay.mjs     # 网关验签通过（或 ACCESS_FORBIDDEN 仅差签约）
```

---

## 发版备忘（避免再踩坑）

```text
本机构建 frontend → 上传 dist 到 wework-saas/frontend/dist
ECS: rsync 到 /var/www/wework/
ECS: pm2 restart syqw-api --update-env
浏览器: 无痕 + 看 index-*.js 哈希是否变化
```
