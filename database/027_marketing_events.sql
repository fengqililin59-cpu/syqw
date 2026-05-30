SET NAMES utf8mb4;

-- P1：统一营销事件（与落地页 session、广告 click 关联，支撑漏斗与投放决策）
CREATE TABLE IF NOT EXISTS `marketing_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `session_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '与 page_visits.session_id 对齐',
  `ad_hit` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'ad_click_records.id',
  `event_key` VARCHAR(64) NOT NULL COMMENT '如 registration_complete、ad_conversion',
  `properties` JSON NULL,
  `source` VARCHAR(16) NOT NULL DEFAULT 'web' COMMENT 'web | server | import',
  `ip` VARCHAR(45) NULL DEFAULT NULL,
  `user_agent` VARCHAR(512) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_mkt_ev_tenant_created` (`tenant_id`, `created_at`),
  KEY `idx_mkt_ev_key_created` (`event_key`, `created_at`),
  KEY `idx_mkt_ev_session` (`session_id`),
  KEY `idx_mkt_ev_ad_hit` (`ad_hit`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
