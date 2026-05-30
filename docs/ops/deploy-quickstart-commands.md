# 部署速查（Mac 打包 → ECS 安装）

> 常见报错 `no such file or directory`：**当前目录不对**。脚本必须在对应路径下执行。

---

## 一、Mac 本地（先进入项目目录）

```bash
cd /Users/591464076qq.com/syqw
chmod +x scripts/pack-workbench-upload.sh
./scripts/pack-workbench-upload.sh
```

成功后输出类似：

```text
压缩包: .../dist-workbench/wework-workbench-20260530-130000.tar.gz
```

用 **阿里云 Workbench** 把该 `.tar.gz` 上传到服务器 **`/tmp/`**。

---

## 二、ECS 服务器（Workbench 终端）

### 1. 解压并进入包目录

```bash
cd /tmp
ls wework-workbench-*.tar.gz
tar xzf wework-workbench-*.tar.gz
cd wework-workbench-*
pwd
# 应看到 .../wework-workbench-xxxx，且目录内有 install.sh、backend/、database/
```

### 2. 执行数据库迁移（059–061，未执行过时）

先看库名与账号（通常在现有 `.env`）：

```bash
grep -E '^DB_' /var/www/wework-saas/backend/.env
```

执行迁移（把 `-p` 后的密码、库名换成你的）：

```bash
MYSQL="mysql -h127.0.0.1 -u你的用户 -p你的密码 wework_saas"

$MYSQL < database/059_tenant_lead_settings.sql
$MYSQL < database/060_ticket_sla.sql
$MYSQL < database/061_tenant_public_webhook_settings.sql
```

若 058 从未执行过：

```bash
$MYSQL < database/058_customer_discovery_profile.sql
```

### 3. 安装代码并重启

**必须在解压后的包目录内**执行：

```bash
cd /tmp/wework-workbench-*
sudo ./install.sh
```

### 4. 检查 / 更新 .env

```bash
nano /var/www/wework-saas/backend/.env
```

参考仓库内模板：`docs/ops/production-env.example.env`  
**至少确认** `PORT=3010`，以及 Cron 相关项。

```bash
pm2 restart wework-api --update-env
pm2 logs wework-api --lines 30 --nostream
```

### 5. 健康检查

```bash
curl -s http://127.0.0.1:3010/health
curl -s 'http://127.0.0.1:3010/health?deep=1'
```

### 6. 验收脚本（在解压包目录内，不是 root 家目录）

```bash
cd /tmp/wework-workbench-*
chmod +x post-deploy-acceptance.sh

# 无需登录
PHASE=public ./post-deploy-acceptance.sh

# 完整验收（换成真实管理员密码）
TENANT_ID=1 USERNAME=admin PASSWORD='你的密码' ./post-deploy-acceptance.sh
```

---

## 三、你刚才的命令错在哪

| 你输入的 | 问题 |
|---------|------|
| `~ % ./scripts/pack-workbench-upload.sh` | Mac 在家目录 `~`，项目在 `syqw` 子目录 |
| `059–061 + install.sh` | 不是 shell 命令，应分别 `mysql < ...` 再 `./install.sh` |
| `pm2 restart` | 缺少进程名，应为 `pm2 restart wework-api --update-env` |
| `~# ./post-deploy-acceptance.sh` | 脚本在 **解压后的包目录**，不在 `/root` |

---

## 四、生产路径约定

| 项 | 路径 |
|----|------|
| 后端 | `/var/www/wework-saas/backend` |
| 前端静态 | `/var/www/wework/` |
| PM2 进程名 | `wework-api` |
| 端口 | **3010** |
