SET NAMES utf8mb4;

-- P2：通用后台任务队列（单实例 PM2 友好；多实例需后续换 Redis 锁）
CREATE TABLE IF NOT EXISTS `background_jobs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `job_type` VARCHAR(64) NOT NULL COMMENT 'rollup_ads_roi | rollup_channel | ...',
  `payload` JSON NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending|processing|done|failed|cancelled',
  `attempts` INT UNSIGNED NOT NULL DEFAULT 0,
  `max_attempts` INT UNSIGNED NOT NULL DEFAULT 5,
  `run_after` DATETIME NULL DEFAULT NULL,
  `locked_at` DATETIME NULL DEFAULT NULL,
  `locked_by` VARCHAR(64) NULL DEFAULT NULL,
  `last_error` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bg_jobs_status_run` (`status`, `run_after`, `id`),
  KEY `idx_bg_jobs_type_created` (`job_type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
