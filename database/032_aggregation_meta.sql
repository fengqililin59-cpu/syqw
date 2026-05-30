SET NAMES utf8mb4;

-- 各租户各数据集「已预聚合到的截止日期」（读路径用此判断是否可走 agg）
CREATE TABLE IF NOT EXISTS `aggregation_meta` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` BIGINT UNSIGNED NOT NULL,
  `dataset` VARCHAR(64) NOT NULL COMMENT 'ads_roi_daily | channel_daily',
  `through_date` DATE NOT NULL COMMENT '含该日及之前的区间可读 agg',
  `earliest_date` DATE NULL DEFAULT NULL COMMENT 'agg 中最早一日（可选）',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_agg_meta` (`tenant_id`, `dataset`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
