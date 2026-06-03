-- ZhiFlow Phase 10–12 表/列补齐（幂等，无外键，syqw_app/zhiflow 可执行）
--
-- 生产（ECS，任选其一）:
--   mysql -h127.0.0.1 -uzhiflow -p zhiflow_prod < database/zhiflow_prod_phase10_12_no_fk.sql
--   sudo bash /tmp/zhiflow-migrate-*/deploy/scripts/ecs-apply-prod-schema.sh
-- 仅补 088 通知规则（phase10 已跑、088 原版 FK 失败时）:
--   mysql -h127.0.0.1 -uzhiflow -p zhiflow_prod < database/088_notification_rules_no_fk.sql
-- 本地（必须在仓库根目录，不是 backend/）:
--   mysql -h127.0.0.1 -u syqw_app -p wework_saas < database/zhiflow_prod_phase10_12_no_fk.sql

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- operation_audit_logs.user_agent（Sequelize AuditLog 模型需要）
-- ---------------------------------------------------------------------------
SET @add_col := (
  SELECT IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'operation_audit_logs' AND COLUMN_NAME = 'user_agent') = 0,
    'ALTER TABLE `operation_audit_logs` ADD COLUMN `user_agent` VARCHAR(512) NULL DEFAULT NULL AFTER `ip`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @add_col; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 077 自定义字段
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_custom_field_defs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `field_key` VARCHAR(64) NOT NULL COMMENT '字段键',
  `field_label` VARCHAR(128) NOT NULL COMMENT '显示名称',
  `field_type` ENUM('text','number','date','select','multi_select','checkbox','textarea') NOT NULL DEFAULT 'text',
  `options` JSON NULL,
  `group_name` VARCHAR(64) NULL,
  `is_required` TINYINT(1) NOT NULL DEFAULT 0,
  `display_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `placeholder` VARCHAR(255) NULL,
  `help_text` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_field` (`tenant_id`, `field_key`),
  KEY `idx_tenant_order` (`tenant_id`, `display_order`),
  KEY `idx_tenant_group` (`tenant_id`, `group_name`),
  KEY `idx_tenant_active` (`tenant_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tenant_customer_field_values` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `field_id` BIGINT UNSIGNED NOT NULL,
  `value` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_customer_field` (`customer_id`, `field_id`),
  KEY `idx_tenant_customer` (`tenant_id`, `customer_id`),
  KEY `idx_field` (`field_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 078 销售管道（若 local_inbox 已建则跳过）
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

-- ---------------------------------------------------------------------------
-- 079 仪表盘 Widget 配置
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_dashboard_configs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `config` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 085 营销：活动 / 模板 / 发送记录 / 退订
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `marketing_campaigns` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `type` ENUM('email','sms','wechat') NOT NULL DEFAULT 'email',
  `status` ENUM('draft','scheduled','sending','sent','cancelled') NOT NULL DEFAULT 'draft',
  `subject` VARCHAR(300) NULL,
  `content` TEXT NULL,
  `template_id` BIGINT NULL,
  `target_filter` JSON NULL,
  `target_count` INT DEFAULT 0,
  `sent_count` INT DEFAULT 0,
  `open_count` INT DEFAULT 0,
  `click_count` INT DEFAULT 0,
  `reply_count` INT DEFAULT 0,
  `bounce_count` INT DEFAULT 0,
  `scheduled_at` DATETIME NULL,
  `sent_at` DATETIME NULL,
  `created_by` BIGINT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mc_tenant` (`tenant_id`),
  KEY `idx_mc_status` (`status`),
  KEY `idx_mc_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `message_templates` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `type` ENUM('email','sms','wechat') NOT NULL DEFAULT 'email',
  `subject` VARCHAR(300) NULL,
  `content` TEXT NOT NULL,
  `variables` JSON NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_by` BIGINT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mt_tenant` (`tenant_id`),
  KEY `idx_mt_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `marketing_messages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT NOT NULL,
  `campaign_id` BIGINT NOT NULL,
  `customer_id` BIGINT NULL,
  `contact_value` VARCHAR(500) NOT NULL,
  `subject` VARCHAR(300) NULL,
  `content` TEXT NULL,
  `status` ENUM('pending','sent','failed','opened','clicked','bounced') DEFAULT 'pending',
  `error_message` TEXT NULL,
  `sent_at` DATETIME NULL,
  `opened_at` DATETIME NULL,
  `clicked_at` DATETIME NULL,
  `track_open_id` VARCHAR(64) NULL,
  `track_click_id` VARCHAR(64) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mm_tenant` (`tenant_id`),
  KEY `idx_mm_campaign` (`campaign_id`),
  KEY `idx_mm_customer` (`customer_id`),
  KEY `idx_mm_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- ---------------------------------------------------------------------------
-- 087 知识库
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `kb_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `slug` VARCHAR(100) NULL,
  `description` VARCHAR(500) NULL,
  `icon` VARCHAR(50) NULL,
  `sort_order` INT DEFAULT 0,
  `is_published` TINYINT(1) DEFAULT 0,
  `created_by` INT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kb_cat_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `kb_articles` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tenant_id` INT NOT NULL,
  `category_id` INT NULL,
  `title` VARCHAR(200) NOT NULL,
  `slug` VARCHAR(200) NULL,
  `summary` VARCHAR(500) NULL,
  `content` TEXT NULL,
  `content_type` ENUM('markdown','html','text') DEFAULT 'markdown',
  `tags` JSON NULL,
  `author_id` INT NULL,
  `status` ENUM('draft','published','archived') DEFAULT 'draft',
  `is_featured` TINYINT(1) DEFAULT 0,
  `is_ai_generated` TINYINT(1) DEFAULT 0,
  `view_count` INT DEFAULT 0,
  `helpful_yes` INT DEFAULT 0,
  `helpful_no` INT DEFAULT 0,
  `sort_order` INT DEFAULT 0,
  `published_at` DATETIME NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kb_art_tenant` (`tenant_id`),
  KEY `idx_kb_art_category` (`category_id`),
  KEY `idx_kb_art_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 站内通知中心（approval / notification_rules 依赖）
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 审批工作流（/api/v1/approvals）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `approval_templates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) NULL DEFAULT NULL,
  `steps` JSON NOT NULL COMMENT '审批步骤 [{order, approver_id?, approver_role?, step_name}]',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_at_tenant` (`tenant_id`),
  KEY `idx_at_tenant_active` (`tenant_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approval_instances` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `template_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `applicant_user_id` BIGINT UNSIGNED NOT NULL,
  `related_type` VARCHAR(32) NULL DEFAULT NULL COMMENT 'customer/deal/order/refund',
  `related_id` VARCHAR(64) NULL DEFAULT NULL,
  `status` ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `current_step` INT NOT NULL DEFAULT 0 COMMENT '当前步骤序号(从0开始)',
  `steps_snapshot` JSON NOT NULL COMMENT '冻结的步骤快照',
  `submitted_at` DATETIME NULL DEFAULT NULL,
  `completed_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_tenant_status` (`tenant_id`, `status`),
  KEY `idx_ai_tenant_applicant` (`tenant_id`, `applicant_user_id`),
  KEY `idx_ai_template` (`template_id`),
  KEY `idx_ai_related` (`related_type`, `related_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 088 智能通知规则（无 FK，tenant_id BIGINT UNSIGNED）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notification_rules` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT '规则名称',
  `description` VARCHAR(500) NULL COMMENT '规则描述',
  `enabled` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  `trigger_type` VARCHAR(32) NOT NULL COMMENT '触发类型: schedule|event|cron',
  `trigger_config` JSON NOT NULL COMMENT '触发条件配置',
  `channels` JSON NOT NULL COMMENT '通知渠道: in_app|wecom|browser',
  `recipient_type` VARCHAR(32) NOT NULL DEFAULT 'specific' COMMENT 'specific|role|owner|all',
  `recipient_config` JSON NULL COMMENT '接收人配置',
  `template` JSON NOT NULL COMMENT '通知模板',
  `priority` ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `cooldown_minutes` INT NOT NULL DEFAULT 60 COMMENT '冷却时间（分钟）',
  `max_per_run` INT NOT NULL DEFAULT 50 COMMENT '单次评估最大触发数',
  `last_triggered_at` DATETIME NULL DEFAULT NULL,
  `trigger_count` INT NOT NULL DEFAULT 0 COMMENT '累计触发次数',
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_nr_tenant` (`tenant_id`),
  KEY `idx_nr_enabled` (`enabled`),
  KEY `idx_nr_trigger` (`trigger_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notification_rule_logs` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `rule_id` INT UNSIGNED NOT NULL,
  `triggered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `recipients_count` INT NOT NULL DEFAULT 0 COMMENT '实际接收人数',
  `channels_used` JSON NULL COMMENT '实际使用的渠道',
  `status` ENUM('success','partial','failed') NOT NULL DEFAULT 'success',
  `error_message` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_nrl_rule` (`rule_id`),
  KEY `idx_nrl_tenant_triggered` (`tenant_id`, `triggered_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `browser_push_subscriptions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `endpoint` TEXT NOT NULL COMMENT 'Push 订阅 endpoint URL',
  `p256dh` TEXT NOT NULL COMMENT '加密公钥 p256dh',
  `auth` TEXT NOT NULL COMMENT '加密认证密钥 auth',
  `user_agent` VARCHAR(500) NULL DEFAULT NULL,
  `device_name` VARCHAR(100) NULL DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `last_used_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_bps_user_endpoint` (`user_id`, `endpoint`(255)),
  KEY `idx_bps_user` (`user_id`),
  KEY `idx_bps_active` (`is_active`),
  KEY `idx_bps_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
