-- ============================================================
-- 078: 租户可配置销售管道（全行业 SaaS 核心能力）
--
-- 设计思路：
--   不同行业的销售流程完全不同，不能硬编码6个阶段。
--   房产中介需要「客户登记→带看→意向→议价→签约→过户」，
--   教培需要「咨询→试听→方案→缴费→开课」，
--   每个租户通过 JSON 配置自己的管道阶段。
--
-- 阶段分类（category）：
--   open  — 进行中（在管道内流转）
--   won   — 已成交（收口阶段）
--   lost  — 已流失（收口阶段）
-- ============================================================

CREATE TABLE IF NOT EXISTS tenant_pipeline_configs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  stages          JSON            NOT NULL COMMENT '管道阶段数组 [{key,label,color,category,order}]',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_tenant (tenant_id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='租户销售管道配置表';

-- 默认6阶段管道（作为默认值在应用层提供，无需种子数据）
-- key:  new / intent_confirm / proposal / negotiation / deal / lost
-- category: open/open/open/open/won/lost
