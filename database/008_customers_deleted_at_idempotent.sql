-- 若已执行过 006_customers_soft_delete.sql，请勿重复执行（会报 Duplicate column）。
-- 适用于尚未执行 006 且 MySQL 8.0.29+（支持 ADD COLUMN IF NOT EXISTS）的环境。

SET NAMES utf8mb4;

ALTER TABLE `customers`
  ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL DEFAULT NULL COMMENT '软删除时间' AFTER `updated_at`;

-- 若索引已存在会失败，可忽略；或先检查 information_schema.STATISTICS
-- ALTER TABLE `customers` ADD KEY `idx_customers_deleted` (`tenant_id`, `deleted_at`);
