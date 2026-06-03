# ZhiFlow 销售资料包 · 总索引

> **本页用途**：销售、售前、老板/合伙人的**唯一入口**——按场景找到话术、演示脚本、竞品对比与上线检查，避免在仓库里散落翻找。  
> **演示前必做**：[演示前检查清单（可打印）](./demo-pre-check-checklist-zh.md) · 生产环境：[生产上线 Runbook](../deploy/production-launch-runbook-zh.md)

---

## 给谁用

| 角色 | 优先读什么 | 目标 |
|------|------------|------|
| **销售** | [一页纸](./competitive-sales-one-pager-zh.md) → [飞书话术表](./competitive-sales-feishu-table-zh.md) → [分角色 5 分钟脚本](./competitive-demo-scripts-by-persona-zh.md) | 30 秒电梯稿 + 现场演示不翻车 |
| **售前 / 解决方案** | [vs SCRM 定位](./competitive-positioning-vs-scrm-zh.md) → [分角色脚本](./competitive-demo-scripts-by-persona-zh.md) → [15 分钟演示](./demo-script.md) | 对标竞品、控模块顺序、答「和尘峰/微伴有啥不同」 |
| **老板 / 合伙人** | [一页纸](./competitive-sales-one-pager-zh.md) · [护城河](./competitive-moat.md) · [定价](./pricing.md) | 定价锚点、差异化一句话、不碰未验收承诺 |
| **内部产品/运维** | [改进路线图](./competitive-improvement-roadmap-zh.md)（**勿对外发**）· [生产 Runbook](../deploy/production-launch-runbook-zh.md) | 阶段 A 能卖能演示、迁移与健康门禁 |

---

## 新销售 5 分钟上手

1. **背一句定位**（30 秒）：打开 [销售一页纸](./competitive-sales-one-pager-zh.md) 顶部电梯稿——「企微里的销售副驾驶：先跟谁、怎么写、你来发、投流算账」。
2. **认客户类型**（1 分钟）：在 [飞书话术表](./competitive-sales-feishu-table-zh.md) 里找到对方最接近的一行（投流 SME / 尘峰微伴 / 有赞转型 / 老板怕 AI / 扣子组合）。
3. **选对演示脚本**（1 分钟）：打开 [分角色 5 分钟脚本](./competitive-demo-scripts-by-persona-zh.md) 对应章节，**不要混模块顺序**。
4. **知道不能说什么**（1 分钟）：读该行「慎说」列 + 脚本里的收尾问法；忌「全自动客服」「全面替代尘峰/微伴」。
5. **演示前一天**（1 分钟）：把 [演示前检查清单](./demo-pre-check-checklist-zh.md) 交给运维或自己勾一遍；公网 `GET /health?deep=1` 必须 **200**（见下文「部署与健康」）。

英文客户或海外渠道：直接用 [English one-pager](./competitive-sales-one-pager-en.md)。

---

## 资料文件一览

| 文件 | 一句话说明 | 对外？ |
|------|------------|--------|
| [competitive-sales-one-pager-zh.md](./competitive-sales-one-pager-zh.md) | 中文销售一页纸：定位、定价锚点、慎说 | ✅ |
| [competitive-sales-one-pager-en.md](./competitive-sales-one-pager-en.md) | 英文一页纸，结构与中文版对齐 | ✅ |
| [competitive-sales-feishu-table-zh.md](./competitive-sales-feishu-table-zh.md) | 客户类型 × 话术行表，可复制进飞书多维表格 | ✅ |
| [competitive-sales-feishu-table.csv](./competitive-sales-feishu-table.csv) | 上表 UTF-8 BOM CSV，飞书/Excel 导入 | ✅ |
| [competitive-demo-scripts-by-persona-zh.md](./competitive-demo-scripts-by-persona-zh.md) | 六类客户各 5 分钟：点哪里、说什么、演示前必查 | ✅ |
| [competitive-positioning-vs-scrm-zh.md](./competitive-positioning-vs-scrm-zh.md) | 与尘峰/微伴/有赞/扣子的对比与边界 | ✅ |
| [competitive-moat.md](./competitive-moat.md) | 护城河与长期差异化（对内讲解可用） | ⚠️ 精选对外 |
| [competitive-improvement-roadmap-zh.md](./competitive-improvement-roadmap-zh.md) | 30/60/90 天产品与稳定性路线图 | ❌ **内部** |
| [demo-script.md](./demo-script.md) | 约 15 分钟完整演示路线与数据准备 | ✅ |
| [quickstart-3min.md](./quickstart-3min.md) | 新用户 3 分钟产品路径（可辅助「每日 3 步」讲解） | ✅ |
| [demo-pre-check-checklist-zh.md](./demo-pre-check-checklist-zh.md) | 演示前可打印检查单（健康/PM2/Nginx/角色/迁移） | 对内 |
| [production-launch-runbook-zh.md](../deploy/production-launch-runbook-zh.md) | 生产 wework.syzs.top 迁移、PM2、验收 SQL | 对内 |
| [pricing.md](./pricing.md) | 套餐与试用口径细节 | ✅ |
| [onboarding.md](./onboarding.md) | 新租户开通与权限模板 | 对内/客户成功 |
| [features.md](./features.md) | 功能清单（勿当销售主话术） | 参考 |

---

## 演示当天流程

### T-1（演示前一日）

| 步骤 | 动作 | 文档 |
|------|------|------|
| 1 | 打印或共享 [演示前检查清单](./demo-pre-check-checklist-zh.md)，运维/售前逐项勾选 | 本包 |
| 2 | 确认演示租户 **迁移已齐**、`schema_migrations` 无缺口 | [Runbook §A](../deploy/production-launch-runbook-zh.md) · [路线图 P0](./competitive-improvement-roadmap-zh.md) |
| 3 | `curl` 本机 + 公网 **`/health?deep=1` = 200**，`database: true` | [生产清单 §二](../deploy/production-checklist.md) |
| 4 | 演示账号为 **销售角色**，菜单无平台/他租户泄漏 | [RBAC 清单](../permission-rbac-audit-checklist.md) |
| 5 | 按客户类型准备样例数据（高意向、收件箱草稿、广告 ROI 等） | [demo-script.md §演示前准备](./demo-script.md) · 分角色脚本各章「演示前必查」 |
| 6 | 与客户对齐：阶段 A = 草稿 + 人审，**非**全自动对外 | [go-live-ai-inbox](../deploy/go-live-ai-inbox.md) |

### T+0（演示当天）

| 步骤 | 动作 |
|------|------|
| 1 | 开场前再测一次 `https://wework.syzs.top/health?deep=1`（或约定演示域名） |
| 2 | 在 [飞书表](./competitive-sales-feishu-table-zh.md) 确认 **客户类型** → 打开 [分角色脚本](./competitive-demo-scripts-by-persona-zh.md) **对应章节** |
| 3 | 严格按该章 5 分钟表操作；「平台/售前演示前」类型用第 6 章固定顺序：高意向 → AI 话术 → 收件箱草稿 → 广告 ROI → 本周战果 |
| 4 | 需要加长演示时用 [15 分钟 demo-script](./demo-script.md) |
| 5 | 收尾：锚定 **¥299/月起 + 14 天专业版试用**，下一步迁移与 deep health 验收（见一页纸） |

### T+1（演示后跟进）

| 步骤 | 动作 |
|------|------|
| 1 | 发一页纸 PDF/链接 + 试用开通指引（[onboarding](./onboarding.md)） |
| 2 | 记录客户类型、竞品、演示章节，更新 CRM/飞书表备注 |
| 3 | 若承诺试点：拉运维做迁移 + [Runbook B 节 30 分钟验收](../deploy/production-launch-runbook-zh.md) |
| 4 | 内部同步短板（502、缺表、菜单泄漏）到 [改进路线图](./competitive-improvement-roadmap-zh.md)，**勿写进客户邮件** |

---

## 部署与健康检查（演示门禁）

演示对外推广前，环境须满足 **阶段 A**（收件箱 AI 草稿 + 人审，`INBOX_AI_AUTO_SEND=0`）。

| 检查 | 命令 / 入口 |
|------|-------------|
| 仓库部署前自检 | 仓库根目录：`./scripts/deploy-check.sh` |
| 深度健康（必过） | `curl -fsS 'https://wework.syzs.top/health?deep=1'` → HTTP 200，含 `"database":true` |
| ECS 本机 | `curl -fsS 'http://127.0.0.1:3002/health?deep=1'`（PM2 `zhiflow-api`，Nginx 指向 **3002**） |
| 502 / 上游排查 | [ECS 工作台快速排障](../deploy/ecs-workbench-quickstart-zh.md) |
| 上线总清单 | [production-checklist.md](../deploy/production-checklist.md) |
| Go/No-Go | [launch-go-no-go.md](../deploy/launch-go-no-go.md) |

**销售只需记住**：演示前清单里「健康检查」一行必须为 ✅；否则改期演示，勿硬上。

---

## 维护

- 话术、慎说、定价：每季度与 [vs SCRM](./competitive-positioning-vs-scrm-zh.md)、[一页纸](./competitive-sales-one-pager-zh.md) 对齐后更新飞书表与 CSV。  
- 新增销售材料：在本表增一行，并回链到本页。  
- 分角色脚本与飞书表「平台/售前演示前」行保持同一套必查项。
