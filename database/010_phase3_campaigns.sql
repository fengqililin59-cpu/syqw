-- Phase 3：裂变活动（任务宝）+ 参与记录 + 邀请明细
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'task_treasure' COMMENT 'task_treasure / group_share / red_packet',
  `target_count` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '目标邀请人数',
  `reward_type` VARCHAR(32) NOT NULL COMMENT 'points / coupon / redpacket / exchange_code',
  `reward_value` TEXT NOT NULL COMMENT 'JSON 或文本：奖品说明与配置',
  `start_time` DATETIME NOT NULL,
  `end_time` DATETIME NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'draft' COMMENT 'draft / active / paused / ended',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_tenant` (`tenant_id`,`status`),
  KEY `idx_campaigns_time` (`tenant_id`,`start_time`,`end_time`),
  CONSTRAINT `fk_campaigns_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `campaign_enrollments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `invite_code` VARCHAR(32) NOT NULL,
  `invited_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `is_achieved` TINYINT(1) NOT NULL DEFAULT 0,
  `reward_sent_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_enroll_code` (`invite_code`),
  UNIQUE KEY `uk_campaign_customer` (`campaign_id`,`customer_id`),
  KEY `idx_enroll_campaign` (`campaign_id`),
  KEY `idx_enroll_customer` (`customer_id`),
  CONSTRAINT `fk_enroll_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_enroll_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invite_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campaign_id` BIGINT UNSIGNED NOT NULL,
  `inviter_id` BIGINT UNSIGNED NOT NULL,
  `invitee_id` BIGINT UNSIGNED NOT NULL,
  `invitee_external_userid` VARCHAR(64) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_invite_pair` (`campaign_id`,`invitee_id`),
  KEY `idx_inv_campaign` (`campaign_id`),
  KEY `idx_inv_inviter` (`inviter_id`),
  CONSTRAINT `fk_inv_campaign` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_inviter` FOREIGN KEY (`inviter_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_invitee` FOREIGN KEY (`invitee_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
