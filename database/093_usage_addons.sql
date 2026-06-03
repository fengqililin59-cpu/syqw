-- 093: 用量加购包系统
-- 允许用户购买额外用量包（超出套餐配额时使用）

CREATE TABLE IF NOT EXISTS usage_addon_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL COMMENT '加购包名称',
  code VARCHAR(32) NOT NULL UNIQUE COMMENT '唯一编码',
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL COMMENT '资源类型',
  quantity INT UNSIGNED NOT NULL COMMENT '加购数量',
  price DECIMAL(10,2) NOT NULL COMMENT '价格',
  duration_months INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '有效期（月）',
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tenant_usage_addons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  addon_package_id BIGINT UNSIGNED NOT NULL,
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL COMMENT '资源类型',
  quantity INT UNSIGNED NOT NULL COMMENT '加购数量',
  consumed INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '已使用',
  expires_at DATE NOT NULL COMMENT '过期时间',
  is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否有效',
  payment_record_id BIGINT UNSIGNED DEFAULT NULL COMMENT '关联支付记录',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id),
  KEY idx_expires (expires_at),
  KEY idx_active (tenant_id, resource_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预置加购包
INSERT IGNORE INTO usage_addon_packages (name, code, resource_type, quantity, price, duration_months, sort_order) VALUES
('AI调用包 1000次', 'ai_1k', 'ai_calls', 1000, 59.00, 1, 10),
('AI调用包 5000次', 'ai_5k', 'ai_calls', 5000, 199.00, 1, 20),
('AI调用包 10000次', 'ai_10k', 'ai_calls', 10000, 349.00, 1, 30),
('群发包 2000次', 'broadcast_2k', 'broadcasts', 2000, 49.00, 1, 40),
('群发包 10000次', 'broadcast_10k', 'broadcasts', 10000, 199.00, 1, 50),
('客户扩容包 500人', 'customers_500', 'customers', 500, 29.00, 1, 60),
('客户扩容包 2000人', 'customers_2k', 'customers', 2000, 99.00, 1, 70),
('席位包 5人', 'seats_5', 'seats', 5, 39.00, 1, 80),
('席位包 10人', 'seats_10', 'seats', 10, 69.00, 1, 90);
