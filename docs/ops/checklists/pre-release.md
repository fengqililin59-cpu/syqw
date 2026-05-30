# Pre-release Checklist (3-minute)

> 用途：发布前最后 3 分钟快速核对，避免低级失误。  
> 建议在发布窗口开始前由发布人和审核人共同勾选。

## A. 代码与构建

- [ ] 本次发布提交范围已确认（commit/PR）。
- [ ] 前端本地构建通过（`npm run build`）。
- [ ] 后端依赖可安装（`npm ci`）。

## B. 配置与密钥

- [ ] 线上 `.env` 已备份（含时间戳）。
- [ ] 本次新增环境变量已配置（如 `TENCENT_ADS_*`、`REGISTER_OTP_REQUIRED`）。
- [ ] 敏感配置未写入代码仓库（密码、token、密钥）。

## C. 数据库迁移

- [ ] `npm run migrate:status` 可执行。
- [ ] 本次迁移脚本已确认（名称、影响范围、回滚方式）。
- [ ] 迁移期间有回滚预案（应用降级开关已准备）。

## D. 发布命令准备

- [ ] 后端发布命令已准备：
  - `npm ci`
  - `npm run migrate:up`
  - `pm2 restart wework-api --update-env`
- [ ] 前端发布命令已准备：
  - `npm run build`
  - `rsync -avz --delete dist/ root@<ECS_IP>:/var/www/wework/`

## E. 发布后冒烟（必须做）

- [ ] `/health` 正常。
- [ ] `/health?deep=1` 正常（`database=true`）。
- [ ] 登录/注册页面可打开并提交。
- [ ] 渠道分析、广告ROI页面可加载。

## F. 回滚触发阈值确认

- [ ] 连续 2 分钟 `health?deep=1` 异常立即回滚。
- [ ] 登录/注册持续 5xx 立即回滚。
- [ ] 报表接口全量失败立即回滚。
- [ ] 前端白屏/关键资源 404 立即回滚。

## G. 发布签字

- 发布负责人：
- 审核人：
- 开始时间：
- 完成时间：
- 结论：`成功 / 回滚 / 部分成功`
