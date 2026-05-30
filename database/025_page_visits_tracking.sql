SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `page_visits` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `session_id` VARCHAR(64) NOT NULL,
  `utm_source` VARCHAR(100) NULL DEFAULT NULL,
  `utm_medium` VARCHAR(100) NULL DEFAULT NULL,
  `utm_campaign` VARCHAR(100) NULL DEFAULT NULL,
  `utm_content` VARCHAR(100) NULL DEFAULT NULL,
  `utm_term` VARCHAR(100) NULL DEFAULT NULL,
  `referrer` VARCHAR(500) NULL DEFAULT NULL,
  `landing_path` VARCHAR(255) NULL DEFAULT NULL,
  `ip` VARCHAR(45) NULL DEFAULT NULL,
  `user_agent` VARCHAR(512) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `attributed_at` DATETIME NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_page_visit_session` (`session_id`),
  KEY `idx_page_visits_source_time` (`utm_source`, `created_at`),
  KEY `idx_page_visits_tenant_time` (`tenant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
