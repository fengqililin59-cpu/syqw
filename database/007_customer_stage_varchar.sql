-- 销售阶段扩展为 6 档（VARCHAR），并迁移旧 ENUM 取值
-- 需在 006 之后执行；若库仍为 ENUM，本脚本会替换为 VARCHAR

SET NAMES utf8mb4;

ALTER TABLE `customers` MODIFY COLUMN `stage` VARCHAR(32) NOT NULL DEFAULT 'new' COMMENT '销售阶段';

UPDATE `customers` SET `stage` = 'intent_confirm' WHERE `stage` = 'contacted';
UPDATE `customers` SET `stage` = 'proposal' WHERE `stage` = 'intent';
-- new / deal / lost 保持不变；deal=成交
