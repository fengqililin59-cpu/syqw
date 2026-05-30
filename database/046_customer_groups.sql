SET NAMES utf8mb4;

-- 客户群表
CREATE TABLE IF NOT EXISTS customer_groups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  chat_id VARCHAR(64) NOT NULL,
  name VARCHAR(100) NOT NULL,
  owner_userid VARCHAR(64) NULL,
  owner_user_id BIGINT UNSIGNED NULL,
  member_count INT UNSIGNED NOT NULL DEFAULT 0,
  notice TEXT NULL,
  status TINYINT(1) NOT NULL DEFAULT 1,
  raw_json JSON NULL,
  last_synced_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_group_tenant_chat (tenant_id, chat_id),
  KEY idx_group_tenant (tenant_id),
  KEY idx_group_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 群成员表
CREATE TABLE IF NOT EXISTS group_members (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  external_userid VARCHAR(64) NULL,
  wework_userid VARCHAR(64) NULL,
  member_type TINYINT NOT NULL DEFAULT 1,
  customer_id BIGINT UNSIGNED NULL,
  join_time DATETIME NULL,
  join_scene TINYINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_member_group_external (group_id, external_userid),
  KEY idx_member_tenant (tenant_id),
  KEY idx_member_group (group_id),
  KEY idx_member_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 群 SOP 任务表
CREATE TABLE IF NOT EXISTS group_sop_tasks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT NULL,
  msg_type ENUM('text','image','link','miniprogram') NOT NULL DEFAULT 'text',
  content_json JSON NOT NULL,
  trigger_type ENUM('scheduled','recurring') NOT NULL DEFAULT 'scheduled',
  scheduled_at DATETIME NULL,
  recurring_cron VARCHAR(64) NULL,
  recurring_desc VARCHAR(100) NULL,
  status ENUM('draft','active','paused','done') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sop_tenant (tenant_id),
  KEY idx_sop_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 群 SOP 与群的关联（一个 SOP 可关联多个群）
CREATE TABLE IF NOT EXISTS group_sop_targets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sop_task_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  last_sent_at DATETIME NULL,
  send_count INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_sop_group (sop_task_id, group_id),
  KEY idx_sop_target_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 群发送记录表
CREATE TABLE IF NOT EXISTS group_send_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  group_id BIGINT UNSIGNED NOT NULL,
  sop_task_id BIGINT UNSIGNED NULL,
  msg_type VARCHAR(32) NOT NULL,
  content_json JSON NOT NULL,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  sent_at DATETIME NULL,
  error_msg VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_send_log_tenant (tenant_id),
  KEY idx_send_log_group (group_id),
  KEY idx_send_log_sop (sop_task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 群机器人 webhook 配置（用于群消息发送）
ALTER TABLE customer_groups
  ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500) NULL AFTER notice;
