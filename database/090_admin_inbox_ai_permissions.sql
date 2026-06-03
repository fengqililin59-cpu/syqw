-- 为存量「管理员」系统角色补齐收件箱与 AI 审核权限（幂等）
-- 依赖：database/055_inbox_permissions.sql（permissions 字典）
-- 用法：mysql -u syqw_app -p syqw < database/090_admin_inbox_ai_permissions.sql

SET NAMES utf8mb4;

INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('inbox:view',   '查看统一收件箱', 'inbox', 10),
('inbox:reply',  '回复收件箱消息', 'inbox', 20),
('inbox:manage', '管理收件箱与知识库', 'inbox', 30),
('ai:approve',   '审核 AI 回复',     'ai',    20);

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'inbox:view')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'inbox:view') IS NULL;

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'inbox:reply')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'inbox:reply') IS NULL;

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'inbox:manage')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'inbox:manage') IS NULL;

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY_APPEND(`perm_codes`, '$', 'ai:approve')
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND JSON_SEARCH(`perm_codes`, 'one', 'ai:approve') IS NULL;

-- 同步 legacy permissions 列（若存在且 ORM 仍读取）
UPDATE `roles`
SET `permissions` = `perm_codes`
WHERE `name` IN ('管理员', 'admin')
  AND `is_system` = 1
  AND `permissions` IS NOT NULL;
