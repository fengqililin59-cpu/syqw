SET NAMES utf8mb4;

-- 短信模板库（租户自己管理已审核的阿里云模板）
CREATE TABLE IF NOT EXISTS sms_templates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  aliyun_template_code VARCHAR(50) NOT NULL,
  content_preview TEXT NOT NULL,
  variables JSON NOT NULL DEFAULT (JSON_ARRAY()),
  sign_name VARCHAR(50) NOT NULL,
  status ENUM('active','disabled')
    NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_tpl_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 短信广播任务
CREATE TABLE IF NOT EXISTS sms_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  template_id BIGINT UNSIGNED NOT NULL,
  template_params JSON NOT NULL
    DEFAULT (JSON_OBJECT()),
  filter_json JSON NOT NULL
    DEFAULT (JSON_OBJECT()),
  total_count INT UNSIGNED NOT NULL DEFAULT 0,
  sent_count INT UNSIGNED NOT NULL DEFAULT 0,
  success_count INT UNSIGNED NOT NULL DEFAULT 0,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft','scheduled','sending',
    'done','failed','cancelled')
    NOT NULL DEFAULT 'draft',
  scheduled_at DATETIME NULL,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_task_tenant (tenant_id),
  KEY idx_sms_task_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 短信发送明细
CREATE TABLE IF NOT EXISTS sms_send_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  task_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  phone VARCHAR(20) NOT NULL,
  template_code VARCHAR(50) NOT NULL,
  template_params JSON NULL,
  sign_name VARCHAR(50) NOT NULL,
  aliyun_biz_id VARCHAR(100) NULL,
  status ENUM('pending','success','failed')
    NOT NULL DEFAULT 'pending',
  error_msg VARCHAR(500) NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sms_log_tenant (tenant_id),
  KEY idx_sms_log_task (task_id),
  KEY idx_sms_log_customer (customer_id),
  KEY idx_sms_log_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- tenants 表补充阿里云短信配置
-- 兼容低版本 MySQL：使用信息架构检查，避免 ADD COLUMN IF NOT EXISTS 语法问题
SET @exists_col := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'tenants'
    AND column_name = 'sms_access_key_id'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN sms_access_key_id VARCHAR(128) NULL AFTER tccc_server_number',
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
    AND column_name = 'sms_access_key_secret'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN sms_access_key_secret VARCHAR(128) NULL AFTER sms_access_key_id',
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
    AND column_name = 'sms_default_sign'
);
SET @ddl := IF(
  @exists_col = 0,
  'ALTER TABLE tenants ADD COLUMN sms_default_sign VARCHAR(50) NULL AFTER sms_access_key_secret',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
