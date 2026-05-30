SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `agg_channel_daily` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `stat_date` DATE NOT NULL,
  `source_key` VARCHAR(100) NOT NULL COMMENT 'utm_source 或 (direct)',
  `visit_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `session_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `user_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_agg_channel` (`tenant_id`, `stat_date`, `source_key`(64)),
  KEY `idx_agg_channel_tenant_date` (`tenant_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
