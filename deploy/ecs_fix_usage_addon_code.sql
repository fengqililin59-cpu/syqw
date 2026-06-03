-- 修复 usage_addon_packages 缺 code 列（计费页 addons 500）
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS usage_addon_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(32) NOT NULL DEFAULT '',
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  duration_months INT UNSIGNED NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @has := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usage_addon_packages' AND COLUMN_NAME = 'code');
SET @q := IF(@has = 0,
  'ALTER TABLE usage_addon_packages ADD COLUMN code VARCHAR(32) NOT NULL DEFAULT '''' AFTER name',
  'SELECT 1');
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE usage_addon_packages SET code = CONCAT('legacy_', id) WHERE code = '' OR code IS NULL;

-- 种子数据：须先有 resource_type 列（见 ecs_fix_usage_addon_resource_type.sql）
SET @has_rt := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usage_addon_packages' AND COLUMN_NAME = 'resource_type');
SET @q_seed := IF(@has_rt > 0,
  "INSERT IGNORE INTO usage_addon_packages (name, code, resource_type, quantity, price, duration_months, sort_order) VALUES
('AI调用包 1000次', 'ai_1k', 'ai_calls', 1000, 59.00, 1, 10),
('AI调用包 5000次', 'ai_5k', 'ai_calls', 5000, 199.00, 1, 20),
('AI调用包 10000次', 'ai_10k', 'ai_calls', 10000, 349.00, 1, 30),
('群发包 2000次', 'broadcast_2k', 'broadcasts', 2000, 49.00, 1, 40),
('群发包 10000次', 'broadcast_10k', 'broadcasts', 10000, 199.00, 1, 50),
('客户扩容包 500人', 'customers_500', 'customers', 500, 29.00, 1, 60)",
  'SELECT 1');
PREPARE stmt_seed FROM @q_seed; EXECUTE stmt_seed; DEALLOCATE PREPARE stmt_seed;

CREATE TABLE IF NOT EXISTS tenant_usage_addons (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  addon_package_id BIGINT UNSIGNED NOT NULL,
  resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  consumed INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  payment_record_id BIGINT UNSIGNED DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
