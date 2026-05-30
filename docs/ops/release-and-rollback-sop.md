# Release & Rollback SOP（wework-saas）

> 适用范围：`/var/www/wework-saas/backend` + `/var/www/wework`（Nginx 静态站点）
> 目标：发布可重复、可回滚、可审计。

## 0. 角色与窗口

- 发布负责人：`<姓名>`
- 审核人：`<姓名>`
- 发布时间窗：`<YYYY-MM-DD HH:mm ~ HH:mm>`
- 风险级别：`低 / 中 / 高`
- 回滚阈值生效时长：发布后 5 分钟

## 1. 发布前检查（必须全部通过）

### 1.1 代码与依赖

- [ ] 主分支已合并目标提交
- [ ] 本地 `frontend` 构建通过：`npm run build`
- [ ] 后端依赖安装无报错：`npm ci`

### 1.2 配置与密钥

- [ ] `.env` 已备份：`cp .env .env.bak-<timestamp>`
- [ ] 关键变量确认：
  - [ ] `DB_*`
  - [ ] `JWT_SECRET`
  - [ ] `REGISTER_OTP_REQUIRED`
  - [ ] `TENCENT_ADS_ENABLED`
  - [ ] `TENCENT_ADS_ACCESS_TOKEN / ACCOUNT_ID`（如启用）

### 1.3 数据库

- [ ] `schema_migrations` 表存在
- [ ] `npm run migrate:status` 可执行
- [ ] 已确认本次迁移列表（名称 + 风险）

## 2. 标准发布流程

### 2.1 后端发布（ECS）

```bash
cd /var/www/wework-saas/backend
npm ci
npm run migrate:status
npm run migrate:up
pm2 restart wework-api --update-env
```

健康检查：

```bash
curl -sS http://127.0.0.1:3010/health
curl -sS "http://127.0.0.1:3010/health?deep=1"
```

通过标准：

- 返回 `ok: true`
- `deep=1` 时 `database: true`

### 2.2 前端发布（本地 Mac）

```bash
cd /Users/xxx/syqw/frontend
npm run build
rsync -avz --delete /Users/xxx/syqw/frontend/dist/ root@<ECS_IP>:/var/www/wework/
```

> 推荐升级为“版本目录 + 软链”方式，支持秒级回滚。

### 2.3 Nginx 检查（如有配置改动）

```bash
sudo nginx -t && sudo nginx -s reload
```

## 3. 发布后冒烟（5 分钟内）

### 3.1 基础可用性

- [ ] `GET /health` 正常
- [ ] `GET /health?deep=1` 正常（database=true）

### 3.2 核心页面

- [ ] 登录页
- [ ] 注册页
- [ ] 渠道分析页
- [ ] 广告ROI页

### 3.3 核心接口

- [ ] `/api/v1/track/report`
- [ ] `/api/v1/ads/roi`
- [ ] `/api/v1/ads/roi/trend`
- [ ] `/api/v1/ads/roi/details`

### 3.4 导出能力

- [ ] 渠道汇总 CSV
- [ ] 渠道详情 CSV
- [ ] ROI 汇总/趋势/明细 CSV

## 4. 回滚触发条件（任一满足立即回滚）

- [ ] `/health?deep=1` 连续失败 > 2 分钟
- [ ] 登录/注册出现持续 5xx
- [ ] 报表接口全量异常
- [ ] 前端关键页面白屏 / 资源 404

## 5. 回滚流程

### 5.1 后端回滚

1) 切回上一个稳定代码版本  
2) 恢复 `.env`（如需）  
3) 重启服务：

```bash
cd /var/www/wework-saas/backend
npm ci
pm2 restart wework-api --update-env
```

验证：

```bash
curl -sS http://127.0.0.1:3010/health
curl -sS "http://127.0.0.1:3010/health?deep=1"
```

### 5.2 前端回滚

若使用“版本目录 + 软链”：

```bash
ln -sfn /var/www/releases/wework-<last_good> /var/www/wework
sudo nginx -t && sudo nginx -s reload
```

若未使用版本目录：重新 `rsync` 上一版 `dist` 备份包到 `/var/www/wework/`。

### 5.3 数据库回滚（谨慎）

原则：优先“应用回滚 + 功能开关降级”，避免直接删表。  
仅在确认数据可丢失时执行 destructive SQL。

## 6. 紧急降级开关（无代码回滚）

- 关闭注册验证码：`REGISTER_OTP_REQUIRED=0`
- 关闭腾讯广告回传：`TENCENT_ADS_ENABLED=0`

执行后：

```bash
pm2 restart wework-api --update-env
```

## 7. 发布记录（每次必填）

- 发布时间：
- 发布人：
- 提交范围（commit/PR）：
- 执行命令：
- 冒烟结果：
- 是否回滚：
- 问题与复盘：
