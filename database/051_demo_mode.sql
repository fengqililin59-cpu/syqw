SET NAMES utf8mb4;

-- tenants 表新增演示模式字段（兼容低版本 MySQL）
SET @exists_col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tenants'
    AND column_name = 'is_demo'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER sms_default_sign',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists_col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tenants'
    AND column_name = 'demo_expires_at'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN demo_expires_at DATETIME NULL AFTER is_demo',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- users 表新增用户当前是否处于演示模式（默认开启）
SET @exists_col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'demo_mode'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE users ADD COLUMN demo_mode TINYINT(1) NOT NULL DEFAULT 1 AFTER role_id',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
