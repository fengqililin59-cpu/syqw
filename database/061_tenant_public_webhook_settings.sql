-- 公域 Webhook 验签配置（抖音 / 小红书）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `tenant_public_webhook_settings` (
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `douyin_client_key` VARCHAR(64) NULL DEFAULT NULL,
  `douyin_client_secret` VARCHAR(255) NULL DEFAULT NULL,
  `douyin_verify_mode` VARCHAR(24) NOT NULL DEFAULT 'legacy_or_platform' COMMENT 'legacy_or_platform|platform_only|legacy_only',
  `xhs_webhook_token` VARCHAR(255) NULL DEFAULT NULL,
  `xhs_verify_mode` VARCHAR(24) NOT NULL DEFAULT 'legacy_or_platform',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`),
  CONSTRAINT `fk_tpws_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
