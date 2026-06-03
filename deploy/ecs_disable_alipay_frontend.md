# 生产关闭支付宝（后端 + 前端）

## 为何 `.env` 关了浏览器还有「支付宝」按钮？

| 层 | 状态 |
|----|------|
| 后端 `isAlipayConfigured` | 已为 `false`（你已验证） |
| **Nginx 静态前端 `frontend/dist`** | 仍是**旧构建**，旧 JS 仍渲染支付宝按钮 |
| 点击后 | 若 PM2 进程里还缓存旧 `ALIPAY_APP_ID`，或旧代码未拦截 → 仍可能 `DECODER` |

**只改 `.env` 不够，必须重新构建并上传前端。**

---

## 一、ECS 后端（Workbench）

```bash
cd /var/www/wework-saas/backend
grep -E '^ALIPAY_(DISABLED|APP_ID)=' .env

# 应为 DISABLED=1、APP_ID 为空
pm2 delete syqw-api
pm2 start /var/www/wework-saas/backend/src/app.js \
  --name syqw-api -i 2 \
  --cwd /var/www/wework-saas/backend \
  --update-env
pm2 save

# 确认进程环境里没有旧 AppID
pm2 env $(pm2 jlist | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(j.find(x=>x.name==='syqw-api')?.pm_id)") 2>/dev/null | grep ALIPAY || true
```

上传本仓库最新（至少）：

- `backend/src/controllers/billing.controller.js`（`alipay` 下单前硬拦截）

---

## 二、本机构建前端（Mac）

```bash
cd /Users/591464076qq.com/syqw/frontend
npm ci
npm run build
```

确认 `frontend/.env.production` 含：`VITE_ALIPAY_ENABLED=0`

---

## 三、上传 dist 到 ECS

目标目录（与 Nginx 一致）：

`/var/www/wework-saas/frontend/dist/`

Workbench 上传整个 `frontend/dist` 覆盖，或打包：

```bash
cd frontend && tar czf dist.tgz dist
# 上传 dist.tgz 到 ECS 后：
# cd /var/www/wework-saas/frontend && tar xzf dist.tgz --strip-components=0
```

---

## 四、浏览器验证

1. 清 Local Storage（`wework-saas-auth`）
2. 无痕打开 `https://wework.syzs.top/app/billing`
3. 企业版下应**只有**「微信支付 / 线下转账」，**无「支付宝」**

---

## 五、恢复支付宝时

1. `.env`：`ALIPAY_DISABLED=0`，`ALIPAY_APP_ID=...`，密钥配好
2. `frontend/.env.production`：`VITE_ALIPAY_ENABLED=1`
3. `npm run build` 并上传 dist
4. `pm2 restart syqw-api --update-env`
