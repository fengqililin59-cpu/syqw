-- 客户需求探索登记表（JSON，便于 BANT/SPIN 等字段扩展）
ALTER TABLE `customers`
  ADD COLUMN `discovery_profile` JSON NULL COMMENT '需求探索：预算/周期/痛点/产品/决策人等' AFTER `remark`;
