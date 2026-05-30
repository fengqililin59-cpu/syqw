-- 自动跟进：执行日志 + 客户侧开关/冷却（与 012 automation_rules 配合）
-- 执行：mysql ... < database/014_automation_logs_and_customer_flags.sql
-- 已存在库需单独跑本文件；新环境请同步更新 database/docker-init.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `automation_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `rule_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `trigger_type` VARCHAR(32) NULL DEFAULT NULL,
  `action_taken` VARCHAR(32) NOT NULL COMMENT 'ai_notify_owner / ai_log / skipped / fail',
  `status` VARCHAR(20) NOT NULL COMMENT 'success / fail / skipped',
  `message_preview` VARCHAR(500) NULL DEFAULT NULL,
  `detail_json` JSON NULL,
  `executed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_al_tenant_time` (`tenant_id`, `executed_at`),
  KEY `idx_al_customer_rule` (`tenant_id`, `customer_id`, `rule_id`),
  CONSTRAINT `fk_al_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_al_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_al_rule` FOREIGN KEY (`rule_id`) REFERENCES `automation_rules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='自动化执行日志';

ALTER TABLE `customers`
  ADD COLUMN `automation_paused` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=暂停自动跟进（人工接管）' AFTER `added_at`,
  ADD COLUMN `automation_followup_count` SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '系统触发跟进次数' AFTER `automation_paused`,
  ADD COLUMN `last_automation_followup_at` DATETIME NULL DEFAULT NULL COMMENT '上次自动跟进时间（冷却）' AFTER `automation_followup_count`;
