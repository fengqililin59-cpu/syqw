# ECS Workbench 快速上手（ZhiFlow / wework.syzs.top）

> **解决什么问题**：在 Mac 本机误跑生产命令、ECS 上找不到 `deploy/` / `database/077` / `install.sh`、公网 `502`。  
> **完整上线清单**仍见 [production-launch-runbook-zh.md](./production-launch-runbook-zh.md)。

---

## ECS 排障一行命令（复制粘贴）

```bash
pm2 logs zhiflow-api --lines 40 --nostream; ss -lntp | grep -E '3000|3002' || true; curl -sS -o /dev/null -w "3002 health -> %{http_code}\n" http://127.0.0.1:3002/health; grep -E '^PORT=' /var/www/zhiflow/backend/.env; grep -E 'proxy_pass' /etc/nginx/conf.d/wework-https.conf 2>/dev/null | head -3
```

`Connection refused` 且 PM2 为 online：多为监听 **3000** 而非 **3002**——确认 `backend/.env` 有 `PORT=3002`，`ecosystem.config.js` **不要**写 `PORT=3000`，然后 `pm2 delete zhiflow-api && cd /var/www/zhiflow/backend && pm2 start ecosystem.config.js --env production && pm2 save`。

---

## 先记住两件事

| 环境 | 代码根目录 | 有没有完整 Git 仓库 |
|------|------------|---------------------|
| **Mac 开发** | `~/syqw`（或 `/Users/你/syqw`） | ✅ 有 `database/`、`deploy/`、`scripts/` |
| **ECS 生产** | `/var/www/zhiflow` | ❌ 通常**只有**已部署的 `backend/` + `frontend/dist/`，**没有** `deploy/`、完整 `database/` |

Workbench **默认上传包**（`pack-workbench-upload.sh`）只含：`backend/src`、`frontend/dist`、少量 SQL（058–061）、包内 `./install.sh`。**不含** `deploy/scripts/db-migrate.sh`、**不含** `077_custom_fields.sql` 及以后迁移。

---

## 命令该在哪执行？

| 命令 / 操作 | Mac？ | ECS？ | 说明 |
|-------------|:-----:|:-----:|------|
| `./scripts/pack-workbench-upload.sh` | ✅ | ❌ | 本地构建并打 tar.gz |
| Workbench 上传 `wework-workbench-*.tar.gz` 到 `/tmp` | ✅ 上传 | — | 在阿里云控制台操作 |
| `cd /tmp && tar xzf … && ./install.sh`（需设 ZhiFlow 环境变量） | ❌ | ✅ | 在**解压后的包目录**里，不是 `/var/www/zhiflow` |
| `bash deploy/scripts/db-migrate.sh` | ❌* | ✅ | *Mac 上无生产 `.env`、无 `zhiflow` 库权限时会失败 |
| `mysql … < database/077_….sql` | ❌ | ✅ | 必须在 ECS，且 `database/` 文件要先存在 |
| `pm2 restart zhiflow-api` | ❌ | ✅ | Mac 上一般没有 `zhiflow-api` 进程 |
| `curl http://127.0.0.1:3002/health` | ❌ | ✅ | 本机环回只在 ECS 有意义 |
| `curl https://wework.syzs.top/health` | ✅ | ✅ | 公网探测两边都可 |
| `npm run build`（前端） | ✅ | 可选 | 正常在 Mac 构建后打进包 |
| `cd /var/www/zhiflow` | ❌ | ✅ | Mac 无此路径 |

---

## Mac 本地路径

```bash
# 进入仓库（按你的实际用户名改路径）
cd ~/syqw
# 或
cd /Users/591464076qq.com/syqw

ls -la scripts/pack-workbench-upload.sh deploy/scripts/db-migrate.sh database/077_custom_fields.sql
```

本地 MySQL 用户 **`zhiflow` 拒绝访问** 是正常现象：生产库只在 ECS `127.0.0.1` 上，不要在 Mac 跑迁移。

---

## ECS：`/var/www/zhiflow` 里通常有什么？

```bash
# 登录 ECS Workbench 后
ls -la /var/www/zhiflow
ls -la /var/www/zhiflow/backend/.env 2>/dev/null || echo "缺少 backend/.env"
ls /var/www/zhiflow/deploy/scripts/db-migrate.sh 2>/dev/null || echo "无 deploy/（常见）"
ls /var/www/zhiflow/database/077_custom_fields.sql 2>/dev/null || echo "无 database/077（常见）"
pm2 list
```

**典型布局（仅运行态）**

```
/var/www/zhiflow/
├── backend/
│   ├── .env          # 生产配置（勿从 Mac 误提交）
│   ├── package.json
│   ├── node_modules/
│   └── src/
└── frontend/
    └── dist/         # Nginx root 指向这里
```

**完整仓库布局（跑 `db-migrate.sh` 需要）**

```
/var/www/zhiflow/
├── backend/.env
├── database/*.sql
└── deploy/scripts/db-migrate.sh
```

若 `deploy/` 缺失：在 **Mac** 执行 `bash deploy/scripts/pack-migrate-upload.sh`，上传 `dist-workbench/zhiflow-migrate-*.tar.gz` 到 ECS（见下文「块 B」）。

---

## Workbench 包内容与 `install.sh` 默认路径

`scripts/pack-workbench-upload.sh` 产出 `dist-workbench/wework-workbench-时间戳.tar.gz`，解压后结构：

```
wework-workbench-YYYYMMDD-HHMMSS/
├── install.sh              # 即 server-unpack-workbench.sh
├── post-deploy-acceptance.sh
├── backend/src/ …
├── backend/package.json
├── frontend/dist/ …
└── database/               # 仅 058–061（若仓库里有）
```

`install.sh` **默认**已指向 ZhiFlow 生产路径（未 export 时）：

| 变量 | 默认值 |
|------|--------|
| `BACKEND_DIR` | `/var/www/zhiflow/backend` |
| `FRONTEND_DIR` | `/var/www/zhiflow/frontend/dist` |
| `PM2_APP` | `zhiflow-api` |
| `HEALTH_PORT` | `3002` |

旧栈 wework-saas 部署时再自行 `export BACKEND_DIR=…` 覆盖。

### `pm2 list` 里没有 `zhiflow-api`

进程从未创建或曾被 `pm2 delete` 时，`pm2 restart zhiflow-api` 会报 **Process not found**。在 ECS 任选其一：

```bash
# A) 已有 /var/www/zhiflow/backend 与 .env（推荐）
cd /var/www/zhiflow/backend
grep -E '^PORT=' .env   # 应为 PORT=3002
pm2 start ecosystem.config.js --env production --only zhiflow-api
pm2 save
curl -fsS http://127.0.0.1:3002/health

# B) 刚上传 Workbench 包（含 backend/src + install.sh）
cd /tmp && tar xzf wework-workbench-*.tar.gz && cd wework-workbench-*
sudo ./install.sh
```

`install.sh` 会：同步 `backend/src`、复制 `ecosystem.config.js`（若包内有）、`npm ci --omit=dev`，并在无进程时用 ecosystem 启动 **`zhiflow-api`**。

在 `/var/www/zhiflow` 直接执行 `./install.sh` 会 **command not found**——`install.sh` 只在 `/tmp/wework-workbench-*` 解压目录里。

---

## 公网 502：`/health?deep=1` 失败排查

502 表示 **Nginx 连不上上游**，多数是 API 未监听或端口不一致。

```bash
# 1) PM2
pm2 list
pm2 describe zhiflow-api
pm2 logs zhiflow-api --lines 40 --nostream

# 2) 本机 API（应先 200，再查公网）
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/health
curl -fsS 'http://127.0.0.1:3002/health?deep=1' | head -c 300; echo

# 3) Nginx 必须指向 3002，静态在 zhiflow
grep -E 'proxy_pass|root' /etc/nginx/conf.d/wework-https.conf

# 4) 重启
cd /var/www/zhiflow/backend && pm2 restart zhiflow-api --update-env
sudo nginx -t && sudo nginx -s reload

# 5) 再测公网
curl -fsS 'https://wework.syzs.top/health?deep=1' | head -c 300; echo
```

| 现象 | 常见原因 |
|------|----------|
| `127.0.0.1:3002` 失败 | `zhiflow-api` 未启动、`.env` 错误、迁移未跑导致启动崩溃 |
| 本机 200、公网 502 | Nginx `proxy_pass` 仍指向 **3010/3000** 或 `zhiflow-api` offline |
| `deep=1` 无 `database:true` | `backend/.env` 中 DB 配置错误或 `zhiflow` 用户密码不对 |

**勿占用**：3000（ai-router）、3010（wework-saas 旧栈）。

---

## `zhiflow-api` 在线但 `curl :3002` Connection refused

PM2 显示 `online` 且 uptime 仅 **0s～数秒** 时，多为**启动后立即崩溃**或**监听端口不是 3002**。

```bash
# 1) 日志（最先看）
pm2 logs zhiflow-api --lines 50 --nostream

# 2) 进程实际监听端口（应有 3002；若在 3000 则 Nginx/健康检查会连不上）
grep -E '^PORT=' /var/www/zhiflow/backend/.env
ss -lntp | grep -E '3000|3002|node' || netstat -lntp | grep -E '3000|3002'

# 3) PM2 是否用 ecosystem 写死了 PORT=3000（会覆盖 .env）
pm2 env zhiflow-api | grep -E '^PORT='
pm2 describe zhiflow-api | grep -E 'script path|exec cwd|status|restarts'

# 4) 数据库（app.js 启动前会 sequelize.authenticate，连不上则进程退出）
grep -E '^DB_' /var/www/zhiflow/backend/.env
mysql -h127.0.0.1 -u"$(grep ^DB_USER= /var/www/zhiflow/backend/.env | cut -d= -f2)" -p \
  "$(grep ^DB_NAME= /var/www/zhiflow/backend/.env | cut -d= -f2)" -e "SELECT 1"

# 5) 修正后重启（确保 .env 中 PORT=3002）
cd /var/www/zhiflow/backend
# 推荐：用仓库内 ecosystem，且勿在 PM2 env 里硬编码 PORT
pm2 delete zhiflow-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3002/health
```

| 日志 / 现象 | 处理 |
|-------------|------|
| `ECONNREFUSED` / `3306` / `Failed to start` | 修正 `DB_*`，确认 MySQL 运行；缺表可先跑 `ecs-apply-prod-schema.sh` |
| `listen` 在 **3000** | `.env` 设 `PORT=3002`；`pm2 delete zhiflow-api` 后重新 `start`，避免旧 `pm2 env` 残留 |
| `Cannot find module` / `ERR_REQUIRE_ESM` | 在 `backend` 执行 `npm ci --omit=dev`，重新部署最新 `src/` |
| 反复 restart、`↺` 很高 | 看 `pm2 logs` 首条 stack；常见为 DB 密码错、`DB_NAME` 仍指向 `wework_saas` |

---

## 常见错误对照

| 报错 / 现象 | 原因 | 处理 |
|-------------|------|------|
| Mac: `cd /var/www/zhiflow` 不存在 | 生产路径只在 ECS | Mac 用 `cd ~/syqw`；ECS 用 `/var/www/zhiflow` |
| Mac: `pm2` 无 `zhiflow-api` | 生产进程在 ECS | 到 ECS 执行 `pm2 list` |
| Mac: `mysql -uzhiflow` Access denied | 生产库不在 Mac | 仅在 ECS 用 `zhiflow` 连 `zhiflow_prod` |
| ECS: `deploy/scripts/db-migrate.sh` 不存在 | 未部署完整仓库 | 上传 `database/` + `deploy/scripts`（块 B）或单文件执行 SQL |
| ECS: `database/077_….sql` 不存在 | Workbench 包不带 077+ | Mac: `bash deploy/scripts/pack-migrate-upload.sh` 上传后 `ecs-apply-prod-schema.sh` |
| ECS: `database/zhiflow_prod_phase10_12…` 不存在 | 未上传迁移包 | 同上；勿在 `backend/` 目录找 `database/` |
| `curl :3002` Connection refused | 端口错或 API 崩溃 | 上一节 PM2 日志 + `PORT=3002` + DB |
| ECS: `./install.sh` not found | 在错误目录 | 先 `cd /tmp/wework-workbench-*` 再执行 |
| 公网 502 | 上游挂了或端口错 | 上一节 PM2 + Nginx + 3002 |
| `marketing_messages` / `kb_categories` 不存在 | 未跑 Phase 10–12 迁移 | `mysql … < database/zhiflow_prod_phase10_12_no_fk.sql` |
| `Unknown column … user_agent` | audit 表缺列 | 同上 SQL（含 operation_audit_logs 列补齐） |
| `/notifications/unread-count` 403 | 旧后端要求 customer:read | 部署最新 backend 后 `pm2 restart zhiflow-api` |
| 营销 `creator` 别名 Tenant | 旧 marketingCampaign.service | 同上部署 + 重启 |
| 注册页：`Table 'wework_saas.registration_otp_challenges' doesn't exist` | API 连的库缺表，或 `DB_NAME` 仍是旧栈 `wework_saas` | 见下文「注册 OTP 表缺失」 |

---

## 注册 OTP 表缺失（`/register` 报 `registration_otp_challenges`）

**现象**：浏览器打开 https://wework.syzs.top/register 时 API 返回类似：

```text
Table 'wework_saas.registration_otp_challenges' doesn't exist
```

**含义**：错误里的库名（如 `wework_saas`）就是当前 `backend/.env` 里 **`DB_NAME` 实际连上的库**。ZhiFlow 生产应使用 **`zhiflow_prod`** + 用户 **`zhiflow`**；若仍是 `wework_saas`，说明配置未切库或迁移只在另一库跑过。

**表 DDL**（幂等，可重复执行）：仓库 `database/024_registration_otp_challenges.sql`（`CREATE TABLE IF NOT EXISTS`）。

### 复制粘贴：ECS 诊断

```bash
# 1) 看 API 实际用的库（以文件为准，改 .env 后需 pm2 restart --update-env）
grep -E '^DB_|^REGISTER_OTP' /var/www/zhiflow/backend/.env

pm2 describe zhiflow-api | grep -E 'exec cwd|status'
```

期望生产大致为：

```env
DB_NAME=zhiflow_prod
DB_USER=zhiflow
REGISTER_OTP_REQUIRED=1   # 推广前可暂为 0，见下文应急
```

若 `DB_NAME=wework_saas`：要么改回 `zhiflow_prod`（推荐），要么在 **`wework_saas`** 上补表（仅当确认该库仍是唯一数据源）。

### 复制粘贴：在正确库建表

**方式 A — 已有完整 `database/`（推荐）**

```bash
cd /var/www/zhiflow
# 若无 024，先在 Mac 打迁移包上传：tar czf … database deploy/scripts
test -f database/024_registration_otp_challenges.sql || echo "缺少 024，请上传 zhiflow-migrate 包"

# 把下面 DB 改成 grep 看到的 DB_NAME（zhiflow_prod 或 wework_saas）
DB=zhiflow_prod
mysql -h127.0.0.1 -uzhiflow -p "$DB" < database/024_registration_otp_challenges.sql

mysql -h127.0.0.1 -uzhiflow -p "$DB" -e "SHOW TABLES LIKE 'registration_otp_challenges';"
```

**方式 B — 无 `database/024` 文件时，内联幂等 DDL（把 `zhiflow_prod` 换成你的 `DB_NAME`）**

```bash
mysql -h127.0.0.1 -uzhiflow -p zhiflow_prod <<'SQL'
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS `registration_otp_challenges` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `channel` ENUM('email','sms') NOT NULL,
  `target` VARCHAR(191) NOT NULL COMMENT '规范化后的邮箱或手机号',
  `code_hash` CHAR(64) NOT NULL COMMENT 'sha256(hex) 验证码+盐',
  `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_lookup` (`channel`, `target`(64), `consumed_at`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SQL
```

### 修正错误的 `DB_NAME`（应用连错库时）

```bash
sudo nano /var/www/zhiflow/backend/.env
# 修改：DB_NAME=zhiflow_prod  DB_USER=zhiflow  DB_PASSWORD=（与生产一致）

cd /var/www/zhiflow/backend && pm2 restart zhiflow-api --update-env
curl -fsS 'http://127.0.0.1:3002/health?deep=1' | head -c 300; echo
```

然后在 **`zhiflow_prod`** 上执行上一节建表 SQL（若表只在 `wework_saas` 建过，注册仍会失败）。

### 应急：先开放注册（跳过 OTP）

未配置 SMTP/短信前，或需先验证其它流程时，可临时关闭注册验证码（**勿长期用于正式推广**）：

```bash
# 在 .env 中设 REGISTER_OTP_REQUIRED=0
grep REGISTER_OTP /var/www/zhiflow/backend/.env
# 若无该行则追加：echo 'REGISTER_OTP_REQUIRED=0' | sudo tee -a /var/www/zhiflow/backend/.env

cd /var/www/zhiflow/backend && pm2 restart zhiflow-api --update-env
```

表建好后、SMTP/短信就绪后改回 `REGISTER_OTP_REQUIRED=1` 并重启 API。

---

## 复制粘贴：块 A — Mac 打包与上传

```bash
# === 在 Mac 仓库根目录执行（不要用 cd /var/www/zhiflow）===
cd /Users/591464076qq.com/syqw   # 改成你的克隆路径

# 1) 应用包：前端 build + backend/src + install.sh
./scripts/pack-workbench-upload.sh
# 仅重打前端：SKIP_BUILD=1 ./scripts/pack-workbench-upload.sh

# 2) 迁移包：Phase10-12 + 024 + 077 + db-migrate / ecs-apply 脚本
bash deploy/scripts/pack-migrate-upload.sh
# 若还要把 local_*.sql 打进包（本机 dev 用）：INCLUDE_LOCAL=1 bash deploy/scripts/pack-migrate-upload.sh

ls -lh dist-workbench/wework-workbench-*.tar.gz dist-workbench/zhiflow-migrate-*.tar.gz

# 下一步：阿里云 Workbench → 文件 → 上传两个 tar.gz 到 ECS /tmp/
```

### Mac 本地 MySQL（必须在仓库根，不是 backend/）

```bash
cd /Users/591464076qq.com/syqw
# 按 backend/.env 改 -u/-p 和库名（开发多为 wework_saas + syqw_app）
mysql -h127.0.0.1 -u syqw_app -p wework_saas < database/local_inbox_and_customers_no_fk.sql
mysql -h127.0.0.1 -u syqw_app -p wework_saas < database/zhiflow_prod_phase10_12_no_fk.sql
```

---

## 复制粘贴：块 B — ECS 探查 + 发布 + 迁移

```bash
# === 1) 探查（Linux 路径，勿用 /Users/...）===
ls -la /var/www/zhiflow
pm2 list
curl -sS -o /dev/null -w "localhost:3002 health -> %{http_code}\n" http://127.0.0.1:3002/health || true

# === 2) 部署应用包（先上传 wework-workbench-*.tar.gz 到 /tmp）===
cd /tmp
tar xzf "$(ls -t wework-workbench-*.tar.gz | head -1)"
cd "$(ls -dt wework-workbench-* | head -1)"

export BACKEND_DIR=/var/www/zhiflow/backend
export FRONTEND_DIR=/var/www/zhiflow/frontend/dist
export PM2_APP=zhiflow-api
export HEALTH_PORT=3002
sudo -E ./install.sh

# === 3) 迁移包（先上传 zhiflow-migrate-*.tar.gz 到 /tmp）===
cd /tmp
tar xzf "$(ls -t zhiflow-migrate-*.tar.gz | head -1)"
MIG_DIR="$(ls -dt zhiflow-migrate-* | head -1)"

# 方式 A：解压到站点（之后可用 db-migrate.sh）
sudo mkdir -p /var/www/zhiflow
sudo cp -a "$MIG_DIR/database" "$MIG_DIR/deploy" /var/www/zhiflow/

# 方式 B：不拷站点，直接跑 Phase 10–12（推荐先跑这条）
sudo bash "$MIG_DIR/deploy/scripts/ecs-apply-prod-schema.sh"
# 或指定文件：
# sudo APPLY_FILE=024_registration_otp_challenges.sql bash "$MIG_DIR/deploy/scripts/ecs-apply-prod-schema.sh"

# 全量按序迁移（可选，耗时长）：
# cd /var/www/zhiflow && bash deploy/scripts/db-migrate.sh

# === 4) 重启 API + 健康检查 ===
grep -E '^PORT=|^DB_NAME=' /var/www/zhiflow/backend/.env
cd /var/www/zhiflow/backend && pm2 restart zhiflow-api --update-env
pm2 logs zhiflow-api --lines 30 --nostream
curl -fsS http://127.0.0.1:3002/health && echo
curl -fsS 'http://127.0.0.1:3002/health?deep=1' | head -c 400 && echo
grep proxy_pass /etc/nginx/conf.d/wework-https.conf
curl -fsS 'https://wework.syzs.top/health?deep=1' | head -c 400 && echo
```

### ECS 上获取 JWT（curl 调 API）

```bash
API=http://127.0.0.1:3002/api/v1
# tenant_id / 账号以生产库为准（示例 tenant_id=1 admin）
TOKEN=$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"tenant_id":1,"username":"admin","password":"你的生产密码"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).data?.token||''")
echo "token length: ${#TOKEN}"

curl -sS -H "Authorization: Bearer $TOKEN" "$API/auth/me"
```

公网探测（Mac 或 ECS 均可）：`curl -fsS 'https://wework.syzs.top/health?deep=1'`

---

## 相关文档

- [production-launch-runbook-zh.md](./production-launch-runbook-zh.md) — 迁移全表、30 分钟验收、ZhiFlow 环境变量
- [../ops/workbench-upload-manifest.md](../ops/workbench-upload-manifest.md) — 旧栈 wework-saas 路径清单（勿与 zhiflow 混用）
