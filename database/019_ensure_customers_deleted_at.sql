-- 修复：新建客户 500 / Unknown column 'deleted_at' in 'field list'
-- 原因：Customer 模型启用了软删除 (paranoid)，表上必须有 deleted_at。
-- 若早期建库未执行 006_customers_soft_delete.sql，请执行本文件。

SET NAMES utf8mb4;

ALTER TABLE `customers`
  ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL COMMENT '软删除时间' AFTER `updated_at`;

ALTER TABLE `customers` ADD KEY `idx_customers_deleted` (`tenant_id`, `deleted_at`);

-- 若提示 Duplicate column / Duplicate key，说明已加过，可忽略。
