-- Sequelize AuditLog 使用 operation_audit_logs；012 建表时无 user_agent，此处补齐
SET NAMES utf8mb4;

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
