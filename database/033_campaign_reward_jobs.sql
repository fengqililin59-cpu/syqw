SET NAMES utf8mb4;

-- 裂变奖励任务队列（支持延迟发放、重试、里程碑多次达标）
CREATE TABLE IF NOT EXISTS `campaign_reward_jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `campaign_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL COMMENT '奖励接收方（邀请人）',
  `enrollment_id` BIGINT UNSIGNED NOT NULL,
  `milestone_index` INT UNSIGNED NOT NULL COMMENT '第几次达标（1 开始）',
  `reward_type` VARCHAR(32) NOT NULL,
  `reward_payload` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending|processing|done|failed|cancelled',
  `attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts` INT UNSIGNED NOT NULL DEFAULT 5,
  `scheduled_at` DATETIME NULL DEFAULT NULL,
  `locked_at` DATETIME NULL DEFAULT NULL,
  `locked_by` VARCHAR(64) NULL DEFAULT NULL,
  `last_error` TEXT NULL,
  `sent_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_campaign_reward` (`tenant_id`, `campaign_id`, `customer_id`, `milestone_index`),
  KEY `idx_campaign_reward_status_schedule` (`status`, `scheduled_at`, `id`),
  KEY `idx_campaign_reward_campaign` (`campaign_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `campaign_enrollments`
  ADD COLUMN IF NOT EXISTS `achieved_milestone_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `invited_count`;
