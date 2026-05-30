SET NAMES utf8mb4;

-- 迁移活动表
CREATE TABLE IF NOT EXISTS migration_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  channel_live_code_id BIGINT UNSIGNED NULL,
  welcome_msg TEXT NULL,
  script_template TEXT NULL,
  target_count INT UNSIGNED NOT NULL DEFAULT 0,
  migrated_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('draft','active','ended') NOT NULL DEFAULT 'draft',
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_migration_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 迁移客户记录表
CREATE TABLE IF NOT EXISTS migration_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  campaign_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NULL,
  wx_nickname VARCHAR(50) NULL,
  wx_phone VARCHAR(20) NULL,
  wx_remark VARCHAR(100) NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending','contacted','migrated','lost')
    NOT NULL DEFAULT 'pending',
  contacted_at DATETIME NULL,
  migrated_at DATETIME NULL,
  external_userid VARCHAR(64) NULL,
  note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_migration_record_campaign (campaign_id),
  KEY idx_migration_record_tenant (tenant_id),
  KEY idx_migration_record_owner (owner_id),
  KEY idx_migration_record_external (external_userid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
