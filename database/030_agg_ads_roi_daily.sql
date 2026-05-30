SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `agg_ads_roi_daily` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `stat_date` DATE NOT NULL,
  `platform` VARCHAR(32) NOT NULL DEFAULT 'unknown',
  `clicks` INT UNSIGNED NOT NULL DEFAULT 0,
  `conversions` INT UNSIGNED NOT NULL DEFAULT 0,
  `reported` INT UNSIGNED NOT NULL DEFAULT 0,
  `conversion_value` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_agg_ads_roi` (`tenant_id`, `stat_date`, `platform`),
  KEY `idx_agg_ads_roi_tenant_date` (`tenant_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
