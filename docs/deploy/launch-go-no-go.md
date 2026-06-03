# ZhiFlow 上线 Go / No-Go 清单

一页式发布门禁。全部勾选后方可对外推广；任一项未满足则 **No-Go**。

平台超管可在 **平台运营概览**（`/app/platform`）查看精简版「首发上线检查」卡片；关闭后写入浏览器 localStorage，完整项仍以本文为准。

相关文档：[go-live-ai-inbox.md](./go-live-ai-inbox.md) · [production-checklist.md](./production-checklist.md)

---

## 1. 生产环境变量（阶段 A 首发）

- [ ] `INBOX_AUTO_DRAFT=1`，`INBOX_AUTO_DRAFT_DELAY_SEC=30`
- [ ] `INBOX_AI_AUTO_SEND=0`（或不设且确认全平台禁用自动外发；租户开关无效）
- [ ] `JWT_SECRET` 已替换为 ≥32 位随机串（非 `change_me`）
- [ ] `WEWORK_CORP_ID` / `WEWORK_SECRET` / `WEWORK_TOKEN` / `WEWORK_ENCODING_AES_KEY` 已配置且与企微后台一致
- [ ] `PLATFORM_ADMIN_USER_IDS` 已填写真实超管用户 ID
- [ ] 支付 Mock 已关闭：`WECHAT_PAY_MOCK`、`ALIPAY_MOCK`、`WECHAT_PAY_SKIP_SIGNATURE_VERIFY` 均 **未** 设为 `1`
- [ ] 账单 PDF 中文字体：`BILLING_PDF_FONT_PATH` 指向有效 `.ttf`/`.otf`，或已执行 `./scripts/setup-billing-font.sh`（见 `backend/assets/fonts/README.md`）

---

## 2. 数据库迁移

### 收件箱 AI（必跑）

- [ ] `database/072_tenant_inbox_ai_auto_send.sql`
- [ ] `database/073_tenant_inbox_ai_auto_send_pricing.sql`
- [ ] `database/074_tenant_inbox_ai_notify_assignee.sql`
- [ ] `database/075_tenant_inbox_ai_platform_disabled.sql`
- [ ] `database/076_ai_reply_logs_qa.sql`

验证：`SHOW COLUMNS FROM tenants LIKE 'inbox_ai%';` 与 `SHOW COLUMNS FROM ai_reply_logs LIKE 'qa_%';` 有预期字段。

### 计费基础（若开放套餐 / 在线支付）

- [ ] `database/043_billing.sql`、`062_billing_promo_codes.sql`、`064_ai_assistant_plans.sql`
- [ ] `database/065_payment_wechat_columns.sql`（微信支付）
- [ ] 按需：`068_billing_invoice_requests.sql`、`069_billing_contract_attachments.sql`

---

## 3. 构建与 CI

- [ ] 仓库根目录 `./scripts/deploy-check.sh` 通过（前端 build + env 关键项 + 危险 Mock 告警已处理）
- [ ] GitHub Actions `ci` workflow 绿（backend `npm test` + frontend `npm run build`）
- [ ] 部署后 `./scripts/smoke-test.sh https://你的域名` 通过（API `/health` 必过；静态页同域时一并检查）

---

## 4. 30 分钟手工验收

按 [go-live-ai-inbox.md §四](./go-live-ai-inbox.md#四30-分钟手工验收) 逐项执行并记录结果：

- [ ] FAQ 类消息 → 30s 内出现 AI 草稿；阶段 A **不**自动送达客户
- [ ] 公域会话界面提示 / guard 不自动外发
- [ ] 平台租户详情近 7 日 AI 指标 + 审计表可访问
- [ ] 平台 AI 异常名单 CSV 导出字段完整
- [ ] AI 审核台抽检队列可用
- [ ] 平台运营日报预览含 AI 异常段落（有数据时）

---

## 5. 合规与法务

- [ ] `frontend/public/terms.html`、`privacy.html` 占位内容已替换为正式文案（主体、联系方式、数据处理说明等）
- [ ] 法务 / 合规已审阅服务条款与隐私政策
- [ ] 登录页、注册页、落地页 footer 已链到上述页面

---

## 6. 公开推广注册加固

对外投放落地页 / 开放自助注册前：

- [ ] `REGISTER_OTP_REQUIRED=1`
- [ ] SMTP 或阿里云短信（`REGISTER_OTP_ALIYUN_*`）已配置并完成「发码 → 注册」全流程
- [ ] `database/024_registration_otp_challenges.sql` 已在生产执行

---

## 7. 对外话术边界

与 [go-live-ai-inbox.md §六](./go-live-ai-inbox.md#六对外宣传边界避免客诉) 一致：

**可以说：**

- [ ] 口径统一为：企微统一收件箱，**AI 写回复草稿，销售确认再发**
- [ ] 高意向提醒、跟进、ROI、广告回传
- [ ] （仅试点客户）经开通的 FAQ/简单询价可在护栏内半自动回复

**不要说：**

- [ ] 未对外承诺「全渠道 AI 自动秒回」
- [ ] 未对外承诺「AI 替销售全自动成交」
- [ ] 未对外承诺「100% 无人工」

---

## 8. 签字（可选）

| 角色 | 姓名 | 日期 | Go / No-Go |
|------|------|------|------------|
| 技术负责人 | | | |
| 产品 / 运营 | | | |
| 合规（如适用） | | | |
