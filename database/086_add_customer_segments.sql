-- ============================================================
-- 086: 客户细分/智能标签系统
-- customer_segments: 动态分组定义（JSON规则引擎）
-- customer_segment_members: 分组-客户多对多关联
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_segments (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id   INT           NOT NULL,
  name        VARCHAR(100)  NOT NULL COMMENT '分组名称，如"高意向未成交"',
  description VARCHAR(500)  COMMENT '分组说明',
  rules       JSON          NOT NULL COMMENT '筛选规则数组 [{field, operator, value}, ...]',
  match_type  ENUM('all','any') DEFAULT 'all' COMMENT 'all=AND满足全部, any=OR满足任一',
  color_tag   VARCHAR(20)   COMMENT '颜色标签 hex',
  icon        VARCHAR(50)   COMMENT '图标标识',
  is_auto_refresh TINYINT(1) DEFAULT 0 COMMENT '是否自动刷新成员',
  member_count    INT        DEFAULT 0 COMMENT '成员数量缓存',
  last_refreshed_at DATETIME COMMENT '最近刷新时间',
  created_by  INT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS customer_segment_members (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  segment_id  INT NOT NULL,
  customer_id INT NOT NULL,
  tenant_id   INT NOT NULL,
  added_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (segment_id) REFERENCES customer_segments(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  UNIQUE KEY uk_segment_customer (segment_id, customer_id),
  INDEX idx_segment (segment_id),
  INDEX idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
