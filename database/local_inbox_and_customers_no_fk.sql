-- 本地：收件箱 + 客户模型列 + 管道/通知/任务（幂等，无 FK，syqw_app 可执行）
--
-- 用法（项目根）:
--   mysql -h127.0.0.1 -u syqw_app -p wework_saas < database/local_inbox_and_customers_no_fk.sql

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- customers：Sequelize Customer 模型列（旧库缺列会导致 /customers、/pipeline 500）
-- ---------------------------------------------------------------------------
SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'intent_score') = 0,
    'ALTER TABLE `customers` ADD COLUMN `intent_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'intent_tier') = 0,
    'ALTER TABLE `customers` ADD COLUMN `intent_tier` VARCHAR(20) NULL DEFAULT NULL AFTER `intent_score`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'deleted_at') = 0,
    'ALTER TABLE `customers` ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'discovery_profile') = 0,
    'ALTER TABLE `customers` ADD COLUMN `discovery_profile` JSON NULL COMMENT ''需求探索'' AFTER `remark`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'automation_paused') = 0,
    'ALTER TABLE `customers` ADD COLUMN `automation_paused` TINYINT(1) NOT NULL DEFAULT 0 AFTER `added_at`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'automation_followup_count') = 0,
    'ALTER TABLE `customers` ADD COLUMN `automation_followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `automation_paused`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'last_automation_followup_at') = 0,
    'ALTER TABLE `customers` ADD COLUMN `last_automation_followup_at` DATETIME NULL DEFAULT NULL AFTER `automation_followup_count`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'intent_stage_label') = 0,
    'ALTER TABLE `customers` ADD COLUMN `intent_stage_label` VARCHAR(40) NULL DEFAULT NULL AFTER `intent_tier`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'intent_confidence') = 0,
    'ALTER TABLE `customers` ADD COLUMN `intent_confidence` VARCHAR(10) NULL DEFAULT NULL AFTER `intent_stage_label`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'intent_rule_score') = 0,
    'ALTER TABLE `customers` ADD COLUMN `intent_rule_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `intent_confidence`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'intent_ai_score') = 0,
    'ALTER TABLE `customers` ADD COLUMN `intent_ai_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `intent_rule_score`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'last_scored_at') = 0,
    'ALTER TABLE `customers` ADD COLUMN `last_scored_at` DATETIME NULL DEFAULT NULL AFTER `intent_ai_score`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'followup_count') = 0,
    'ALTER TABLE `customers` ADD COLUMN `followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `last_scored_at`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'last_followup_at') = 0,
    'ALTER TABLE `customers` ADD COLUMN `last_followup_at` DATETIME NULL DEFAULT NULL AFTER `followup_count`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'priority') = 0,
    'ALTER TABLE `customers` ADD COLUMN `priority` VARCHAR(20) NULL DEFAULT NULL AFTER `last_followup_at`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'opt_out_auto_msg') = 0,
    'ALTER TABLE `customers` ADD COLUMN `opt_out_auto_msg` TINYINT(1) NOT NULL DEFAULT 0 AFTER `priority`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 收件箱（054，无外键）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `omni_channels` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(32) NOT NULL COMMENT 'wework / douyin / xiaohongshu / wechat_mp',
  `name` VARCHAR(64) NOT NULL,
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用',
  `config_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_omni_tenant_code` (`tenant_id`, `code`),
  KEY `idx_omni_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inbox_threads` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `channel_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `external_thread_key` VARCHAR(128) NOT NULL COMMENT '渠道侧会话唯一键',
  `assignee_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `sales_stage` VARCHAR(32) NOT NULL DEFAULT 'new',
  `status` VARCHAR(24) NOT NULL DEFAULT 'open' COMMENT 'open/pending_human/closed',
  `lead_score` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `last_message_at` DATETIME NULL DEFAULT NULL,
  `last_customer_message_at` DATETIME NULL DEFAULT NULL,
  `metadata_json` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inbox_thread` (`tenant_id`, `channel_id`, `external_thread_key`),
  KEY `idx_inbox_thread_tenant_time` (`tenant_id`, `last_message_at`),
  KEY `idx_inbox_thread_assignee` (`tenant_id`, `assignee_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inbox_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `channel_message_id` VARCHAR(96) NOT NULL,
  `direction` VARCHAR(16) NOT NULL COMMENT 'customer/staff/ai/system',
  `sender_role` VARCHAR(16) NOT NULL DEFAULT 'customer',
  `content` TEXT NULL,
  `msg_type` VARCHAR(32) NOT NULL DEFAULT 'text',
  `risk_level` VARCHAR(8) NOT NULL DEFAULT 'p0',
  `raw_payload` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_inbox_msg` (`tenant_id`, `channel_message_id`),
  KEY `idx_inbox_msg_thread` (`thread_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ai_reply_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `trigger_message_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `intent` VARCHAR(64) NULL DEFAULT NULL,
  `confidence` DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  `risk_level` VARCHAR(8) NOT NULL DEFAULT 'p1',
  `draft_content` TEXT NOT NULL,
  `final_content` TEXT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft',
  `model` VARCHAR(64) NULL DEFAULT NULL,
  `approved_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `qa_status` VARCHAR(16) NULL DEFAULT NULL,
  `qa_reviewed_at` DATETIME NULL DEFAULT NULL,
  `qa_reviewed_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `qa_note` VARCHAR(500) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_reply_tenant_status` (`tenant_id`, `status`, `created_at`),
  KEY `idx_ai_reply_thread` (`thread_id`, `created_at`),
  KEY `idx_ai_reply_qa` (`tenant_id`, `qa_status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 管道 / 通知 / 任务
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_pipeline_configs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `stages` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `recipient_user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM(
    'lead_assigned',
    'followup_reminder',
    'stage_changed',
    'customer_transferred',
    'deal_won',
    'deal_lost',
    'comment_added',
    'task_assigned',
    'system_notice',
    'ai_alert'
  ) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT NULL,
  `related_type` VARCHAR(32) NULL DEFAULT NULL,
  `related_id` VARCHAR(64) NULL DEFAULT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `read_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notif_tenant_user_read` (`tenant_id`, `recipient_user_id`, `is_read`),
  KEY `idx_notif_user_created` (`recipient_user_id`, `created_at`),
  KEY `idx_notif_related` (`related_type`, `related_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `assignee_id` INT UNSIGNED NULL DEFAULT NULL,
  `creator_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NULL DEFAULT NULL,
  `contract_id` INT UNSIGNED NULL DEFAULT NULL,
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `priority` ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `status` ENUM('todo','in_progress','done','cancelled') NOT NULL DEFAULT 'todo',
  `due_date` DATETIME NULL DEFAULT NULL,
  `completed_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tasks_tenant` (`tenant_id`),
  KEY `idx_tasks_assignee` (`assignee_id`),
  KEY `idx_tasks_status` (`status`),
  KEY `idx_tasks_due` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 收件箱跟进任务 + 售后工单（054/056，无外键）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inbox_followup_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `thread_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `title` VARCHAR(200) NOT NULL,
  `due_at` DATETIME NULL DEFAULT NULL,
  `owner_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'open' COMMENT 'open/done/cancelled',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_followup_owner_due` (`tenant_id`, `owner_id`, `due_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_no` VARCHAR(64) NULL DEFAULT NULL,
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'CNY',
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending',
  `paid_at` DATETIME NULL DEFAULT NULL,
  `remark` VARCHAR(500) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_co_tenant_customer` (`tenant_id`, `customer_id`),
  KEY `idx_co_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `thread_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'consultation',
  `priority` VARCHAR(16) NOT NULL DEFAULT 'normal',
  `status` VARCHAR(24) NOT NULL DEFAULT 'open',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `resolution` TEXT NULL,
  `owner_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `due_at` DATETIME NULL DEFAULT NULL,
  `first_response_at` DATETIME NULL DEFAULT NULL,
  `sla_escalated_at` DATETIME NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_st_tenant_status` (`tenant_id`, `status`, `priority`),
  KEY `idx_st_customer` (`tenant_id`, `customer_id`),
  KEY `idx_st_owner` (`tenant_id`, `owner_id`),
  KEY `idx_st_due` (`tenant_id`, `status`, `due_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 营销退订（marketingCampaign 看板 COUNT；表名 marketing_optouts，勿用 marketing_opt_outs）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketing_optouts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `customer_id` BIGINT NULL,
  `contact_value` VARCHAR(500) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_contact` (`tenant_id`, `contact_value`(100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
