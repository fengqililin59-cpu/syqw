-- ============================================================
-- 077: 租户自定义字段系统（全行业 SaaS 核心能力）
-- 
-- 设计思路：
--   用 EAV (Entity-Attribute-Value) 模型，让每个租户为自己的客户
--   定义任意行业的任意字段。教培定义「年级/科目」、医美定义「肤质/项目」、
--   B2B定义「公司规模/采购周期」，互不干扰。
--
-- 支持字段类型：
--   text / number / date / select / multi_select / checkbox / textarea
-- ============================================================

-- ── 表 1: 自定义字段定义 ──
CREATE TABLE IF NOT EXISTS tenant_custom_field_defs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  field_key       VARCHAR(64)     NOT NULL COMMENT '字段键，如 "grade" / "skin_type"',
  field_label     VARCHAR(128)    NOT NULL COMMENT '显示名称，如 "年级" / "肤质"',
  field_type      ENUM('text','number','date','select','multi_select','checkbox','textarea')
                                  NOT NULL DEFAULT 'text',
  options         JSON            NULL     COMMENT 'select/multi_select 的可选项 [{label,value}]',
  group_name      VARCHAR(64)     NULL     COMMENT '分组名，如 "教育信息" / "医美档案"',
  is_required     TINYINT(1)      NOT NULL DEFAULT 0,
  display_order   INT             NOT NULL DEFAULT 0,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  placeholder     VARCHAR(255)    NULL,
  help_text       VARCHAR(500)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_tenant_field (tenant_id, field_key),
  INDEX idx_tenant_order (tenant_id, display_order),
  INDEX idx_tenant_group (tenant_id, group_name),
  INDEX idx_tenant_active (tenant_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='租户自定义字段定义表';

-- ── 表 2: 客户自定义字段值 ──
CREATE TABLE IF NOT EXISTS tenant_customer_field_values (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenant_id       BIGINT UNSIGNED NOT NULL,
  customer_id     BIGINT UNSIGNED NOT NULL,
  field_id        BIGINT UNSIGNED NOT NULL,
  value           TEXT            NULL     COMMENT '字段值（文本存储，number 也存为文本）',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_customer_field (customer_id, field_id),
  INDEX idx_tenant_customer (tenant_id, customer_id),
  INDEX idx_field (field_id),
  FOREIGN KEY (field_id) REFERENCES tenant_custom_field_defs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='租户客户自定义字段值表（EAV 模型）';
