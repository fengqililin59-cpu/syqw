-- 清理无对应租户的 subscriptions 行（会导致注册事务回滚并误报「账号已存在」）
-- 用法: mysql ... wework_saas < database/local_cleanup_orphan_subscriptions.sql

DELETE s FROM subscriptions s
LEFT JOIN tenants t ON t.id = s.tenant_id
WHERE t.id IS NULL;
