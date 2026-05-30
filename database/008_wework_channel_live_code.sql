-- 渠道活码 Phase1：分组、活码配置、客户添加记录（与企微 state 关联）
-- 执行前请确认已存在 tenants 表

CREATE TABLE IF NOT EXISTS `wework_channel_groups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(64) NOT NULL,
  `sort` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wcg_tenant` (`tenant_id`),
  CONSTRAINT `fk_wcg_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wework_channels` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `group_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `name` VARCHAR(128) NOT NULL,
  `type` VARCHAR(32) NOT NULL DEFAULT 'employee' COMMENT 'employee | group_chat',
  `state` VARCHAR(128) NULL DEFAULT NULL COMMENT '企微联系我 state，渠道追踪',
  `wework_config_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '联系我 config_id',
  `config` JSON NULL COMMENT '企微返回 qr_code 等',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wc_tenant` (`tenant_id`),
  KEY `idx_wc_group` (`group_id`),
  KEY `idx_wc_state` (`tenant_id`,`state`(64)),
  CONSTRAINT `fk_wc_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wc_group` FOREIGN KEY (`group_id`) REFERENCES `wework_channel_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wework_customer_add_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `channel_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `external_userid` VARCHAR(64) NULL DEFAULT NULL COMMENT '外部联系人 userid',
  `follow_userid` VARCHAR(64) NULL DEFAULT NULL COMMENT '跟进成员 userid',
  `state` VARCHAR(128) NULL DEFAULT NULL,
  `raw_payload` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wcar_tenant` (`tenant_id`),
  KEY `idx_wcar_channel` (`channel_id`),
  KEY `idx_wcar_created` (`tenant_id`,`created_at`),
  CONSTRAINT `fk_wcar_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wcar_channel` FOREIGN KEY (`channel_id`) REFERENCES `wework_channels` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
