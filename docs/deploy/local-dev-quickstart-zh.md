# Mac 本地开发快速上手

> **目标**：每次改代码、推 ECS 之前，在本机用 `syqw_app` + `wework_saas` 跑通 API，避免把 500/缺表/缺列带到生产。  
> **每日一条命令**：仓库根目录执行 `./scripts/local-dev-smoke.sh`（见文末）。

---

## 0. 路径（必须在仓库根，不是 `~`）

```bash
cd /Users/591464076qq.com/syqw
# 或你的实际克隆路径，例如：
# cd ~/syqw
pwd   # 应能看到 backend/、database/、frontend/
```

---

## 1. `backend/.env`（开发）

从示例复制后只改本机需要的项（**勿提交** `.env`）：

```bash
cp backend/.env.example backend/.env
```

建议最小配置：

| 变量 | 本地值 |
|------|--------|
| `NODE_ENV` | `development` |
| `REGISTER_OTP_REQUIRED` | `0`（关闭注册验证码，方便登录） |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3306` |
| `DB_NAME` | `wework_saas` |
| `DB_USER` | `syqw_app`（或本机可用的账号） |
| `DB_PASSWORD` | 本机 MySQL 密码 |
| `JWT_SECRET` | 任意长随机串（开发用） |

```bash
# 密码必须与 backend/.env 中 DB_PASSWORD 一致（勿用交互输错密码导致 1045）
export MYSQL_PWD="$(grep -E '^DB_PASSWORD=' backend/.env | cut -d= -f2-)"
mysql -h127.0.0.1 -u syqw_app wework_saas -e "SELECT 1"

# 或单次手动（-p 后粘贴 .env 里的 DB_PASSWORD）：
# mysql -h127.0.0.1 -u syqw_app -p wework_saas -e "SELECT 1"
```

---

## 2. SQL 补丁顺序（`syqw_app` 无 REFERENCES 时）

在**项目根目录**执行，顺序不要颠倒：

| 顺序 | 文件 | 作用 |
|:----:|------|------|
| 1 | `database/local_fix_core_tables_no_fk.sql` | 核心表 + **070 `wechat_mp_openid`**（幂等） |
| 2 | `database/local_missing_tables_no_fk.sql` | tags / customer_tags / customer_follow_ups |
| 3 | `database/local_schema_gaps_no_fk.sql` | intent_score、audit user_agent、kpi_targets 等 |
| 4 | `database/local_inbox_and_customers_no_fk.sql` | inbox_threads、discovery_profile、tasks、notifications 等 |
| 5 | `database/zhiflow_prod_phase10_12_no_fk.sql` | 营销/知识库/自定义字段/仪表盘/audit user_agent |
| 6 | `database/070_user_wechat_mp_openid.sql` | 可选；若已跑过 1 可跳过 |

```bash
cd /Users/591464076qq.com/syqw   # 必须在仓库根；在 backend/ 下会找不到 database/*.sql
export MYSQL_PWD="$(grep -E '^DB_PASSWORD=' backend/.env | cut -d= -f2-)"
mysql -h127.0.0.1 -u syqw_app wework_saas < database/local_fix_core_tables_no_fk.sql
mysql -h127.0.0.1 -u syqw_app wework_saas < database/local_missing_tables_no_fk.sql
mysql -h127.0.0.1 -u syqw_app wework_saas < database/local_schema_gaps_no_fk.sql
mysql -h127.0.0.1 -u syqw_app wework_saas < database/local_inbox_and_customers_no_fk.sql
mysql -h127.0.0.1 -u syqw_app wework_saas < database/zhiflow_prod_phase10_12_no_fk.sql
```

**审批 / 通知 / 商品等 Phase 10–12 表**：若 `GET /api/v1/approvals` 仍 500，说明库比代码旧。可二选一：

- **推荐（本机有 root）**：`bash deploy/scripts/db-migrate.sh`（会按文件名顺序跑 `database/*.sql`，含外键的脚本可能因 `syqw_app` 权限失败，失败项需 root 补跑或跳过）。
- **仅冒烟**：先跑上面 1–2 + 确保后端已启动；缺表时 smoke 会标 `[FAIL]` 并提示补迁移。

单独补 070（未跑 local_fix 时）：

```bash
mysql -h127.0.0.1 -u syqw_app -p wework_saas < database/070_user_wechat_mp_openid.sql
```

---

## 3. 启动后端（端口 3000）

```bash
cd /Users/591464076qq.com/syqw/backend
npm install   # 首次

# 若 EADDRINUSE: address already in use :::3000
npm run kill:3000
# 或：lsof -ti:3000 | xargs kill -9

npm run dev:no-watch
```

仓库根目录等价命令：

```bash
npm run backend:dev:clean   # kill 3000 + 启动
```

健康检查：

```bash
curl -s http://127.0.0.1:3000/health
```

---

## 4. 启动前端（Vite）

**新开一个终端**，仍在仓库根或 `frontend/`：

```bash
cd /Users/591464076qq.com/syqw/frontend
npm install   # 首次
npm run dev
```

| 情况 | 地址 |
|------|------|
| 默认 | http://localhost:5173 |
| 5173 被占用 | Vite 自动用 **5174**（终端会打印 `Local: http://localhost:5174`） |

`vite.config.ts` 已将 `/api` 代理到 `http://127.0.0.1:3000`，浏览器一般只访问前端端口即可。

根目录快捷：

```bash
npm run frontend:dev
```

---

## 5. 测试账号（租户 5）

| 用户名 | 角色说明 |
|--------|----------|
| `admin` | 租户管理员 |
| `qa_manager` | 经理（RBAC 场景） |
| `qa_sales` | 销售（受限权限） |

密码以本机库为准（勿写入仓库）。登录需带 `tenant_id`：

```json
{ "tenant_id": 5, "username": "admin", "password": "你的密码" }
```

管理员角色权限：登录时会幂等调用 `patchSystemAdminInboxAiPermsForTenant`（`role.service.js`），无需手改库即可补 AI/收件箱相关 perm。

---

## 6. curl 冒烟（手动）

```bash
API=http://127.0.0.1:3000/api/v1

# 登录
TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":5,"username":"admin","password":"YOUR_PASSWORD"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data?.token||''")

echo "token length: ${#TOKEN}"

# 当前用户
curl -sS -H "Authorization: Bearer $TOKEN" "$API/auth/me"

# 权限列表（审批路由使用 customer:read → 别名 customer:view）
curl -sS -H "Authorization: Bearer $TOKEN" "$API/auth/me/permissions"

# 审批列表（需 approval_* 表已存在）
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer $TOKEN" "$API/approvals?page=1&page_size=5"
```

期望：`/health` 200；登录返回 `data.token`；`/auth/me` 200；`/approvals` 200（表齐全时）或 500（缺表，需补迁移）。

---

## 7. 自动化冒烟脚本

```bash
cd /Users/591464076qq.com/syqw
chmod +x scripts/local-dev-smoke.sh

# 可选：带登录账号（勿提交到 git）
export LOGIN_TENANT_ID=5
export LOGIN_USERNAME=admin
export LOGIN_PASSWORD='你的密码'

./scripts/local-dev-smoke.sh
```

环境变量见脚本头部注释。`SKIP_SQL=1` 跳过 SQL；`SKIP_API=1` 仅测库与 import。

---

## 8. 推 ECS 前的日常节奏

1. 本机：`./scripts/local-dev-smoke.sh` → 全部 `[PASS]` 或已知 WARN  
2. 后端 + 前端手点关键路径（登录、客户列表、审批 Tab）  
3. 再打包 / Workbench 上传（见 [ecs-workbench-quickstart-zh.md](./ecs-workbench-quickstart-zh.md)）

---

## 9. 常见阻塞

| 现象 | 处理 |
|------|------|
| `Unknown column 'wechat_mp_openid'` | 跑 `local_fix` 或 `070` |
| `Table 'tags' doesn't exist` | 跑 `local_missing_tables_no_fk.sql` |
| `403 缺少权限: customer:read` | 已用 `LEGACY_PERMISSION_ALIAS`；确认角色含 `customer:view` 或 `*` |
| `EADDRINUSE :::3000` | `npm run kill:3000`（在 `backend/`） |
| Mac 连不上 ECS 上的 MySQL | 正常；迁移只在 ECS 或本机库做 |
| `approvals` 500 | 补 Phase 10–12 表或完整 `db-migrate.sh` |
| `no such file database/…sql` | 当前目录不是仓库根；先 `cd …/syqw` 再执行 `mysql < database/…` |
| curl `401` / `token length: 0` | `TOKEN` 须为登录返回的真实 JWT，勿用占位符 `你的JWT` |
| 营销 `creator` 别名错误 | 拉最新 backend 并重启；本地再跑 `zhiflow_prod_phase10_12_no_fk.sql` |
| `Table '…marketing_opt_outs' doesn't exist` | 表名为 **`marketing_optouts`**（无中间下划线）；跑 `local_inbox` 或 `zhiflow_prod_phase10_12_no_fk.sql` |
| MySQL **1045** `syqw_app` | 密码用 `backend/.env` 的 `DB_PASSWORD`，见上文 `export MYSQL_PWD=…` |
