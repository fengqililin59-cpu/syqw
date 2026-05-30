# Workbench 生产部署操作手册（逐步版）

> 适用：Mac 无法 `scp` / `rsync`，通过阿里云 **Workbench** 浏览器上传。  
> 生产路径：后端 `/var/www/wework-saas/backend`，前端 `/var/www/wework/`，PM2 `wework-api`，端口 **3010**。

---

## 一、本地准备（Mac）

### 方式 A：一键打包（推荐）

```bash
cd /Users/591464076qq.com/syqw
chmod +x scripts/pack-workbench-upload.sh scripts/server-unpack-workbench.sh
./scripts/pack-workbench-upload.sh
```

产物：`dist-workbench/wework-workbench-YYYYMMDD-HHMMSS.tar.gz`

已跳过构建时：

```bash
SKIP_BUILD=1 ./scripts/pack-workbench-upload.sh
```

### 方式 B：手动上传

见 [workbench-upload-manifest.md](./workbench-upload-manifest.md) 文件清单。

---

## 二、Workbench 上传

1. 登录阿里云 ECS → **Workbench** 远程连接
2. 打开 **文件** 面板，进入 `/tmp`
3. 上传 `wework-workbench-*.tar.gz`
4. 在终端执行：

```bash
cd /tmp
tar xzf wework-workbench-*.tar.gz
cd wework-workbench-*/
ls -la
# 应看到 backend/ frontend/ database/ install.sh
```

---

## 三、备份（强烈建议）

```bash
sudo cp /var/www/wework-saas/backend/.env \
  /var/www/wework-saas/backend/.env.bak-$(date +%Y%m%d-%H%M%S)

sudo tar czf /tmp/wework-frontend-bak-$(date +%Y%m%d).tar.gz -C /var/www wework
```

---

## 四、安装新版本

```bash
cd /tmp/wework-workbench-*/
sudo ./install.sh
```

脚本会：

- `rsync` 覆盖后端 `src/`
- `rsync --delete` 覆盖前端静态
- `npm ci --omit=dev`
- `pm2 restart wework-api --update-env`
- 本机 `curl` 健康检查（3010）

---

## 五、数据库迁移（若未执行过）

检查 `customers` 表是否已有 `discovery_profile` 列：

```bash
mysql -u root -p wework_saas -e "SHOW COLUMNS FROM customers LIKE 'discovery_profile';"
```

无结果则执行（nano 粘贴 SQL 或 `mysql <`）：

```bash
mysql -u root -p wework_saas < /tmp/wework-workbench-*/database/058_customer_discovery_profile.sql
```

---

## 六、.env 确认

```bash
grep -E '^(PORT|AUTO_CREATE|ENABLE_FLOW|ENABLE_AUTOMATION|PUBLIC_INBOX)' \
  /var/www/wework-saas/backend/.env
```

建议至少：

```env
PORT=3010
AUTO_CREATE_CUSTOMER_ON_WEWORK_ADD=1
ENABLE_FLOW_ENGINE_CRON=1
ENABLE_AUTOMATION_CRON=1
ENABLE_HEALTH_MONITOR_CRON=1
HEALTH_MONITOR_TENANT_ID=1
HEALTH_MONITOR_TOUSER=你的企微UserID
```

健康巡检：每 2 分钟探测 `/health?deep=1`；连续失败 2 次向上述 UserID 发企微告警，恢复后通知。可在「设置 → 运维工具 → API 健康巡检」查看。

修改后：

```bash
pm2 restart wework-api --update-env
```

---

## 七、验收（5 分钟）

### 7.0 一键脚本（推荐）

```bash
# 服务器 / 本地均可；默认 http://127.0.0.1:3010
PHASE=public bash scripts/post-deploy-acceptance.sh

TENANT_ID=1 USERNAME=admin PASSWORD='***' bash scripts/post-deploy-acceptance.sh
```

Workbench 包解压目录内自带 `post-deploy-acceptance.sh`。跳过写入收件箱：`SKIP_WEBHOOK_INGEST=1`。

### 7.1 服务

```bash
curl -s http://127.0.0.1:3010/health
curl -s 'http://127.0.0.1:3010/health?deep=1'
pm2 logs wework-api --lines 30 --nostream
```

### 7.2 管理端

| 步骤 | 预期 |
|------|------|
| 登录 → 仪表盘 | 出现「上线检查清单」 |
| 自动化流程 | 可点「一键起步包」 |
| 渠道分析 | 有「获客漏斗」、新建客户、最近留资 |

### 7.3 公网 H5

1. 打开 `https://你的域名/landing.html?tenant=1&utm_source=deploy_test`
2. 点击留资 → 提交表单
3. 客户管理出现新客户，来源含「落地页」
4. 渠道分析 → `deploy_test` 渠道有 `landing_view` / `lead_submit` / 新建客户

### 7.4 企微加好友（可选）

活码加好友后约 1 分钟内客户管理有新客；约 5 分钟后欢迎流程产生跟进提醒（需 `ENABLE_FLOW_ENGINE_CRON=1`）。

---

## 八、回滚

```bash
# 前端
sudo tar xzf /tmp/wework-frontend-bak-YYYYMMDD.tar.gz -C /var/www

# 后端：从 .env.bak 恢复配置后，重新上传上一版 backend src 或 git checkout 旧提交再打包
pm2 restart wework-api --update-env
```

详细见 [checklists/rollback-quick.md](./checklists/rollback-quick.md)。

---

## 九、常见问题

| 现象 | 处理 |
|------|------|
| `health` 连不上 | `pm2 list` 看进程；`grep PORT .env` 是否为 3010 |
| 留资 404 | Nginx `root` 是否指向 `/var/www/wework`；是否有 `lead-form.html` |
| 漏斗无数据 | 确认 `zf-track.js` 已部署；URL 带 `utm_source` |
| 加好友未入库 | `.env` 中 `AUTO_CREATE_CUSTOMER_ON_WEWORK_ADD=1` |
| 欢迎流程不触发 | `ENABLE_FLOW_ENGINE_CRON=1` 且流程已启用 |
