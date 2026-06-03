-- 本地库结构补齐（幂等，无 FK，syqw_app 可执行）
-- 修复：dashboard intent_score、Sequelize 模型与旧表不一致
--
-- 用法（项目根）:
--   mysql -h127.0.0.1 -u syqw_app -p wework_saas < database/local_schema_gaps_no_fk.sql

SET NAMES utf8mb4;

-- customers.intent_score（015/020 未跑时 dashboard/weekly-wins 会 500）
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'intent_score'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `intent_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''综合意向分 0-100''',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'intent_tier'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `intent_tier` VARCHAR(20) NULL DEFAULT NULL COMMENT ''高意向/中意向/低意向'' AFTER `intent_score`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND COLUMN_NAME = 'deleted_at'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE `customers` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- kpi_targets（员工活动 KPI 面板）
CREATE TABLE IF NOT EXISTS `kpi_targets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'NULL=租户默认目标',
  `dimension` VARCHAR(32) NOT NULL COMMENT 'followup|call|order|revenue|customer|reply',
  `period` VARCHAR(16) NOT NULL DEFAULT 'daily' COMMENT 'daily|weekly|monthly',
  `target_value` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kpi_tenant_user` (`tenant_id`, `user_id`),
  KEY `idx_kpi_dimension` (`tenant_id`, `dimension`, `period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- operation_audit_logs.user_agent（035 与现表 operation_audit_logs 不一致时补齐）
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'operation_audit_logs'
    AND COLUMN_NAME = 'user_agent'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE `operation_audit_logs` ADD COLUMN `user_agent` VARCHAR(512) NULL DEFAULT NULL AFTER `ip`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

