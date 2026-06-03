-- 083: 创建合同管理表
CREATE TABLE IF NOT EXISTS `contracts` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tenant_id` INT UNSIGNED NOT NULL,
  `customer_id` INT UNSIGNED NULL COMMENT '关联客户',
  `owner_id` INT UNSIGNED NULL COMMENT '负责人(员工)',
  `title` VARCHAR(200) NOT NULL COMMENT '合同标题',
  `contract_no` VARCHAR(100) NULL UNIQUE COMMENT '合同编号',
  `type` ENUM('sales','service','nda','other') NOT NULL DEFAULT 'sales' COMMENT '合同类型',
  `status` ENUM('draft','pending','signed','active','expired','terminated') NOT NULL DEFAULT 'draft' COMMENT '状态',
  `amount` DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '合同金额',
  `currency` VARCHAR(10) NOT NULL DEFAULT 'CNY',
  `start_date` DATE NULL,
  `end_date` DATE NULL,
  `signed_at` DATETIME NULL COMMENT '签署日期',
  `party_a` VARCHAR(200) NULL COMMENT '甲方(我方)',
  `party_b` VARCHAR(200) NULL COMMENT '乙方(客户方)',
  `content` TEXT NULL COMMENT '合同条款',
  `attachment_url` VARCHAR(500) NULL COMMENT '附件URL',
  `reminder_days` INT NOT NULL DEFAULT 7 COMMENT '到期提醒天数',
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_tenant` (`tenant_id`),
  INDEX `idx_customer` (`customer_id`),
  INDEX `idx_owner` (`owner_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_type` (`type`),
  INDEX `idx_end_date` (`end_date`),
  INDEX `idx_created` (`created_at`),
  FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合同管理';

-- 合同审批流程关联表
CREATE TABLE IF NOT EXISTS `contract_approval` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `contract_id` INT UNSIGNED NOT NULL,
  `approval_instance_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_contract` (`contract_id`),
  INDEX `idx_instance` (`approval_instance_id`),
  FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`approval_instance_id`) REFERENCES `approval_instances`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='合同审批关联';
