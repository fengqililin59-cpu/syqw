# 收件箱 AI 上线与推广实施清单

面向运营、实施与平台超管。与对外落地页默认口径一致：**AI 写草稿，销售确认后再发**；半自动发送为 **可选能力**，需平台与租户双重开关。

**发布前一页门禁：** [launch-go-no-go.md](./launch-go-no-go.md)

---

## 一、推荐分阶段上线

| 阶段 | 时长 | 全站 env | 租户侧 | 对外话术 |
|------|------|----------|--------|----------|
| **A · 首发** | 第 1～2 周 | `INBOX_AUTO_DRAFT=1`，`INBOX_AI_AUTO_SEND=0` 或不设 | 系统设置保持关闭自动发 | 「AI 草稿 + 人审，不替销售乱发」 |
| **B · 试点** | 验证通过后 | `INBOX_AI_AUTO_SEND=1` | 白名单 3～5 家开启 FAQ/询价 | 「企微内、护栏内的半自动 FAQ/询价」 |
| **C · 放量** | 稳定后 | 保持护栏与抽检 | 付费客户按需开通 | 合同写清：仅企微、非公域直发 |

---

## 二、生产环境变量（复制到 `backend/.env`）

### 阶段 A（默认推荐首发）

```env
INBOX_AUTO_DRAFT=1
INBOX_AUTO_DRAFT_DELAY_SEC=30
# 全平台禁用自动外发（租户开关无效）
INBOX_AI_AUTO_SEND=0
```

### 阶段 B/C（试点 / 放量）

```env
INBOX_AUTO_DRAFT=1
INBOX_AUTO_DRAFT_DELAY_SEC=30
INBOX_AI_AUTO_SEND=1
INBOX_AI_AUTO_SEND_NOTIFY=1
INBOX_AI_AUTO_SEND_DAILY_CAP=80
INBOX_AI_AUTO_SEND_THREAD_DAILY_CAP=3
INBOX_AI_QA_SAMPLE_RATE=0.1
# 可选：结构化风控（需 DeepSeek 等 API）
# INBOX_AI_RISK_LLM=1
# 可选：租户管理员 18:00 企微摘要
# ENABLE_AI_AUTO_REPLY_DIGEST_CRON=1
```

### 平台运营（超管）

```env
PLATFORM_ADMIN_USER_IDS=1,2
ENABLE_PLATFORM_OPS_DIGEST_CRON=1
# SMTP_*、PLATFORM_OPS_DIGEST_EMAILS 见 production-checklist.md
```

---

## 三、数据库迁移（增量库必跑）

按编号顺序执行，至少确认以下脚本已在生产执行：

| 文件 | 说明 |
|------|------|
| `database/072_tenant_inbox_ai_auto_send.sql` | FAQ 自动发开关 |
| `database/073_tenant_inbox_ai_auto_send_pricing.sql` | 询价自动发开关 |
| `database/074_tenant_inbox_ai_notify_assignee.sql` | 自动发后提醒负责人 |
| `database/075_tenant_inbox_ai_platform_disabled.sql` | 平台关停 |
| `database/076_ai_reply_logs_qa.sql` | 抽检字段 |

验证示例：

```sql
SHOW COLUMNS FROM tenants LIKE 'inbox_ai%';
SHOW COLUMNS FROM ai_reply_logs LIKE 'qa_%';
```

部署完成后可执行 `./scripts/smoke-test.sh https://你的域名` 快速确认 API `/health` 与（同域时）静态页可达。

---

## 四、30 分钟手工验收

| # | 操作 | 预期 |
|---|------|------|
| 1 | 企微客户发 FAQ 类消息，等 30s | 出现 AI 草稿；阶段 A 不自动送达客户 |
| 2 | 阶段 B：租户设置开启 FAQ 自动发 | p0、置信≥75%、无拦截词 → 企微送达，消息标「AI自动」 |
| 3 | 抖音/小红书等公域会话 | 界面提示勿依赖自动发；guard 不自动外发 |
| 4 | 连续触发至日上限 | 审计 `inbox_ai_auto_send_skipped` |
| 5 | 平台 → 租户详情 | 近 7 日指标 + AI 审计表 |
| 6 | 平台 → AI 异常名单 → **导出 CSV** | Excel 可打开，字段完整 |
| 7 | AI 审核台 → 抽检队列 | 约 10% 入队；通过/有问题写审计 |
| 8 | 平台运营日报预览 | 含「AI 自动发异常」段落（有数据时） |

---

## 五、平台运营日常（放量后）

1. **每日**：平台概览 → AI 异常横幅 / [AI 自动发异常](/app/platform/inbox-ai-anomalies)
2. **每周**：AI 审核台 → 抽检队列 + 自动已发复盘
3. **风险租户**：租户详情 → 指标异常 → 一键关停 → 回访备注
4. **审计**：租户详情「AI 自动发审计」或全站审计日志筛选 `inbox_ai_*`

---

## 六、对外宣传边界（避免客诉）

**可以说：**

- 企微统一收件箱，AI 写回复草稿，销售确认再发
- 高意向提醒、跟进、ROI、广告回传
- （试点客户）经开通的 FAQ/简单询价可在护栏内半自动回复

**不要说：**

- 「全渠道 AI 自动秒回客户」（公域无真实出站 API）
- 「AI 替销售全自动成交」（合同/投诉/底价等仍转人工）
- 「100% 无人工」（始终有人审与抽检）

---

## 七、已知限制（实施须知）

| 项 | 说明 |
|----|------|
| 收件箱「AI已回」筛选 | 优先排序时最多扫描约 500 条会话，超大租户可能不全 |
| 公域渠道 | 仅草稿 + 系统记录，不自动发到抖音/小红书 |
| 自动化测试 | 异常分级 + `qualifiesForInboxAutoSend` 有单测；护栏与出站仍依赖上表手工验收 |
| 历史平台关停审计 | 修复前写入超管租户的记录，可能不在客户租户审计页 |

---

## 八、公开推广时的注册加固（建议）

对外大规模投放落地页 / 开放自助注册前，建议在生产 `backend/.env` 启用：

```env
REGISTER_OTP_REQUIRED=1
```

并配置至少一种验证码通道：

- **邮件**：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM`（见 `backend/.env.example`）
- **短信**：`REGISTER_OTP_ALIYUN_*` 阿里云短信模板

数据库需已执行 `database/024_registration_otp_challenges.sql`（注册 OTP 挑战表）。未配置 SMTP/短信时，`REGISTER_OTP_REQUIRED=1` 会导致注册接口不可用，上线前请在预发完成一次「发码 → 注册」全流程。

`scripts/deploy-check.sh` 在检测到未设置 `REGISTER_OTP_REQUIRED=1` 时会给出 **WARN**（不阻断构建），供推广前自查。

---

## 九、相关文档

- [launch-go-no-go.md](./launch-go-no-go.md) — 上线 Go/No-Go 一页清单
- [production-checklist.md](./production-checklist.md) — 全站部署
- [../product/features.md](../product/features.md) — 功能说明
- [../product/competitive-moat.md](../product/competitive-moat.md) — 定位与话术
