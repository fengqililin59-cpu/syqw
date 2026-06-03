# ZhiFlow 生产环境上线清单

> **首发 Go/No-Go 门禁**：[launch-go-no-go.md](./launch-go-no-go.md)（全部勾选后方可对外推广）

## 一、服务器准备

### 1.1 基础环境
```bash
# Node.js 18+
node -v

# PM2
npm install -g pm2

# Nginx
nginx -v

# MySQL 8.0+
mysql --version
```

### 1.2 目录结构
```bash
mkdir -p /var/www/zhiflow
mkdir -p /var/log/pm2
mkdir -p /tmp/imports
```

---

## 二、部署前自检（可选）

在仓库根目录执行，会尝试前端构建并检查 `.env` 关键项：

```bash
./scripts/deploy-check.sh
```

PR 合并前可参考 GitHub Actions `ci` workflow（若已启用）。

收件箱 AI 分阶段上线、env 与 30 分钟验收见 **[go-live-ai-inbox.md](./go-live-ai-inbox.md)**。

---

## 三、代码部署

### 2.1 上传代码
```bash
# 方式一：git clone
cd /var/www/zhiflow
git clone your-repo .

# 方式二：rsync 本地上传
rsync -avz --exclude node_modules \
  ./backend/ root@服务器IP:/var/www/zhiflow/backend/
rsync -avz \
  ./frontend/dist/ root@服务器IP:/var/www/zhiflow/frontend/dist/
```

### 2.2 安装后端依赖
```bash
cd /var/www/zhiflow/backend
npm install --production
```

### 2.3 前端构建（本地执行后上传 dist）
```bash
cd frontend
npm install
npm run build
# 把 dist/ 目录上传到服务器
```

---

## 四、环境变量配置

复制并修改 .env：
```bash
cd /var/www/zhiflow/backend
cp .env.example .env
vim .env
```

**必须修改的配置项：**
```
NODE_ENV=production
PORT=3000

# 数据库（改为生产库地址）
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=zhiflow_prod
DB_USER=zhiflow
DB_PASS=强密码

# JWT（必须换成随机字符串，至少32位）
JWT_SECRET=换成随机字符串至少32位

# 域名
APP_URL=https://你的域名.com

# 企微（上线前必填）
WEWORK_CORP_ID=
WEWORK_AGENT_ID=
WEWORK_SECRET=
WEWORK_TOKEN=
WEWORK_ENCODING_AES_KEY=

# 关闭 Mock 模式
TCCC_MOCK=0
SMS_MOCK=0

# 开启定时任务
ENABLE_CAMPAIGN_REWARD_CRON=1
ENABLE_USAGE_SYNC_CRON=1
ENABLE_SUBSCRIPTION_EXPIRY_CRON=1
ENABLE_PAYMENT_EXPIRY_CRON=1
ENABLE_INTENT_ALERT_CRON=1
ENABLE_GROUP_SOP_CRON=1
ENABLE_SMS_CRON=1

# AI（站内助手 / 文案 / 意向，必填其一）
DEEPSEEK_API_KEY=sk-...

# 微信支付 Native（可选；未配置时仍可用兑换码 / 线下转账）
# BILLING_NOTIFY_BASE_URL=https://wework.syzs.top
# WECHAT_PAY_MCH_ID=
# WECHAT_PAY_APP_ID=
# WECHAT_PAY_API_V3_KEY=
# WECHAT_PAY_SERIAL_NO=
# WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/apiclient_key.pem
# 生产切勿设置 WECHAT_PAY_MOCK=1
```

---

## 五、数据库初始化

### 4.1 创建数据库
```bash
mysql -u root -p
```
```sql
CREATE DATABASE zhiflow_prod
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER 'zhiflow'@'localhost'
  IDENTIFIED BY '强密码';
GRANT ALL ON zhiflow_prod.*
  TO 'zhiflow'@'localhost';
FLUSH PRIVILEGES;
```

### 4.2 执行迁移（按顺序）
```bash
cd /var/www/zhiflow
for f in database/*.sql; do
  echo "执行 $f ..."
  mysql -u zhiflow -p zhiflow_prod < "$f"
done
```

**近期增量（若库已上线，至少补跑）：**

| 文件 | 说明 |
|------|------|
| `012_private_domain_pr_scaffold.sql` | 群发任务表 `broadcast_tasks` / `broadcast_task_recipients`（报错「表 broadcast_tasks 不存在」时先跑） |
| `018_broadcast_add_wecom_fields.sql` | 群发企微字段（`msg_type`、`wecom_msgid` 等；跑完 012 后必补） |
| `017_flow_engine.sql` | 自动化流程引擎 |
| `043_billing.sql` | 套餐 / 订阅 / 支付 |
| `062_billing_promo_codes.sql` | 兑换码 |
| `063_user_syzs_links.sql` | 主站联通（可选） |
| `064_ai_assistant_plans.sql` | AI 助手版 / 旗舰版套餐 |
| `065_payment_wechat_columns.sql` | 微信支付二维码字段 |
| `066_tenant_churn_alerts.sql` | 流失预警发送记录 |
| `067_tenant_platform_ops_notes.sql` | 平台运营回访备注 |
| `068_billing_invoice_requests.sql` | 租户开票申请（计费页申请 + 平台处理） |
| `069_billing_contract_attachments.sql` | 平台合同开单 PDF/图片附件 |
| `070_user_wechat_mp_openid.sql` | 用户公众号 openid（微信 JSAPI 支付） |
| `072_tenant_inbox_ai_auto_send.sql` | 租户 FAQ 自动发送开关 |
| `073_tenant_inbox_ai_auto_send_pricing.sql` | 租户询价自动发送开关 |
| `074_tenant_inbox_ai_notify_assignee.sql` | 自动发后企微提醒负责人 |
| `075_tenant_inbox_ai_platform_disabled.sql` | 平台关停租户 AI 自动发 |
| `076_ai_reply_logs_qa.sql` | AI 自动发抽检字段（qa_status 等） |

**收件箱 AI 自动发送（可选，生产建议配置）：**

```env
INBOX_AUTO_DRAFT=1
INBOX_AUTO_DRAFT_DELAY_SEC=30
INBOX_AI_AUTO_SEND=1
INBOX_AI_AUTO_SEND_NOTIFY=1
INBOX_AI_AUTO_SEND_DAILY_CAP=80
INBOX_AI_AUTO_SEND_THREAD_DAILY_CAP=3
INBOX_AI_QA_SAMPLE_RATE=0.1
# INBOX_AI_RISK_LLM=1
# ENABLE_AI_AUTO_REPLY_DIGEST_CRON=1
```

收件箱 / 工单依赖更早的 inbox 相关迁移，若 `056_service_tickets_orders.sql` 报错缺表，请先按编号补跑 inbox 系列脚本。

### 4.3 验证关键表
```sql
-- 确认演示数据
SELECT COUNT(*) FROM customers
WHERE tenant_id = 9999;  -- 应为 30

-- 确认权限配置
SELECT COUNT(*) FROM permissions;  -- 应为 20

-- 确认套餐
SELECT code, name FROM plans;
```

---

## 六、Nginx 配置

### 5.1 申请 SSL 证书
```bash
# 安装 certbot
apt install certbot python3-certbot-nginx

# 申请证书（先把域名解析指向服务器）
certbot --nginx -d 你的域名.com
```

### 5.2 部署 Nginx 配置
```bash
# 复制配置文件
cp deploy/nginx-zhiflow-production.conf \
  /etc/nginx/sites-available/zhiflow

# 修改配置里的域名
sed -i 's/YOUR_DOMAIN/你的域名.com/g' \
  /etc/nginx/sites-available/zhiflow

# 修改静态文件路径（如实际路径不同）
sed -i 's|/var/www/zhiflow|你的实际路径|g' \
  /etc/nginx/sites-available/zhiflow

# 启用站点
ln -s /etc/nginx/sites-available/zhiflow \
  /etc/nginx/sites-enabled/zhiflow

# 测试配置
nginx -t

# 重载
nginx -s reload
```

---

## 七、PM2 启动

### 6.1 启动服务
```bash
cd /var/www/zhiflow/backend

# 修改 ecosystem.config.js 里的路径
vim ecosystem.config.js
# 把 cwd 改为实际路径

# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs zhiflow-api --lines 50
```

### 6.2 设置开机自启
```bash
pm2 save
pm2 startup
# 按提示执行输出的命令
```

---

## 八、上线验证清单

按顺序验证，每项打勾：

### 基础功能
- [ ] `https://你的域名.com` 正常访问
- [ ] `https://你的域名.com/landing.html` 落地页正常
- [ ] `https://你的域名.com/demo` 跳转到演示系统
- [ ] 演示系统有 30 条客户数据
- [ ] 注册新账号正常
- [ ] 登录正常

### 企微集成
- [ ] 企微扫码登录正常
- [ ] 企微回调 URL 可访问（200 响应）
- [ ] 客户同步测试通过

### 核心功能
- [ ] 仪表盘数据加载正常（含「本月效率概览」ROI 卡片）
- [ ] 客户列表正常
- [ ] 意向预警页面正常
- [ ] 自动化流程可创建
- [ ] `/app/ai-assistant` 站内 AI 可对话（需 `DEEPSEEK_API_KEY`）
- [ ] 客户详情 → 企微消息 → AI 回复建议可用

### 计费与支付
- [ ] `/app/billing` 套餐与用量正常
- [ ] 试用到期顶部提醒条（≤7 天）正常
- [ ] 兑换码开通可用
- [ ] 微信支付（若已配置）：扫码 → 自动开通；回调 `POST /api/v1/billing/webhooks/wechat` 公网可达
- [ ] 支付宝（若已配置）：扫码 → 自动开通；回调 `POST /api/v1/billing/webhooks/alipay` 公网可达（响应纯文本 `success`）
- [ ] `ENABLE_SUBSCRIPTION_EXPIRY_CRON=1` 试用到期企微通知
- [ ] `ENABLE_CHURN_ALERT_CRON=1` 活跃流失每日企微预警（需 `066` 迁移）
- [ ] `ENABLE_PLATFORM_OPS_DIGEST_CRON=1` 平台运营日报（每日 08:30）
- [ ] `PLATFORM_OPS_DIGEST_DELIVERY`：`both`（默认）| `email_only`（仅邮件）| `wework_only`
- [ ] 邮件：`SMTP_*` + `PLATFORM_OPS_DIGEST_EMAILS` 或超管 `users.email`；`PLATFORM_OPS_DIGEST_EMAIL_ON_CRON=0` 可关定时邮件
- [ ] 企微：`PLATFORM_ADMIN_USER_IDS` + 超管 `wework_userid` + `PLATFORM_DIGEST_TENANT_ID`（可选）
- [ ] `ENABLE_PLATFORM_PAYMENT_RECONCILE_CRON=1` 每月 1 日 09:00 自动邮件上月对账 Excel（需 SMTP + 运营邮箱）
- [ ] 平台概览「预览 / 发送」运营日报可手动试推（企微 + 邮件）
- [ ] 仪表盘「活跃提醒」条对风险租户可见

### 性能与安全
- [ ] HTTPS 证书有效（浏览器无警告）
- [ ] API 响应时间 < 500ms
- [ ] 日志正常写入 `/var/log/pm2/`

---

## 九、上线后监控

```bash
# 实时查看日志
pm2 logs zhiflow-api

# 监控 CPU/内存
pm2 monit

# 定期查看错误
pm2 logs zhiflow-api --err --lines 100
```

---

## 十、常见问题

**Q：PM2 启动报错 Cannot find module**
```bash
cd /var/www/zhiflow/backend
npm install
```

**Q：数据库连接失败**
```bash
# 检查 MySQL 服务
systemctl status mysql
# 检查用户权限
mysql -u zhiflow -p zhiflow_prod -e "SELECT 1"
```

**Q：Nginx 502 Bad Gateway**
```bash
# 确认后端在运行
pm2 status
pm2 restart zhiflow-api
```

**Q：企微回调验证失败**
- 确认服务器已开放 443 端口
- 确认域名 SSL 证书有效
- 确认 `WEWORK_TOKEN` 和 `WEWORK_ENCODING_AES_KEY` 填写正确
