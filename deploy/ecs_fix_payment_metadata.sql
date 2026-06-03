-- payment_records 095 列（metadata / purchase_type / auto_invoice）
SET NAMES utf8mb4;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'purchase_type');
SET @q := IF(@has = 0,
  "ALTER TABLE payment_records ADD COLUMN purchase_type ENUM('subscription','balance_recharge','addon_purchase') NOT NULL DEFAULT 'subscription' AFTER pay_channel",
  'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'metadata');
SET @q := IF(@has = 0,
  'ALTER TABLE payment_records ADD COLUMN metadata JSON NULL AFTER remark',
  'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'auto_invoice');
SET @q := IF(@has = 0,
  'ALTER TABLE payment_records ADD COLUMN auto_invoice TINYINT(1) NOT NULL DEFAULT 0 AFTER metadata',
  'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE payment_records MODIFY COLUMN plan_id BIGINT UNSIGNED NULL;

-- 修正 ENUM，避免 Data truncated for column 'purchase_type'
ALTER TABLE payment_records
  MODIFY COLUMN purchase_type ENUM('subscription','balance_recharge','addon_purchase')
  NOT NULL DEFAULT 'subscription';
