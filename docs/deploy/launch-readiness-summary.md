# ZhiFlow 上线就绪摘要（产品负责人）

一页 executive summary：当前能否推广、工程已交付什么、上线前你必须亲手完成什么、推广后 2–4 周重点。

**相关文档：** [launch-go-no-go.md](./launch-go-no-go.md) · [go-live-ai-inbox.md](./go-live-ai-inbox.md) · [README.md](../../README.md)

---

## 当前状态

**可以启动阶段 A 对外推广**（口径：**AI 写草稿 + 销售人审后再发**；全站 `INBOX_AI_AUTO_SEND=0` 时不自动外发客户）。

阶段 B（白名单半自动 FAQ/询价）与大规模自助注册加固，应在 A 稳定运行 2–4 周后再开，见下文「推广后」。

---

## 本轮已完成的工程 / 文档（节选）

- [docs/deploy/launch-go-no-go.md](./launch-go-no-go.md) — 一页 Go/No-Go 门禁清单
- [docs/deploy/go-live-ai-inbox.md](./go-live-ai-inbox.md) — 收件箱 AI 分阶段上线与 30 分钟验收
- [scripts/deploy-check.sh](../../scripts/deploy-check.sh) — 部署前自检（build、env、Mock 危险项、迁移提示）
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) — GitHub Actions：`backend npm test` + `frontend npm run build`
- [frontend/public/privacy.html](../../frontend/public/privacy.html)、[terms.html](../../frontend/public/terms.html) — 合规页骨架（需替换正式文案）
- [frontend/src/components/PlatformLaunchChecklistCard.tsx](../../frontend/src/components/PlatformLaunchChecklistCard.tsx) — 平台运营概览「首发上线检查」卡片
- [frontend/src/pages/platform/PlatformOverviewPage.tsx](../../frontend/src/pages/platform/PlatformOverviewPage.tsx) — 平台 MRR、运营摘要、AI 异常入口
- [backend/src/services/inboxAiAutoSendGuard.service.js](../../backend/src/services/inboxAiAutoSendGuard.service.js) 等 — 收件箱 AI 护栏、抽检、平台关停
- [backend/src/services/platformInboxAiAnomaly.service.js](../../backend/src/services/platformInboxAiAnomaly.service.js) — 平台 AI 异常分级与导出
- [database/072–076](../../database/) — 租户 inbox_ai 开关、定价、通知、平台禁用、qa 抽检字段
- [backend/src/jobs/platformOpsDigest.cron.js](../../backend/src/jobs/platformOpsDigest.cron.js) — 平台运营日报（需 env 开启 cron）
- [frontend/src/components/DashboardWeeklyWinsCard.tsx](../../frontend/src/components/DashboardWeeklyWinsCard.tsx) 等 — 本周战果、ROI、今日待办、流失风险横幅
- [docs/product/competitive-moat.md](../product/competitive-moat.md) — 定位、话术边界与 P0/P1 抓手
- [docs/deploy/production-checklist.md](./production-checklist.md)、[docs/ops/release-and-rollback-sop.md](../ops/release-and-rollback-sop.md) — 生产清单与发布 SOP
- [README.md](../../README.md) — 上线推广文档索引

---

## 上线前你必须手动做的

1. **生产 `backend/.env`**：阶段 A 设 `INBOX_AI_AUTO_SEND=0`；`JWT_SECRET`、企微、`PLATFORM_ADMIN_USER_IDS` 非占位；关闭 `WECHAT_PAY_MOCK` / `ALIPAY_MOCK` 等 Mock；配置有效 **`DEEPSEEK_API_KEY`**（AI 草稿/员工依赖）。
2. **数据库迁移**：至少在产执行 `072`–`076`；若开计费/支付再跑 `043`、`062`、`064`、`065` 等（见 go-no-go §2）。
3. **法务**：将 `privacy.html` / `terms.html` 占位替换为正式主体与联系方式，并完成审阅。
4. **自检**：仓库根目录执行 `./scripts/deploy-check.sh`，处理 FAIL 与关键 WARN。
5. **门禁勾选**：按 [launch-go-no-go.md](./launch-go-no-go.md) 逐项打勾（含 30 分钟手工验收，见 [go-live-ai-inbox.md §四](./go-live-ai-inbox.md#四30-分钟手工验收)）。
6. **推送与 CI**：推送后确认 GitHub Actions `ci` 为绿；平台超管在 `/app/platform` 查看「首发上线检查」卡片。

---

## 推广后 2–4 周（专家复盘 P1 重点）

- **阶段 B 试点**：全站 `INBOX_AI_AUTO_SEND=1` 后，仅 3–5 家白名单租户开启 FAQ/询价半自动；每周看平台 AI 异常名单与审核台抽检。
- **留存抓手**：确保高意向预警与跟进提醒 cron 已开；推动管理员使用「本周战果」企微推送 / 导出，能说清「本月 AI 省了多少时间」。
- **行业 playbook**：在教培 / 美业 / B2B 试点客户落地 [行业话术包](../product/competitive-moat.md) 与成交庆祝，形成可复述案例。
- **公开注册加固**：大规模投放前启用 `REGISTER_OTP_REQUIRED=1` 并打通 SMTP 或短信（见 go-live §八）。
- **商业化与续费**：结合 MRR 快照、体验到期与 churn 预警做续费干预；支付宝/微信实收与平台对账卡片周回顾。

---

## 签字（可选）

| 产品负责人 | 日期 | 阶段 A Go |
|------------|------|-----------|
| | | ☐ |
