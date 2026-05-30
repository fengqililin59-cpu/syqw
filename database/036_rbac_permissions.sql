SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- Step 1 — RBAC 扩展（幂等，适配已有库）
--
-- 说明：
-- - 本仓库 Phase1 已存在 `roles`（含 permissions JSON）与 `users.role_id`，
--   因此不再执行 CREATE TABLE roles / 重复添加 role_id。
-- - 新增系统级权限字典表 `permissions`、角色标记 `is_system`、列 `perm_codes`
--   （与既有 `permissions` JSON 双写兼容；本脚本会尽量从旧列回填）。
-- - `users.role` 为过渡用字符串（admin/sales 等），便于与旧逻辑对齐。
-- ---------------------------------------------------------------------------

-- 权限点字典（系统级，不属于任何租户）
CREATE TABLE IF NOT EXISTS `permissions` (
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `module` VARCHAR(32) NOT NULL,
  `sort_order` SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 预置权限点（与业务路由 requirePerm 对齐；含扩展项供后续接入）
INSERT IGNORE INTO `permissions` (`code`, `name`, `module`, `sort_order`) VALUES
('customer:view',       '查看客户',       'customer',    10),
('customer:edit',       '编辑客户',       'customer',    20),
('customer:delete',     '删除客户',       'customer',    30),
('customer:export',     '导出客户',       'customer',    40),
('customer:import',     '导入客户',       'customer',    50),
('broadcast:view',      '查看群发',       'broadcast',   10),
('broadcast:send',      '创建/发送群发',  'broadcast',   20),
('campaign:view',       '查看裂变活动',   'campaign',    10),
('campaign:manage',     '管理裂变活动',   'campaign',    20),
('automation:view',     '查看自动化',     'automation',  10),
('automation:manage',   '管理自动化',     'automation',  20),
('ai:use',              '使用 AI 功能',   'ai',          10),
('channel:view',        '查看渠道追踪',   'channel',     10),
('channel:manage',      '管理渠道活码',   'channel',     20),
('dashboard:view',      '查看数据仪表盘', 'dashboard',  10),
('ads:view',            '查看广告 ROI',   'ads',         10),
('settings:manage',     '系统设置',       'settings',    10),
('audit:view',          '查看审计日志',   'settings',    20),
('user:manage',         '管理员工账号',   'settings',    30);

-- roles / users：按需 ADD COLUMN（MySQL 部分版本不支持 ADD COLUMN IF NOT EXISTS，故用 information_schema 判断）
SET @db := DATABASE();

SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'is_system';
SET @sql := IF(@c = 0,
  'ALTER TABLE `roles` ADD COLUMN `is_system` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''1=系统预设角色'' AFTER `name`',
  'SELECT 1');
PREPARE _stmt FROM @sql;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;

SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'perm_codes';
SET @sql := IF(@c = 0,
  'ALTER TABLE `roles` ADD COLUMN `perm_codes` JSON NULL COMMENT ''权限码数组（与 permissions 列对齐过渡）'' AFTER `is_system`',
  'SELECT 1');
PREPARE _stmt FROM @sql;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;

-- 从既有 JSON 列回填 perm_codes（仅当新列为空）
UPDATE `roles`
SET `perm_codes` = COALESCE(`permissions`, JSON_ARRAY())
WHERE `perm_codes` IS NULL
  AND `permissions` IS NOT NULL;

UPDATE `roles`
SET `perm_codes` = JSON_ARRAY()
WHERE `perm_codes` IS NULL;

SELECT COUNT(*) INTO @c FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role';
SET @sql := IF(@c = 0,
  'ALTER TABLE `users` ADD COLUMN `role` VARCHAR(32) NULL DEFAULT NULL COMMENT ''过渡：admin/sales 等，稳定后可删'' AFTER `role_id`',
  'SELECT 1');
PREPARE _stmt FROM @sql;
EXECUTE _stmt;
DEALLOCATE PREPARE _stmt;
