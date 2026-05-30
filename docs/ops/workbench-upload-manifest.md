# Workbench 上传清单（AI 员工 / 私域增长）

> 在 Mac 无法 scp 时，用阿里云 Workbench 上传下列文件到对应路径，然后执行文末命令。

## 快速路径（推荐）

本地一键打包 → Workbench 上传 → 服务器 `./install.sh`：

```bash
# Mac
./scripts/pack-workbench-upload.sh

# ECS Workbench（上传 tar.gz 到 /tmp 后）
cd /tmp && tar xzf wework-workbench-*.tar.gz && cd wework-workbench-* && sudo ./install.sh
```

逐步说明见 [workbench-deploy-runbook.md](./workbench-deploy-runbook.md)。

## 后端 `/var/www/wework-saas/backend`

必传（本次迭代新增或修改）：

```
src/services/leadAssignment.service.js
src/services/leadCapture.service.js
src/services/weworkContactAdd.service.js
src/services/customerTimeline.service.js
src/services/flowTemplates.service.js
src/services/onboardingChecklist.service.js
src/services/dashboard.service.js
src/services/channelLiveCode.service.js
src/services/publicInboxIngest.service.js
src/services/inbox.service.js
src/services/flowEngine.service.js
src/services/marketingEvent.service.js
src/services/customer.service.js
src/services/wework-sync.service.js
src/controllers/leadCapture.controller.js
src/controllers/dashboard.controller.js
src/controllers/flow.controller.js
src/controllers/inbox.controller.js
src/controllers/customer.controller.js
src/controllers/marketingEvent.controller.js
src/controllers/settings.controller.js
src/routes/lead.routes.js
src/routes/index.js
src/routes/dashboard.routes.js
src/routes/flow.routes.js
src/routes/customer.routes.js
src/routes/inbox.routes.js
src/routes/track.routes.js
src/routes/settings.routes.js
src/config/env.js
src/models/customer.model.js
src/models/tenantLeadSetting.model.js
src/models/index.js
```

## 前端静态 `/var/www/wework/`

上传本地 `frontend/dist/` 下全部文件（覆盖），尤其：

```
index.html
assets/*
lead-form.html
zf-track.js
landing.html
```

## 数据库（nano 粘贴执行）

若未执行过：

1. `database/058_customer_discovery_profile.sql`
2. `database/059_tenant_lead_settings.sql`（线索分配配置表）
3. `database/060_ticket_sla.sql`（工单 SLA 字段）
4. `database/061_tenant_public_webhook_settings.sql`（公域 Webhook 验签配置）
5. 此前 AI 员工包：`database/bundle_ai_employee_054_057.sql` 或 `fix_permissions_then_055_057.sql`

## 服务器命令

```bash
cd /var/www/wework-saas/backend
npm ci --omit=dev
pm2 restart wework-api --update-env
curl -s http://127.0.0.1:3010/health
curl -s 'http://127.0.0.1:3010/health?deep=1'
```

## .env 建议项

```env
PORT=3010
AUTO_CREATE_CUSTOMER_ON_WEWORK_ADD=1
ENABLE_FLOW_ENGINE_CRON=1
ENABLE_AUTOMATION_CRON=1
ENABLE_FOLLOWUP_DUE_CRON=1
ENABLE_TICKET_SLA_CRON=1
ENABLE_HEALTH_MONITOR_CRON=1
HEALTH_MONITOR_TENANT_ID=1
HEALTH_MONITOR_TOUSER=你的企微UserID
PUBLIC_INBOX_WEBHOOK_SECRET=随机长串
```

curl -fsS "http://127.0.0.1:${HEALTH_PORT}/health?deep=1" | head -c 400
echo ""

## 一键验收脚本

部署完成后在服务器执行（或本地对远程 API）：

```bash
# 仅健康 + 公域 callback（无需登录）
PHASE=public bash scripts/post-deploy-acceptance.sh

# 完整验收（需管理员）
TENANT_ID=1 USERNAME=admin PASSWORD='你的密码' bash scripts/post-deploy-acceptance.sh

# Workbench 包内
cd /tmp/wework-workbench-* && TENANT_ID=1 USERNAME=admin PASSWORD='***' ./post-deploy-acceptance.sh
```

跳过写入收件箱的 POST 测试：`SKIP_WEBHOOK_INGEST=1`

## 验收（手工抽查）

1. 仪表盘出现「上线检查清单」
2. `https://域名/landing.html?utm_source=test&tenant=1` 显示留资按钮
3. 留资提交后客户管理有新客户，来源含「落地页」
4. 渠道分析 → 「获客漏斗」含新建客户数与最近留资列表（可跳转客户详情）
5. 营销事件报表可看到 `landing_view`、`lead_submit`
6. 系统设置 → 运维工具 →「线索分配」可配置轮询/渠道映射；留资后负责人符合规则且可选企微提醒
7. 服务台工单列表显示 SLA；逾期工单仪表盘 KPI 可跳转；严重逾期自动企微通知管理员
8. 服务台「新建工单/订单」支持搜索选择客户（姓名/手机/公司/ID），从客户详情带 `customer_id` 进入时自动预填
9. 系统设置 → 运维工具 →「公域 Webhook 验签」配置抖音 client_secret / 小红书 token；官方签名或 Legacy Token 均可入站
