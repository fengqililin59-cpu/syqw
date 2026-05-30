-- 租户线索分配策略（留资 / 活码加好友）
CREATE TABLE IF NOT EXISTS `tenant_lead_settings` (
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `assign_mode` VARCHAR(32) NOT NULL DEFAULT 'round_robin' COMMENT 'first_user|round_robin|channel_map',
  `channel_owner_map` JSON NULL COMMENT '渠道键(utm_source等)-> owner user_id',
  `default_owner_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `round_robin_last_user_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `notify_wework` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '新线索企微提醒负责人',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`),
  CONSTRAINT `fk_tls_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
