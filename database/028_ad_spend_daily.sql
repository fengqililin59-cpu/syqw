SET NAMES utf8mb4;

-- P1：按日投放成本（人工导入或后续 API 拉取），与点击/转化合并算 CPA、ROAS
CREATE TABLE IF NOT EXISTS `ad_spend_daily` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `stat_date` DATE NOT NULL,
  `platform` VARCHAR(32) NOT NULL DEFAULT 'unknown' COMMENT 'gdt / ocean / baidu / unknown',
  `external_campaign_id` VARCHAR(128) NOT NULL DEFAULT '' COMMENT '空字符串表示账户级汇总',
  `campaign_name` VARCHAR(255) NULL DEFAULT NULL,
  `spend_cny` DECIMAL(14,2) NOT NULL DEFAULT 0,
  `impressions` BIGINT UNSIGNED NULL DEFAULT NULL,
  `platform_clicks` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT '媒体侧展示/点击，可与监测点击区分',
  `source` VARCHAR(24) NOT NULL DEFAULT 'manual' COMMENT 'manual | api',
  `meta` JSON NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ad_spend_slice` (`tenant_id`, `stat_date`, `platform`, `external_campaign_id`(64)),
  KEY `idx_ad_spend_tenant_date` (`tenant_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
