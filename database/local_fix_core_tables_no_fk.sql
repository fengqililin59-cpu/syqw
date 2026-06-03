-- 本地救急：syqw_app 无 REFERENCES 权限时补 001 核心表（无外键）
-- 用法: mysql -h127.0.0.1 -u syqw_app -p wework_saas < database/local_fix_core_tables_no_fk.sql

USE wework_saas;

CREATE TABLE IF NOT EXISTS `roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `permissions` JSON NULL,
  `is_system` TINYINT NOT NULL DEFAULT 0,
  `perm_codes` JSON NULL,
  `description` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_roles_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `username` VARCHAR(50) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `real_name` VARCHAR(50) NULL DEFAULT NULL,
  `phone` VARCHAR(20) NULL DEFAULT NULL,
  `email` VARCHAR(100) NULL DEFAULT NULL,
  `avatar_url` VARCHAR(255) NULL DEFAULT NULL,
  `wework_userid` VARCHAR(64) NULL DEFAULT NULL,
  `wework_corp_id` VARCHAR(64) NULL DEFAULT NULL,
  `role_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `demo_mode` TINYINT(1) NOT NULL DEFAULT 1,
  `role` VARCHAR(32) NULL DEFAULT NULL,
  `department` VARCHAR(50) NULL DEFAULT NULL,
  `status` TINYINT NOT NULL DEFAULT 1,
  `last_login_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_tenant_username` (`tenant_id`, `username`),
  KEY `idx_users_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `owner_id` BIGINT UNSIGNED NOT NULL,
  `external_userid` VARCHAR(64) NULL DEFAULT NULL,
  `name` VARCHAR(50) NULL DEFAULT NULL,
  `nickname` VARCHAR(50) NULL DEFAULT NULL,
  `avatar_url` VARCHAR(255) NULL DEFAULT NULL,
  `gender` TINYINT NULL DEFAULT 0,
  `phone` VARCHAR(20) NULL DEFAULT NULL,
  `wechat_id` VARCHAR(50) NULL DEFAULT NULL,
  `company` VARCHAR(100) NULL DEFAULT NULL,
  `position` VARCHAR(50) NULL DEFAULT NULL,
  `source` VARCHAR(50) NULL DEFAULT NULL,
  `stage` VARCHAR(32) NOT NULL DEFAULT 'new',
  `intention_level` TINYINT NULL DEFAULT NULL,
  `remark` TEXT NULL,
  `last_contact_at` DATETIME NULL DEFAULT NULL,
  `added_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_customers_tenant` (`tenant_id`),
  KEY `idx_customers_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 070：wechat_mp_openid（登录/注册必需；幂等，等同 database/070_user_wechat_mp_openid.sql）
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'wechat_mp_openid'
);
SET @ddl := IF(
  @col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `wechat_mp_openid` VARCHAR(64) NULL COMMENT ''公众号 openid（JSAPI 支付）'' AFTER `wework_corp_id`',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
