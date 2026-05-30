# Ops Docs Index

本目录用于统一维护发布、回滚、值班与复盘文档，作为生产运维标准入口。

## 文档清单

- `release-and-rollback-sop.md`
  - 发布前检查、标准发布流程、回滚流程、降级开关、冒烟验证。
- `daily-release-log-template.md`
  - 每日发布记录模板（命令留痕、验证结果、问题与后续计划）。
- `incident-postmortem-template.md`
  - 故障复盘模板（Timeline、5 Whys、行动项 owner 与截止时间）。
- `checklists/pre-release.md`
  - 发布前 3 分钟快速检查，防止配置和流程低级失误。
- `checklists/post-release-30min.md`
  - 发布后 30 分钟稳定性观察清单（每 5 分钟巡检）。
- `checklists/rollback-quick.md`
  - 故障触发后的 5 分钟快速回滚步骤。

## 推荐使用方式

1. 发布前先按 `release-and-rollback-sop.md` 过检查项。
2. 发布窗口开始前执行 `checklists/pre-release.md`。
3. 使用一键脚本执行发布（含交互确认 + 健康检查）：
   - `bash scripts/release-onekey.sh`
   - 发布后验收：`bash scripts/post-deploy-acceptance.sh`（详见 `workbench-deploy-runbook.md`）
   - 常用参数示例：
     - `REMOTE_HOST=root@1.2.3.4 bash scripts/release-onekey.sh`
     - `NO_CONFIRM=1 SKIP_FRONTEND_SYNC=1 bash scripts/release-onekey.sh`
      - `DRY_RUN=1 REMOTE_HOST=root@1.2.3.4 bash scripts/release-onekey.sh`
   - 日志自动落盘：
     - 自动追加到 `docs/ops/daily-log-YYYYMMDD.md`
     - 自动记录 `branch`、`repo/backend/frontend` commit hash、`git status --short`
     - 如需关闭：`DISABLE_RELEASE_LOG=1 bash scripts/release-onekey.sh`
4. 发布后 30 分钟执行 `checklists/post-release-30min.md` 并留痕。
5. 若触发阈值，立即执行 `checklists/rollback-quick.md`。
6. 每次发布后填写当日记录：`daily-log-YYYYMMDD.md`（可由模板生成）。
7. 若发生故障，24 小时内产出复盘：`postmortem-YYYYMMDD-<title>.md`。

## 建议命名规范

- 每日发布日志：`daily-log-YYYYMMDD.md`
- 复盘文档：`postmortem-YYYYMMDD-<short-title>.md`

## 维护约定

- 任何生产流程变更，需同步更新本目录文档。
- 文档变更需在 PR 描述中说明“影响流程与执行人”。
