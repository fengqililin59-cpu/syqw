-- 成交订单 + 售后/服务工单（AI 员工闭环）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `customer_orders` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_no` VARCHAR(64) NULL DEFAULT NULL COMMENT '外部订单号',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `currency` VARCHAR(8) NOT NULL DEFAULT 'CNY',
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending/paid/shipped/completed/cancelled/refunded',
  `paid_at` DATETIME NULL DEFAULT NULL,
  `remark` VARCHAR(500) NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_co_tenant_customer` (`tenant_id`, `customer_id`),
  KEY `idx_co_status` (`tenant_id`, `status`),
  CONSTRAINT `fk_co_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_co_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_tickets` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `customer_id` BIGINT UNSIGNED NOT NULL,
  `order_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `thread_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '来源收件箱会话',
  `type` VARCHAR(32) NOT NULL DEFAULT 'consultation' COMMENT 'consultation/refund/complaint/warranty/exchange',
  `priority` VARCHAR(16) NOT NULL DEFAULT 'normal' COMMENT 'low/normal/high/urgent',
  `status` VARCHAR(24) NOT NULL DEFAULT 'open' COMMENT 'open/in_progress/waiting_customer/resolved/closed',
  `title` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `resolution` TEXT NULL,
  `owner_id` BIGINT UNSIGNED NULL DEFAULT NULL,
  `resolved_at` DATETIME NULL DEFAULT NULL,
  `created_by` BIGINT UNSIGNED NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_st_tenant_status` (`tenant_id`, `status`, `priority`),
  KEY `idx_st_customer` (`tenant_id`, `customer_id`),
  KEY `idx_st_owner` (`tenant_id`, `owner_id`),
  CONSTRAINT `fk_st_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_st_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_st_order` FOREIGN KEY (`order_id`) REFERENCES `customer_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_st_thread` FOREIGN KEY (`thread_id`) REFERENCES `inbox_threads` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_st_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
