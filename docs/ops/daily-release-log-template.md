# Daily Release Log Template

> 用途：每日发布记录 + 问题复盘  
> 建议命名：`docs/ops/daily-log-YYYYMMDD.md`

## 1. 基本信息

- 日期：`YYYY-MM-DD`
- 发布窗口：`HH:mm ~ HH:mm`
- 发布负责人：
- 审核人：
- 环境：`prod / stage`
- 风险等级：`低 / 中 / 高`

## 2. 今日变更摘要

### 2.1 功能变更

- [ ] 功能 A：
- [ ] 功能 B：
- [ ] 功能 C：

### 2.2 修复变更

- [ ] Bug A：
- [ ] Bug B：

### 2.3 非功能变更

- [ ] 配置调整：
- [ ] 监控/日志：
- [ ] 文档更新：

## 3. 代码与发布对象

- 后端提交范围：
  - `commit/PR:`
- 前端提交范围：
  - `commit/PR:`
- 数据库迁移：
  - [ ] 无
  - [ ] 有（列出 migration 名称）
    - `2026xxxx_xxx.sql`
    - `...`

## 4. 执行步骤记录（命令留痕）

### 4.1 后端

```bash
cd /var/www/wework-saas/backend
npm ci
npm run migrate:status
npm run migrate:up
pm2 restart wework-api --update-env
```

执行结果：

- [ ] 成功
- [ ] 失败（原因）：

### 4.2 前端

```bash
cd /Users/xxx/syqw/frontend
npm run build
rsync -avz --delete dist/ root@<ECS_IP>:/var/www/wework/
```

执行结果：

- [ ] 成功
- [ ] 失败（原因）：

### 4.3 Nginx（如有）

```bash
sudo nginx -t && sudo nginx -s reload
```

执行结果：

- [ ] 成功
- [ ] 失败（原因）：

## 5. 冒烟验证清单

### 5.1 健康检查

- [ ] `GET /health` 正常
- [ ] `GET /health?deep=1` 正常（database=true）

### 5.2 核心页面

- [ ] 登录页
- [ ] 注册页
- [ ] 渠道分析页
- [ ] 广告ROI页

### 5.3 核心接口

- [ ] `/api/v1/track/report`
- [ ] `/api/v1/ads/roi`
- [ ] `/api/v1/ads/roi/trend`
- [ ] `/api/v1/ads/roi/details`

### 5.4 导出能力

- [ ] 渠道汇总 CSV
- [ ] 渠道详情 CSV
- [ ] ROI 汇总/趋势/明细 CSV

## 6. 异常与处理

### 异常 1

- 现象：
- 影响范围：
- 根因判断：
- 处理动作：
- 处理结果：

### 异常 2

- 现象：
- 影响范围：
- 根因判断：
- 处理动作：
- 处理结果：

## 7. 回滚记录（如发生）

- 是否触发回滚：`是 / 否`
- 触发时间：
- 触发条件：
- 回滚命令：
- 回滚后验证结果：

## 8. 关键指标（发布后 30 分钟）

- 5xx 错误率：
- 平均响应时间：
- 登录成功率：
- 注册成功率：
- 广告回传成功率：
- AI 生成成功率：

## 9. 结论与后续动作

- 今日发布结论：`成功 / 部分成功 / 失败`
- 遗留问题：
  1.
  2.
- 明日优先任务：
  1.
  2.

## 10. 签字（可选）

- 发布负责人：
- 审核人：
- 产品确认：
