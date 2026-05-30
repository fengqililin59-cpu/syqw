# Rollback Quick Checklist

> 用途：故障触发后 5 分钟内快速执行回滚。  
> 原则：先恢复服务，再做根因分析。

## 1. 触发条件确认

- [ ] `/health?deep=1` 连续失败 > 2 分钟
- [ ] 登录/注册持续 5xx
- [ ] 核心报表接口全量失败
- [ ] 前端白屏或关键资源 404

## 2. 后端快速回滚

- [ ] 切回上一个稳定代码版本
- [ ] 恢复 `.env` 备份（如本次修改过配置）
- [ ] 执行：

```bash
cd /var/www/wework-saas/backend
npm ci
pm2 restart wework-api --update-env
```

- [ ] 验证：

```bash
curl -sS http://127.0.0.1:3000/health
curl -sS "http://127.0.0.1:3000/health?deep=1"
```

## 3. 前端快速回滚

- [ ] 若使用版本软链，切回上一版：

```bash
ln -sfn /var/www/releases/wework-<last_good> /var/www/wework
sudo nginx -t && sudo nginx -s reload
```

- [ ] 若未使用软链，重新同步上一个 `dist` 备份包

## 4. 降级开关（可选）

- [ ] `REGISTER_OTP_REQUIRED=0`
- [ ] `TENCENT_ADS_ENABLED=0`
- [ ] 重启服务：`pm2 restart wework-api --update-env`

## 5. 回滚完成确认

- [ ] 健康检查恢复
- [ ] 登录/注册恢复
- [ ] 报表页面恢复
- [ ] 发布群同步“已回滚 + 当前状态 + 下一步”

## 6. 事件留痕

- 回滚开始时间：
- 回滚完成时间：
- 回滚执行人：
- 触发原因：
- 影响时长：
