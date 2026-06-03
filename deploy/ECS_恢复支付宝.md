# ECS 恢复支付宝（wework.syzs.top）

## 根因说明

| 现象 | 原因 |
|------|------|
| `error:1E08010C:DECODER routines::unsupported` | `.env` 内联 PEM 被截断/换行损坏，或 PKCS#1/PKCS#8 格式未正确包装 |
| `isAlipayConfigured false` | `ALIPAY_DISABLED=1`、清空了 `ALIPAY_APP_ID`，或密钥未加载 |
| 点了支付宝仍 DECODER | ECS 上曾 **python 硬拦截未生效** 的旧逻辑仍在跑 `createAlipayPayment`，且密钥仍坏 |
| 前端删不掉支付宝按钮 | Nginx **`root /var/www/wework`**，只改 `wework-saas/frontend/dist` 无效；须 `rsync` 到 `/var/www/wework/` |
| 计费页多个 500 | `balance`/`addon` 曾用 `req.tenantId` 变 `NaN`；另 `intent_alerts` 表缺失（日志里可见） |

## 恢复步骤（Workbench 复制执行）

### 1. 上传本机文件到 ECS

- `deploy/ecs_enable_alipay.sh` → `/var/www/wework-saas/deploy/`
- `deploy/ecs_diagnose_wework_site.sh` → 同上
- `deploy/frontend-dist-alipay-on.tar.gz` → `/var/www/wework-saas/frontend/`
- 若 ECS 缺新代码，再上传：
  - `backend/src/config/env.js`
  - `backend/src/services/alipay.service.js`
  - `backend/src/controllers/billing.controller.js`（仓库版，含 `loadPem` + `isAlipayConfigured`）

### 2. 后端

```bash
chmod +x /var/www/wework-saas/deploy/ecs_enable_alipay.sh
bash /var/www/wework-saas/deploy/ecs_enable_alipay.sh
```

脚本会：用 **PEM 文件路径**、删内联密钥、去掉临时 `throw`、重启 `syqw-api` 并打印 `isAlipayConfigured`。

可选验签：

```bash
cd /var/www/wework-saas/backend
node scripts/test-alipay-pem.mjs
node scripts/verify-alipay.mjs   # 若有
```

若报 **ACCESS_FORBIDDEN**：登录 [支付宝开放平台](https://open.alipay.com) → 应用 `2021000106623328` → 签约 **电脑网站支付**。

### 3. 前端（必须同步到 Nginx root）

```bash
cd /var/www/wework-saas/frontend
tar xzf frontend-dist-alipay-on.tar.gz -C dist
find dist -name '._*' -delete
rsync -a --delete dist/ /var/www/wework/
grep -o 'index-[^"]*\.js' /var/www/wework/index.html
# 应为 index-C6E6MFYY.js（与 no-alipay 包的 CleyPqw2 不同）
```

浏览器 **硬刷新** 或无痕打开 `https://wework.syzs.top/app/billing`。

### 4. 诊断

```bash
bash /var/www/wework-saas/deploy/ecs_diagnose_wework_site.sh
```

## 计费 500 仍出现时

1. 用真实账号登录（勿用占位 `TOKEN='登录返回的token'`）。
2. 确认 controller 已是 `req.auth.tenantId`（勿再 `Number(req.tenantId)`）。
3. 可选补表：`database/039_intent_alert.sql`（消除 `intent_alerts` 报错）。

## 若仍要关闭支付宝

- `.env`：`ALIPAY_DISABLED=1`，清空 `ALIPAY_APP_ID`
- 前端：`VITE_ALIPAY_ENABLED=0` 后 `npm run build`，用 `frontend-dist-no-alipay.tar.gz` 同步到 `/var/www/wework/`
