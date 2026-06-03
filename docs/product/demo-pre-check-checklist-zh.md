# ZhiFlow 演示前检查清单（可打印）

> **适用**：客户演示、老板路演、渠道试点开通前 **24 小时**内完成。  
> **依据**：[分角色演示脚本 §6](./competitive-demo-scripts-by-persona-zh.md)、[改进路线图 30 天 P0](./competitive-improvement-roadmap-zh.md)、[生产 Runbook §B](../deploy/production-launch-runbook-zh.md)  
> **索引入口**：[销售资料包总索引](./sales-kit-README-zh.md) · [飞书话术表](./competitive-sales-feishu-table-zh.md)

**演示域名（默认）**：`https://wework.syzs.top`  
**打印说明**：每项勾选 ☐ → ☑；任 **P0** 未通过则 **禁止对外演示**，先走运维/研发。

---

## 一、健康检查（P0）

| ☐ | 检查项 | 命令 / 预期 |
|---|--------|-------------|
| ☐ | 本机 API 存活 | `curl -fsS http://127.0.0.1:3002/health` → `ok: true` |
| ☐ | 深度健康（库连通） | `curl -fsS 'http://127.0.0.1:3002/health?deep=1'` → HTTP 200，含 `"database":true` |
| ☐ | 公网健康 | `curl -fsS https://wework.syzs.top/health` → 200 |
| ☐ | 公网深度健康 | `curl -fsS 'https://wework.syzs.top/health?deep=1'` → 200，`database: true` |
| ☐ | 仓库部署前自检（发布窗口） | 仓库根：`./scripts/deploy-check.sh` 无 FAIL |
| ☐ | 冒烟（可选） | `./scripts/smoke-test.sh https://wework.syzs.top` 通过 |

---

## 二、Nginx 与 PM2（P0）

| ☐ | 检查项 | 命令 / 预期 |
|---|--------|-------------|
| ☐ | Nginx 配置语法 | `sudo nginx -t` → syntax ok |
| ☐ | 上游端口 **3002** | `grep proxy_pass /etc/nginx/conf.d/wework-https.conf` → `127.0.0.1:3002`（**非** 3000/3010） |
| ☐ | 前端静态目录 | `root` → `/var/www/zhiflow/frontend/dist` |
| ☐ | PM2 进程在线 | `pm2 status zhiflow-api` → **online** |
| ☐ | 端口监听 | `ss -lntp \| grep 3002` 有 `zhiflow-api` |
| ☐ | 近 30 行无连续 crash | `pm2 logs zhiflow-api --lines 30 --nostream` |

---

## 三、环境变量 · 阶段 A（P0）

在 `backend/.env` 确认（演示须 **人审、禁止自动外发**）：

| ☐ | 变量 | 预期 |
|---|------|------|
| ☐ | `INBOX_AI_AUTO_SEND` | **0** |
| ☐ | `INBOX_AUTO_DRAFT` | 1（草稿开启） |
| ☐ | `PORT` | **3002** |
| ☐ | `APP_URL` | `https://wework.syzs.top` |
| ☐ | 支付 Mock | 未开启 `WECHAT_PAY_MOCK` / `ALIPAY_MOCK` |
| ☐ | `DEEPSEEK_API_KEY`（若演示 AI 草稿） | 已配置且有效 |

改 env 后：`pm2 restart zhiflow-api --update-env`

---

## 四、数据库迁移（P0）

| ☐ | 检查项 | 操作 |
|---|--------|------|
| ☐ | 演示租户所在库迁移已齐 | `schema_migrations` 无缺口；关键业务表存在（见 [Runbook §A](../deploy/production-launch-runbook-zh.md)） |
| ☐ | 收件箱 AI 列 | `SHOW COLUMNS FROM tenants LIKE 'inbox_ai%';` 有结果 |
| ☐ | 权限/套餐表 | `permissions`、`plans` 可查询，无 500 |
| ☐ | 新功能表（若演示对应模块） | 按路线图 072–076+ 及业务模块对照 `SHOW TABLES` |

---

## 五、角色与菜单（P0）

| ☐ | 检查项 | 预期 |
|---|--------|------|
| ☐ | 演示账号为 **租户销售**（非平台超管冒充） | 登录 `/auth/me` 角色正确 |
| ☐ | 菜单无 **平台管理**、无他租户数据 | 销售只见：客户 / 收件箱 / 仪表盘 / 帮助等约定集 |
| ☐ | 收件箱、客户列表 API 无 403/500 | 浏览器 Network 抽查 |
| ☐ | RBAC 审计（大版本发布前） | [permission-rbac-audit-checklist.md](../permission-rbac-audit-checklist.md) 已跑 |

---

## 六、演示数据 · 按客户类型（P1）

在 [飞书话术表](./competitive-sales-feishu-table-zh.md) 选定类型后，打开 [分角色脚本](./competitive-demo-scripts-by-persona-zh.md) 对应章「演示前必查」：

| 客户类型 | 最低数据要求（摘要） |
|----------|----------------------|
| 投流型 SME | 广告 ROI ≥2 渠道样例；高意向/待跟进各 ≥3；本周战果有数 |
| 尘峰/微伴 | 高意向+收件箱草稿流畅；话术强调「补充」非替换 |
| 有赞转型 | B2B 线索与 pipeline；勿主打门店/分佣 |
| 老板怕 AI | AI 开关可演示；仅草稿→审核发出 |
| 扣子组合 | 客户时间线完整；不贬低扣子 |
| 平台/售前对内 | 模块顺序：高意向→AI 话术→收件箱→ROI→本周战果 |

通用：[demo-script.md §演示前准备](./demo-script.md)（≥20 客户、标签、活码、预警样例等，15 分钟场适用）。

---

## 七、口径与对外承诺（P1）

| ☐ | 事项 |
|---|------|
| ☐ | 不承诺「全自动替代客服」「替代 80% 客服」 |
| ☐ | 不承诺「全面替代尘峰/微伴/有赞」 |
| ☐ | 半自动外发仅白名单试点，须单独协议（若被问） |
| ☐ | 对外：阶段 A、单租户试点；功能以对方环境验收为准 |
| ☐ | 定价锚点：专业版 **¥299/月起 + 14 天试用**（见 [一页纸](./competitive-sales-one-pager-zh.md)） |

---

## 八、签字栏（可选）

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 售前/销售 | | | |
| 运维 | | | |
| 产品（试点/新模块） | | | |

**P0 未全绿**：□ 改期演示　□ 仅内部分享（不对外承诺功能）

---

## 相关链接

- [销售资料包总索引](./sales-kit-README-zh.md)
- [生产上线 Runbook](../deploy/production-launch-runbook-zh.md)
- [生产清单 · deploy-check](../deploy/production-checklist.md)
- [改进路线图（内部）](./competitive-improvement-roadmap-zh.md)
