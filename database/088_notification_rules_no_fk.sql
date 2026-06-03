-- ===========================================================
-- 088（生产无 FK 版）: 智能通知规则 + 浏览器推送订阅
-- tenant_id 使用 BIGINT UNSIGNED，与 tenants.id 一致；不建外键
-- ===========================================================
-- ECS 单行（在解压迁移包后）:
--   mysql -h127.0.0.1 -uzhiflow -p zhiflow_prod < database/088_notification_rules_no_fk.sql
-- 或仅补 088（phase10 已跑过）:
--   sudo APPLY_FILE=088_notification_rules_no_fk.sql bash deploy/scripts/ecs-apply-prod-schema.sh

SET NAMES utf8mb4;

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
