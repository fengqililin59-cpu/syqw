-- Phase 2：广告点击监测入库（归因骨架）；转化回传与各平台 API 在业务代码中对接

CREATE TABLE IF NOT EXISTS `ad_click_records` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '可选：来自投放链接参数',
  `platform` VARCHAR(32) NOT NULL DEFAULT 'unknown' COMMENT 'gdt / ocean / baidu / unknown',
  `click_key` VARCHAR(512) NOT NULL COMMENT '归一化点击标识，便于与转化关联',
  `status` VARCHAR(24) NOT NULL DEFAULT 'pending' COMMENT 'pending | attributed | converted | reported',
  `raw_query` JSON NULL COMMENT '监测链接完整查询参数快照',
  `redirect_host` VARCHAR(255) NULL COMMENT '302 目标 hostname（审计）',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ad_click_tenant_created` (`tenant_id`,`created_at`),
  KEY `idx_ad_click_platform_key` (`platform`,`click_key`(191)),
  KEY `idx_ad_click_status` (`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
