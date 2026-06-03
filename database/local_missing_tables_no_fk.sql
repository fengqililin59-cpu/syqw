-- 本地缺表补丁（幂等，无 FK，syqw_app 可执行）
-- 适用：customers / users / tenants 已存在，但 tags / customer_tags / customer_follow_ups 未建导致 500
--
-- 用法（项目根目录，按 backend/.env 中 DB_NAME / DB_USER 调整）：
--   mysql -h 127.0.0.1 -u syqw_app -p wework_saas < database/local_missing_tables_no_fk.sql
--
-- 说明：外键已省略，避免 syqw_app 无 REFERENCES 权限；生产请走完整 migration 链。
-- 与 database/local_dev_missing_tables.sql 内容相同，便于 QA 文档引用。

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(50) NOT NULL,
  `color` VARCHAR(20) NULL DEFAULT NULL,
  `category` VARCHAR(50) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tags_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_tags` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `tag_id` BIGINT UNSIGNED NOT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_customer_tag` (`customer_id`, `tag_id`),
  KEY `idx_customer_tags_tag` (`tag_id`),
  KEY `idx_customer_tags_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_follow_ups` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('call','wechat','meeting','other') NOT NULL DEFAULT 'other',
  `content` TEXT NOT NULL,
  `next_follow_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fu_customer` (`customer_id`),
  KEY `idx_fu_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
