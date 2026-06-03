# ZhiFlow 生产上线 Runbook — wework.syzs.top

> **域名**：https://wework.syzs.top/  
> **用途**：ECS 上可复制粘贴的执行清单（不含密码/密钥）。  
> **关联**：[launch-go-no-go.md](./launch-go-no-go.md) · [go-live-ai-inbox.md](./go-live-ai-inbox.md) · [production-checklist.md](./production-checklist.md)

---

## 生产环境固定信息（勿混用其他服务）

| 项 | 值 |
|----|-----|
| Nginx HTTPS 配置 | `/etc/nginx/conf.d/wework-https.conf` |
| 前端静态 | `/var/www/zhiflow/frontend/dist` |
| 后端目录 | `/var/www/zhiflow/backend` |
| PM2 进程名 | `zhiflow-api` |
| API 监听端口 | **3002**（`proxy_pass` 必须指向此端口） |
| 数据库 | `zhiflow_prod`，用户 **`zhiflow`**（勿用 root 跑迁移） |
| **禁止占用** | 3000（ai-router）、3010（wework-saas） |
| 首发阶段 A | `INBOX_AI_AUTO_SEND=0`，草稿 + 人审 |

**已知已在生产执行过的迁移**（本次可跳过，除非换库重建）：`012`、`054`、`072`～`076`；`018` 若报 Duplicate column 可忽略。

---

## A. 生产 zhiflow_prod 迁移执行顺序

### A.1 执行前检查（zhiflow 用户）

```bash
# 登录 ECS 后
mysql -h127.0.0.1 -uzhiflow -p zhiflow_prod
```

```sql
-- 库是否就绪
SHOW TABLES LIKE 'tenants';
SHOW TABLES LIKE 'schema_migrations';

-- 收件箱 AI 列（072-076 已跑时应有结果）
SHOW COLUMNS FROM tenants LIKE 'inbox_ai%';
SHOW COLUMNS FROM ai_reply_logs LIKE 'qa_%';

-- 群发企微字段（018 已跑或重复报错可接受）
SHOW COLUMNS FROM broadcast_tasks LIKE 'wecom%';
```

**备份建议**（运维窗口执行，密码自行替换）：

```bash
mysqldump -h127.0.0.1 -uzhiflow -p \
  --single-transaction --routines --triggers \
  zhiflow_prod > "/tmp/zhiflow_prod_$(date +%Y%m%d-%H%M).sql"
```

### A.2 不要执行的文件

以下仅用于本地修复，**生产勿跑**：

- `database/local_*.sql`
- `database/docker-init.sql`
- `database/bundle_ai_employee_054_057.sql`
- `database/fix_permissions_then_055_057.sql`

### A.3 全量编号顺序（`database/*.sql` 按文件名排序）

在**全新空库**上可按此顺序一次性执行；**已有库**请结合 `schema_migrations` 与 A.4「本次重点」增量补跑。

| # | 文件 | 说明 / 备注 |
|---|------|-------------|
| 1 | `001_phase1_mvp.sql` | 核心表 |
| 2 | `004_wework.sql` | 企微基础 |
| 3 | `005_wework_callback_fields.sql` | 回调字段 |
| 4 | `006_customers_soft_delete.sql` | 客户软删 |
| 5 | `007_customer_stage_varchar.sql` | 阶段字段 |
| 6 | `008_wework_channel_live_code.sql` | 渠道活码 |
| 7 | `008_customers_deleted_at_idempotent.sql` | 幂等补 `deleted_at` |
| 8 | `009_ad_click_tracking.sql` | 广告点击 |
| 9 | `010_phase3_campaigns.sql` | 活动 |
| 10 | `011_wework_customer_messages.sql` | 企微消息 |
| 11 | `012_private_domain_pr_scaffold.sql` | 群发任务表 ✅ **生产已跑** |
| 12 | `013_auto_send_message.sql` | 自动发消息 |
| 13 | `013_ai_generation_logs.sql` | AI 生成日志 |
| 14 | `014_automation_logs_and_customer_flags.sql` | 自动化日志 |
| 15 | `015_customer_intent_scoring.sql` | 意向分 |
| 16 | `016_intent_linked_followup.sql` | 意向跟进 |
| 17 | `017_flow_engine.sql` | 流程引擎 |
| 18 | `018_broadcast_add_wecom_fields.sql` | 群发企微字段 ✅ **Duplicate column 可忽略** |
| 19 | `019_ensure_customers_deleted_at.sql` | 幂等 deleted_at |
| 20 | `020_customers_align_sequelize_model.sql` | 客户表对齐 |
| 21 | `021_users_wework_corp_id.sql` | 用户 corp |
| 22 | `022_tenants_missing_wework_columns.sql` | 租户企微列 |
| 23 | `023_ensure_campaigns_tables.sql` | 活动表 |
| 24 | `024_registration_otp_challenges.sql` | 注册 OTP（推广前必跑） |
| 25 | `025_page_visits_tracking.sql` | 页面访问 |
| 26 | `026_ad_conversion_events.sql` | 转化事件 |
| 27 | `027_marketing_events.sql` | 营销事件 |
| 28 | `028_ad_spend_daily.sql` | 广告消耗 |
| 29 | `029_background_jobs.sql` | 后台任务 |
| 30 | `030_agg_ads_roi_daily.sql` | ROI 日聚合 |
| 31 | `031_agg_channel_daily.sql` | 渠道日聚合 |
| 32 | `032_aggregation_meta.sql` | 聚合元数据 |
| 33 | `033_campaign_reward_jobs.sql` | 活动奖励 |
| 34 | `034_wework_tokens.sql` | 企微 token |
| 35 | `035_audit_logs.sql` | 审计日志 |
| 36 | `036_rbac_permissions.sql` | 权限 |
| 37 | `037_rbac_seed_roles.sql` | 角色种子 |
| 38 | `038_wework_tokens.sql` | token 补充（与 034 部分重叠，已存在则跳过） |
| 39 | `039_intent_alert.sql` | 意向预警 |
| 40 | `040_migration_campaigns.sql` | 活动迁移 |
| 41 | `041_customer_transfer.sql` | 客户转移 |
| 42 | `042_import_jobs.sql` | 导入任务 |
| 43 | `043_billing.sql` | 计费基础 |
| 44 | `044_subscription_notify_fields.sql` | 订阅通知 |
| 45 | `045_wework_jsapi_ticket.sql` | JSAPI |
| 46 | `046_customer_groups.sql` | 客户群 |
| 47 | `047_call_records.sql` | 通话记录 |
| 48 | `048_call_permission.sql` | 通话权限 |
| 49 | `049_sms.sql` | 短信 |
| 50 | `050_sms_permission.sql` | 短信权限 |
| 51 | `051_demo_mode.sql` | 演示模式 |
| 52 | `052_demo_seed.sql` | 演示数据 |
| 53 | `053_script_library_items.sql` | 话术库 |
| 54 | `054_ai_employee_inbox.sql` | AI 员工收件箱 ✅ **生产已跑** |
| 55 | `055_inbox_permissions.sql` | 收件箱权限 |
| 56 | `056_service_tickets_orders.sql` | 工单/订单（缺 inbox 表时先补 inbox 系列） |
| 57 | `057_ticket_permissions.sql` | 工单权限 |
| 58 | `058_customer_discovery_profile.sql` | 客户发现画像 |
| 59 | `059_tenant_lead_settings.sql` | 线索分配 |
| 60 | `060_ticket_sla.sql` | 工单 SLA |
| 61 | `061_tenant_public_webhook_settings.sql` | 公域 Webhook 验签 |
| 62 | `062_billing_promo_codes.sql` | 兑换码 |
| 63 | `063_user_syzs_links.sql` | 主站联通（可选） |
| 64 | `064_ai_assistant_plans.sql` | AI 助手套餐 |
| 65 | `065_payment_wechat_columns.sql` | 微信支付列 |
| 66 | `066_tenant_churn_alerts.sql` | 流失预警 |
| 67 | `067_tenant_platform_ops_notes.sql` | 平台运营备注 |
| 68 | `068_billing_invoice_requests.sql` | 开票申请 |
| 69 | `069_billing_contract_attachments.sql` | 合同附件 |
| 70 | `070_user_wechat_mp_openid.sql` | 公众号 openid |
| 71 | `071_platform_mrr_snapshots.sql` | MRR 快照 |
| 72 | `072_tenant_inbox_ai_auto_send.sql` | FAQ 自动发开关 ✅ **生产已跑** |
| 73 | `073_tenant_inbox_ai_auto_send_pricing.sql` | 询价自动发 ✅ **生产已跑** |
| 74 | `074_tenant_inbox_ai_notify_assignee.sql` | 自动发提醒 ✅ **生产已跑** |
| 75 | `075_tenant_inbox_ai_platform_disabled.sql` | 平台关停 ✅ **生产已跑** |
| 76 | `076_ai_reply_logs_qa.sql` | 抽检字段 ✅ **生产已跑** |
| 77 | `077_custom_fields.sql` | 自定义字段 |
| 78 | `078_pipeline_config.sql` | 管道配置 |
| 79 | `079_dashboard_config.sql` | 仪表盘配置 |
| 80 | `080_tenant_inbox_auto_draft.sql` | 租户自动草稿 |
| 81 | `081_fix_ai_reply_logs.sql` | AI 回复日志修复 |
| 82 | `082_add_kpi_targets.sql` | KPI 目标 |
| 83 | `083_add_contracts.sql` | 合同 |
| 84 | `084_add_tasks.sql` | 任务 |
| 85 | `085_add_marketing_campaigns.sql` | 营销活动 |
| 86 | `086_add_customer_segments.sql` | 客户分群 |
| 87 | `087_add_knowledge_base.sql` | 知识库 |
| 88 | `088_add_notification_rules.sql` | 通知规则 |
| 89 | `089_add_coach_suggestions.sql` | 辅导建议 |
| 90 | `090_admin_inbox_ai_permissions.sql` | 超管收件箱/AI 审核权限 |

### A.4 本次上线「重点增量」（相对已知已跑版本）

若代码已包含 077+ 功能，在 ECS 上**至少**确认以下未执行项（按编号补跑）。

**快捷（无 FK、幂等，推荐 Workbench 单文件）**：若缺营销/知识库/自定义字段/仪表盘/`user_agent` 等，可先执行：

```bash
mysql -h127.0.0.1 -uzhiflow -p zhiflow_prod < /var/www/zhiflow/database/zhiflow_prod_phase10_12_no_fk.sql
cd /var/www/zhiflow/backend && pm2 restart zhiflow-api --update-env
```

再按需补跑下方逐号文件或完整 `db-migrate.sh`。

```bash
cd /var/www/zhiflow   # 或你上传代码的目录
export MYSQL_PWD=''    # 建议用 ~/.my.cnf 或交互 -p，勿把密码写进脚本历史

for f in \
  055_inbox_permissions.sql \
  056_service_tickets_orders.sql \
  057_ticket_permissions.sql \
  058_customer_discovery_profile.sql \
  059_tenant_lead_settings.sql \
  060_ticket_sla.sql \
  061_tenant_public_webhook_settings.sql \
  062_billing_promo_codes.sql \
  064_ai_assistant_plans.sql \
  065_payment_wechat_columns.sql \
  066_tenant_churn_alerts.sql \
  067_tenant_platform_ops_notes.sql \
  077_custom_fields.sql \
  078_pipeline_config.sql \
  079_dashboard_config.sql \
  080_tenant_inbox_auto_draft.sql \
  081_fix_ai_reply_logs.sql \
  082_add_kpi_targets.sql \
  083_add_contracts.sql \
  084_add_tasks.sql \
  085_add_marketing_campaigns.sql \
  086_add_customer_segments.sql \
  087_add_knowledge_base.sql \
  088_add_notification_rules.sql \
  089_add_coach_suggestions.sql \
  090_admin_inbox_ai_permissions.sql
do
  path="database/$f"
  [[ -f "$path" ]] || continue
  echo ">>> $f"
  mysql -h127.0.0.1 -uzhiflow -p zhiflow_prod < "$path" || echo "（若 Duplicate column / already exists，记录后继续）"
done
```

**幂等迁移脚本（推荐，需 `backend/.env` 中 `DB_PASSWORD` 与库一致）**：

```bash
cd /var/www/zhiflow
# 确认 .env: DB_NAME=zhiflow_prod DB_USER=zhiflow DB_PASSWORD=***
bash deploy/scripts/db-migrate.sh
```

> `db-migrate.sh` 会维护 `schema_migrations` 表并跳过已执行文件；单文件失败时需人工看报错（Duplicate column 类可对照 A.3 备注）。

### A.5 执行后验证 SQL

```sql
SELECT filename, executed_at FROM schema_migrations ORDER BY id DESC LIMIT 15;

SHOW COLUMNS FROM tenants LIKE 'inbox_ai%';
SHOW COLUMNS FROM ai_reply_logs LIKE 'qa_%';

SELECT COUNT(*) AS perm_cnt FROM permissions;
SELECT code, name FROM plans LIMIT 5;
```

---

## B. 30 分钟验收勾选表（wework.syzs.top）

发布负责人打印本表，逐项打勾。

### B.0 发布前 env（阶段 A，在 `backend/.env`）

- [ ] `NODE_ENV=production`，`PORT=3002`，`APP_URL=https://wework.syzs.top`
- [ ] `INBOX_AUTO_DRAFT=1`，`INBOX_AUTO_DRAFT_DELAY_SEC=30`
- [ ] **`INBOX_AI_AUTO_SEND=0`**（全平台禁止自动外发）
- [ ] `JWT_SECRET` 非默认值（≥32 位）
- [ ] 企微五项已填且与后台一致
- [ ] 未开启 `WECHAT_PAY_MOCK` / `ALIPAY_MOCK` 等 Mock

```bash
cd /var/www/zhiflow/backend
grep -E '^(INBOX_AI_AUTO_SEND|INBOX_AUTO_DRAFT|PORT|APP_URL)=' .env
pm2 restart zhiflow-api --update-env
```

### B.1 基础设施（0～5 分钟）

| # | 检查项 | 命令 / 操作 | 预期 |
|---|--------|-------------|------|
| 1 | Nginx 语法 | `sudo nginx -t` | syntax ok |
| 2 | Nginx 指向 **3002** | `grep proxy_pass /etc/nginx/conf.d/wework-https.conf` | `127.0.0.1:3002`，**非** 3000/3010 |
| 3 | 静态根目录 | 同上 `root` | `/var/www/zhiflow/frontend/dist` |
| 4 | PM2 状态 | `pm2 status zhiflow-api` | online |
| 5 | 本机健康 | `curl -sS http://127.0.0.1:3002/health` | `ok: true` |
| 6 | 深度健康 | `curl -sS 'http://127.0.0.1:3002/health?deep=1'` | 含 `"database":true` |
| 7 | 公网健康 | `curl -sS https://wework.syzs.top/health` | 200 |
| 8 | 公网深度 | `curl -sS 'https://wework.syzs.top/health?deep=1'` | database true |
| 9 | 冒烟脚本 | `cd /var/www/zhiflow && ./scripts/smoke-test.sh https://wework.syzs.top` | 通过 |

```bash
# 一键本机检查（ECS）
curl -fsS http://127.0.0.1:3002/health && echo
curl -fsS 'http://127.0.0.1:3002/health?deep=1' | head -c 400 && echo
pm2 logs zhiflow-api --lines 30 --nostream
```

### B.2 浏览器手工（5～20 分钟）

| # | 页面 / 功能 | URL / 操作 | 预期 |
|---|-------------|------------|------|
| 10 | 登录 | https://wework.syzs.top/app | 可登录 |
| 11 | 仪表盘 | `/app` 首页 | 卡片/统计加载无 5xx |
| 12 | 客户列表 | `/app/customers` | 列表与搜索正常 |
| 13 | 收件箱 | `/app/inbox` | 会话列表可开；公域有「勿自动外发」类提示 |
| 14 | AI 助手 | `/app/ai-assistant` | 可对话（需 `DEEPSEEK_API_KEY`） |
| 15 | 话术库 | `/app/script-library` | 列表可读 |
| 16 | 落地页 | `/landing.html` | 200 |
| 17 | 条款链接 | 登录页 footer | `terms.html` / `privacy.html` 可开 |

### B.3 收件箱 AI 阶段 A（10～25 分钟）

| # | 检查项 | 预期 |
|---|--------|------|
| 18 | 企微客户发 FAQ 类消息，等 ~30s | 出现 **AI 草稿**，**不**自动发给客户 |
| 19 | 租户设置里 FAQ/询价自动发 | 开关存在但平台 env=0 时无法真正自动外发 |
| 20 | 公域（抖音/小红书）会话 | 仅草稿；guard 不自动外发 |
| 21 | 平台超管 → 租户详情 | 近 7 日 AI 指标 / 审计表可访问（有 `PLATFORM_ADMIN_USER_IDS` 时） |
| 22 | AI 审核台抽检 | 可打开队列（约 10% 抽检配置时） |

**验证 `INBOX_AI_AUTO_SEND=0`（任选一种）**：

```bash
# 进程环境（PM2 需带 --update-env 重启后）
pm2 env zhiflow-api | grep INBOX_AI_AUTO_SEND

# 或读 .env
grep INBOX_AI_AUTO_SEND /var/www/zhiflow/backend/.env
# 应看到 =0 或该行被注释且业务确认为禁用
```

### B.4 角色权限（若有多角色账号，15～25 分钟）

| 角色 | 建议验证 |
|------|----------|
| 系统管理员 | 仪表盘、客户、收件箱、设置、话术库 |
| 销售 | 客户、收件箱、无平台菜单 |
| 平台超管 | `/app/platform` 运营概览、AI 异常导出（若已配置 ID） |

### B.5 前端包新鲜度（5 分钟）

```bash
# 构建时间应接近本次发布时间
ls -la /var/www/zhiflow/frontend/dist/index.html
ls -la /var/www/zhiflow/frontend/dist/assets/*.js 2>/dev/null | tail -3

# 浏览器强刷或无痕打开，避免旧 index.html 缓存
# DevTools → Network：主 JS 文件名/hash 与服务器 assets 一致
```

### B.6 观察期（20～30 分钟）

- [ ] `pm2 monit` / `pm2 status` 无频繁 restart
- [ ] `tail -f /var/log/nginx/*error*` 无持续 502 upstream
- [ ] 核心 API 无 5xx 尖峰

### B.7 回滚一行命令（出问题时）

```bash
# 恢复上一版前端 + 重启 API（事先保留 dist 与 backend/src 备份目录）
sudo rsync -a --delete /var/www/zhiflow/frontend/dist.bak/ /var/www/zhiflow/frontend/dist/ && \
cd /var/www/zhiflow/backend && pm2 restart zhiflow-api --update-env && \
curl -fsS 'http://127.0.0.1:3002/health?deep=1'
```

数据库误迁移：**不要**在生产随意 DROP；用发布前 `mysqldump` 回档或 DBA 按表恢复。

---

## C. 用户 Mac 侧打包上传步骤

### C.1 推荐：Workbench 上传包

在 **Mac 仓库根目录**执行：

```bash
cd /path/to/syqw
./scripts/pack-workbench-upload.sh
```

产出：`dist-workbench/wework-workbench-YYYYMMDD-HHMMSS.tar.gz`

**ECS 解压安装（ZhiFlow 路径，覆盖默认 wework-saas 变量）**：

```bash
cd /tmp
tar xzf wework-workbench-*.tar.gz
cd wework-workbench-*

export BACKEND_DIR=/var/www/zhiflow/backend
export FRONTEND_DIR=/var/www/zhiflow/frontend/dist
export PM2_APP=zhiflow-api
export HEALTH_PORT=3002

sudo -E ./install.sh
```

`install.sh` 会：同步 `backend/src`、`frontend/dist`、`npm ci --omit=dev`、重启 PM2。  
包内若含 `database/058-061.sql`，**迁移仍须按 A 节用 zhiflow 用户手动确认**。

仅重打前端、跳过构建：

```bash
SKIP_BUILD=1 ./scripts/pack-workbench-upload.sh
```

### C.2 备选：rsync（Mac 能 SSH 时）

```bash
# 前端（先本地 build）
cd frontend && npm run build
rsync -avz --delete dist/ user@ECS:/var/www/zhiflow/frontend/dist/

# 后端源码
rsync -avz --exclude node_modules --exclude '*.test.js' \
  backend/src/ user@ECS:/var/www/zhiflow/backend/src/
rsync -avz backend/package.json backend/package-lock.json \
  user@ECS:/var/www/zhiflow/backend/

# ECS 上
ssh user@ECS 'cd /var/www/zhiflow/backend && npm ci --omit=dev && pm2 restart zhiflow-api --update-env'
```

### C.3 Mac 发布前自检（可选）

```bash
./scripts/deploy-check.sh
./scripts/smoke-test.sh https://wework.syzs.top   # 需 ECS 已更新且 Nginx 已指向 3002
```

### C.4 ECS 自动化验收（可选）

```bash
cd /tmp/wework-workbench-*
BASE_URL=http://127.0.0.1:3002 API_URL=http://127.0.0.1:3002/api/v1 \
PHASE=public ./post-deploy-acceptance.sh

# 带管理员账号
TENANT_ID=1 USERNAME=你的管理员 PASSWORD='***' \
BASE_URL=http://127.0.0.1:3002 ./post-deploy-acceptance.sh
```

---

## 快速命令索引

```bash
# 迁移（幂等）
cd /var/www/zhiflow && bash deploy/scripts/db-migrate.sh

# 重启
cd /var/www/zhiflow/backend && pm2 restart zhiflow-api --update-env

# 健康
curl -fsS http://127.0.0.1:3002/health
curl -fsS 'http://127.0.0.1:3002/health?deep=1'

# Nginx
sudo nginx -t && sudo nginx -s reload
```

---

## 常见错误（Mac 与 ECS 混用）

在 Mac 上执行 `cd /var/www/zhiflow`、`db-migrate.sh`、`pm2 restart zhiflow-api` 会失败——这些路径与进程**只存在于 ECS**。  
ECS 上若只有历史部署的 `backend/` + `frontend/dist/`，会出现 `deploy/scripts/db-migrate.sh`、`database/077_*.sql`、`./install.sh` 找不到；`install.sh` 仅在 Workbench 解压目录 `/tmp/wework-workbench-*` 内。

公网 `https://wework.syzs.top/health?deep=1` 返回 **502**：先在 ECS 确认 `pm2` 中 `zhiflow-api` 为 online，且 Nginx `proxy_pass` 为 `127.0.0.1:3002`（非 3010/3000）。

**命令对照表、Mac/ECS 复制粘贴块、502 排查**：见 [ecs-workbench-quickstart-zh.md](./ecs-workbench-quickstart-zh.md)。

---

## 签字（可选）

| 角色 | 姓名 | 日期 | Go / No-Go |
|------|------|------|------------|
| 技术 | | | |
| 产品/运营 | | | |

完整对外推广门禁另见 [launch-go-no-go.md](./launch-go-no-go.md)。
