/**
 * @file 082_add_kpi_targets.sql
 * KPI 目标表：支持按员工/全员设置每日/每周/每月跟进、通话、成交额等目标
 */
CREATE TABLE IF NOT EXISTS `kpi_targets` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `user_id` INT UNSIGNED NULL COMMENT 'NULL=全员默认目标',
  `dimension` VARCHAR(32) NOT NULL COMMENT 'followups|calls|revenue|orders|new_customers',
  `target_value` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `period` VARCHAR(16) NOT NULL DEFAULT 'daily' COMMENT 'daily|weekly|monthly',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tenant_user_dim_period` (`tenant_id`, `user_id`, `dimension`, `period`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='KPI 目标配置';
