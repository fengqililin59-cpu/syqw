-- 客户软删除：列表默认不展示已删除记录（Sequelize paranoid）
SET NAMES utf8mb4;

ALTER TABLE `customers`
  ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL COMMENT '软删除时间' AFTER `updated_at`,
  ADD KEY `idx_customers_deleted` (`tenant_id`, `deleted_at`);
