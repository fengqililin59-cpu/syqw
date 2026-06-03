/**
 * 079 — 可配置仪表盘
 *
 * 每个租户自定义仪表盘 Widget 的显示/隐藏和排序。
 * config JSON 格式：
 * {
 *   "widgets": [
 *     { "key": "kpi_cards", "label": "KPI 卡片", "visible": true, "order": 0 },
 *     ...
 *   ]
 * }
 */
CREATE TABLE IF NOT EXISTS tenant_dashboard_configs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id  BIGINT UNSIGNED NOT NULL,
  config     JSON            NOT NULL COMMENT 'widget 配置数组',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
