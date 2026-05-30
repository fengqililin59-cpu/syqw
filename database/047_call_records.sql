SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS call_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  caller_user_id BIGINT UNSIGNED NOT NULL,
  call_type ENUM('outbound','inbound','ai_bot')
    NOT NULL DEFAULT 'outbound',
  dial_mode ENUM('phone','webrtc')
    NOT NULL DEFAULT 'phone',
  status ENUM('initiating','calling','connected',
    'completed','failed','cancelled')
    NOT NULL DEFAULT 'initiating',
  customer_phone VARCHAR(20) NOT NULL,
  caller_phone VARCHAR(20) NULL,
  duration_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  recording_url VARCHAR(500) NULL,
  transcript_text TEXT NULL,
  failure_reason VARCHAR(200) NULL,
  tccc_session_id VARCHAR(100) NULL,
  started_at DATETIME NULL,
  connected_at DATETIME NULL,
  ended_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_call_tenant (tenant_id),
  KEY idx_call_customer (customer_id),
  KEY idx_call_user (caller_user_id),
  KEY idx_call_status (status),
  KEY idx_call_created (tenant_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户外呼配置表（每个用户可选手机或网页）
CREATE TABLE IF NOT EXISTS user_call_settings (
  user_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  dial_mode ENUM('phone','webrtc')
    NOT NULL DEFAULT 'phone',
  phone_number VARCHAR(20) NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  KEY idx_call_settings_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- tenants 表补充 TCCC 配置字段（兼容低版本 MySQL，不使用 ADD COLUMN IF NOT EXISTS）
SET @exists_col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tenants'
    AND column_name = 'tccc_sdk_app_id'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN tccc_sdk_app_id VARCHAR(64) NULL AFTER wework_agent_id',
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
    AND column_name = 'tccc_secret_id'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN tccc_secret_id VARCHAR(128) NULL AFTER tccc_sdk_app_id',
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
    AND column_name = 'tccc_secret_key'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN tccc_secret_key VARCHAR(128) NULL AFTER tccc_secret_id',
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
    AND column_name = 'tccc_server_number'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN tccc_server_number VARCHAR(20) NULL AFTER tccc_secret_key',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
