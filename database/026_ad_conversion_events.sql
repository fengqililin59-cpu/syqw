SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `ad_conversion_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `ad_click_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `platform` VARCHAR(32) NOT NULL DEFAULT 'unknown',
  `click_key` VARCHAR(512) NOT NULL,
  `event_type` VARCHAR(64) NOT NULL DEFAULT 'register',
  `event_value` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `report_status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending|reported|failed|skipped',
  `report_response` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conv_tenant_created` (`tenant_id`,`created_at`),
  KEY `idx_conv_click_key` (`click_key`(191)),
  KEY `idx_conv_status` (`report_status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
