# ZhiFlow

智流 — 企微 CRM / 收件箱 / AI 员工 SaaS（monorepo：`backend/` + `frontend/`）。

## 上线推广

对外推广前请依次查阅：

- [docs/deploy/launch-readiness-summary.md](docs/deploy/launch-readiness-summary.md) — 产品负责人一页就绪摘要
- [docs/deploy/launch-go-no-go.md](docs/deploy/launch-go-no-go.md) — 一页式 Go/No-Go 门禁
- [docs/deploy/go-live-ai-inbox.md](docs/deploy/go-live-ai-inbox.md) — 收件箱 AI 分阶段上线
- [docs/deploy/production-launch-runbook-zh.md](docs/deploy/production-launch-runbook-zh.md) — **wework.syzs.top** ECS 迁移 + 30 分钟验收 + Mac 打包
- `./scripts/deploy-check.sh` — 仓库根目录部署前自检（警告不阻断，错误 exit 1）
- `./scripts/smoke-test.sh [BASE_URL]` — 部署后冒烟测试（默认 `http://127.0.0.1:3000` 或 `SMOKE_BASE_URL`；本地未起服务时仅告警，显式传入生产 URL 时 `/health` 失败 exit 1）

### 推广前已完成（工程侧节选）

- Go/No-Go 门禁、CI、`deploy-check.sh` 与收件箱 AI 阶段 A 文档/护栏
- 注册页 OTP 发码/校验与 `REGISTER_OTP_REQUIRED` 开关联动
- 服务条款/隐私政策静态页与注册页 footer 链接
- 平台运营概览首发检查卡片、MRR/对账/AI 异常导出
- 账单 PDF 字体脚本 `./scripts/setup-billing-font.sh` 与 go-no-go 勾选项
- 本周战果/今日待办/流失风险等仪表盘留存组件

## 本地数据库补丁（缺表 / 权限）

当本地 `customers` 接口 500 且日志提示缺少 `tags` / `customer_tags` / `customer_follow_ups` 时（`syqw_app` 用户，勿用 root）：

```bash
mysql -h 127.0.0.1 -u syqw_app -p wework_saas < database/local_missing_tables_no_fk.sql
```

存量租户「管理员」缺收件箱 / AI 审核权限时，可执行 `database/090_admin_inbox_ai_permissions.sql`；新注册与登录也会由后端自动幂等补齐（见 `patchSystemAdminInboxAiPermsForTenant`）。
