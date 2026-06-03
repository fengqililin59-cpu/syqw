# 项目记忆

## 核心方向
**全行业通用SaaS CRM**，核心竞争力在「可配置性」而非「垂直行业深度」

## 技术栈
- 后端: Node.js + Sequelize + MySQL 8.0
- 前端: React + TypeScript + Vite
- 集成: 企业微信、TCCC外呼、AI(DeepSeek/通义)

## 关键决策
- 2026-05-31: 纠正方向——从「助贷专用」转为「全行业通用」。SaaS竞争力在可配置性
- 2026-05-31: 已完成自定义字段系统全栈（EAV模型 + 4个行业模板）
- 定位差异化：「所有行业都能用，而非某个行业专用」

## 文件结构
- 数据库迁移: database/ (001-077，077为自定义字段系统)
- 后端: backend/src/ (controllers/services/models)
- 前端: frontend/src/ (50+ 页面)
- 文档: docs/upgrade_plan.md (升级方案)

## 已完成模块（2026-05-31）
- 自定义字段系统（tenant_custom_field_defs + tenant_customer_field_values）
- 行业模板：教培/医美/B2B/助贷 4个预置模板
- 前端配置页面（/app/custom-fields）
- 客户字段值读写 API（GET/PUT /customers/:id/custom-fields）
- 可配置销售管道（tenant_pipeline_configs，JSON stages）
- 5个行业管道模板：房产/教培/医美/B2B/助贷
- 前端管道配置页（/app/pipeline-settings）
- 销售看板已改造为动态加载管道阶段
- AI跟进话术生成器（POST /customers/:id/followup-scripts，复用aiContent.generateSidebarScripts）
- 前端客户详情页集成AI话术按钮（3条风格：关怀型/价值型/促成型）
- AI客户画像摘要（GET /customers/:id/summary，基于客户画像+跟进历史生成一句话摘要）
- AI智能跟进提醒（GET /dashboard/smart-alerts，三类告警：高意向沉默/管道滞留/紧急待跟 + AI总建议）
- 可配置仪表盘（tenant_dashboard_configs，19个可配置Widget + 5个行业模板）
- 批量导入增强（自定义字段自动映射、模板含自定义字段列）
- 批量导出增强（字段选择对话框、CSV/Excel双格式、含自定义字段值）
- 批量操作（checkbox多选 + 批量标签/转移/变阶段/删除，200条上限）
- 增强导入模板（GET /customers/import/template，后端生成含自定义字段的模板）
- 报表分析模块（/analytics：漏斗分析/团队业绩/客户分析，4个Tab，recharts可视化，时间筛选，同比对比）
- 消息通知中心（notifications表，10种通知类型，Bell图标+未读角标+下拉面板，通知中心全页含筛选分页，30s轮询）
- 审批工作流系统（approval_templates + approval_instances，多步骤审批，指定审批人/角色/无限制三种模式，3视图Tab页，模板CRUD管理页，13个API端点）
- 产品与服务目录（products表，网格/列表双视图，搜索+分类筛选，CRUD弹窗，6个API端点，metadata JSON支持行业自定义属性）
- 成交订单管理（customer_orders表，pending/paid/completed/refunded/cancelled 五态，成交自动推进客户stage→deal + flow_engine联动，列表+详情+创建+更新+删除 API，前端 OrdersPage 611行含筛选/搜索/新建编辑弹窗/金额格式化，侧边栏「成交订单」菜单）
- 转介绍管理（复用裂变活动 campaign/routes.js + campaign/stats API，ReferralManagementPage 203行汇总所有活动转介绍进度，4张汇总卡+按活动明细卡片，侧边栏「转介绍管理」菜单含 NEW badge）

## 部署配置（2026-05-31）
- PM2 集群配置：deploy/ecosystem.config.js（2实例 cluster 模式，400M 内存重启）
- Nginx 生产配置：deploy/nginx/production.conf（HTTPS/SSL/Gzip/速率限制/安全头）
- 生产环境变量：backend/.env.production（JWT_SECRET、DB密码、CORS白名单等必填项）
- 一键部署脚本：deploy/deploy.sh（6步：前置检查→安装依赖→数据库迁移→前端构建→PM2重启→健康检查）
- 数据库备份：deploy/scripts/backup.sh（每日 3:00 备份，保留 7 天日备 + 4 周周备）
- 数据库迁移：deploy/scripts/db-migrate.sh（幂等执行，migration_records 表追踪）
- 定时任务：deploy/scripts/crontab.txt（备份/SSL续期/日志清理）
- 内测上线步骤：编辑 .env → bash deploy.sh → 配 Nginx+SSL → 安装 crontab

## ECS 部署关键教训（2026-06-01）
- **ESM + env.js 陷阱**：项目是 `"type": "module"`（ESM），`import { env } from './config/env.js'` 在模块解析阶段就会执行，env.js 中的所有 `process.env.XXX || 'fallback'` 在 dotenv 有机会注入之前就已经求值完毕。即使安装了 dotenv 且在 app.js 顶部 `import 'dotenv/config'`，env.js 也会先被导入。
- **PM2 部署正确姿势**：必须通过 PM2 的 `--update-env` + shell 环境变量传入所有运行时配置（PORT/DB_HOST/DB_USER/DB_PASSWORD/DB_NAME/JWT_SECRET 等），而不能依赖 `.env` 文件。或者在 `ecosystem.config.cjs` 中配置 `env` 字段。
- **生产环境 PM2 启动命令**（wework.syzs.top）：
  ```
  PORT=3010 DB_USER=wework_app DB_PASSWORD=MySecretPass123 DB_HOST=127.0.0.1 DB_NAME=wework_saas \
    pm2 start backend/src/app.js --name syqw-api -i 2 --max-memory-restart 400M --update-env
  ```
- **端口规划**：ECS 上当前端口占用 — 3000(ZhiFlow Next.js) / 3001(crm-api) / 3010(wework-saas) / 4000(zxai-api) / 4001(wechat-crm)
- **ECS 项目路径（2026-06-02 确认）：** 后端源码 `/var/www/wework-saas/backend/src/`，PM2 启动脚本 `/var/www/wework-saas/backend/src/app.js`
- **Nginx 静态文件路径：** `/var/www/wework/`（前端 dist 输出），Nginx 配置 `/etc/nginx/sites-enabled/wework`
- **部署方式：** Mac→ECS SSH 不通（安全组拦截），必须通过阿里云 Workbench 文件上传 + 终端操作
- **部署流程：** 本地构建前端 → 打包 backend/src + frontend/dist → Workbench 上传 → 解压到 `/var/www/wework-saas/` → cp dist 到 `/var/www/wework/` → pm2 restart + nginx reload
- **公司备案信息：** 杭州中数云科智慧科技有限公司 / 浙ICP备2026009605号-1（已通过 SiteLegalFooter 组件添加）
- **支付宝支付方式：** 从 precreate(扫码) 改为 page.pay(跳转)，本地 RSA 签名不依赖 ECS 出向网络
- **支付宝密钥（2026-06-02）：** APP_ID `2021000106623328`（wework全行业SaaS，勿用旧 `2021006156617373`）；上传开放平台用 `backend/certs/alipay/app_public_key_for_upload.pem`（应用公钥，勿上传私钥）；回调验签用 `alipay_public_key.pem` 或 `ALIPAY_PUBLIC_KEY`（支付宝公钥，如 Downloads 的 `alipayPublicKey_RSA2*.txt`）。验签失败 `isv.invalid-signature` = 开放平台「应用公钥」与 `.env`/`app_private_key.pem` 私钥不成对。诊断：`cd backend && npm run verify:alipay`（仓库根目录 `npm run verify:alipay` 亦可）。Mac 无 `/var/www/zhiflow`、无 `zhiflow-api` PM2；ECS 路径以实际为准（wework-saas / syqw-api）。

## 数据库迁移编号
- 092: balance_autorenew（余额充值+自动续费）
- 093: usage_addons（用量加购包）
- 094: invoice_enhance（发票系统增强）
- 091: landing_pages（落地页构建器）
- 043: billing（计费基础：plans/subscriptions/payment_records）
