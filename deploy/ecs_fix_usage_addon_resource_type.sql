-- 生产库 usage_addon_packages 可能是 addon_type 而非 resource_type（093 脚本未跑全）
SET NAMES utf8mb4;

SET @has_rt := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usage_addon_packages' AND COLUMN_NAME = 'resource_type');
SET @has_at := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usage_addon_packages' AND COLUMN_NAME = 'addon_type');

SET @q := IF(@has_rt = 0 AND @has_at > 0,
  "ALTER TABLE usage_addon_packages CHANGE COLUMN addon_type resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL",
  IF(@has_rt = 0,
    "ALTER TABLE usage_addon_packages ADD COLUMN resource_type ENUM('customers','seats','broadcasts','ai_calls') NOT NULL DEFAULT 'ai_calls' AFTER code",
    'SELECT 1'));
PREPARE stmt FROM @q; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 仅当表为空或缺少种子数据时再插入（避免 resource_type 列不存在时失败）
SET @cnt := (SELECT COUNT(*) FROM usage_addon_packages);
SET @q2 := IF(@cnt = 0,
  "INSERT INTO usage_addon_packages (name, code, resource_type, quantity, price, duration_months, sort_order) VALUES
('AI调用包 1000次', 'ai_1k', 'ai_calls', 1000, 59.00, 1, 10),
('AI调用包 5000次', 'ai_5k', 'ai_calls', 5000, 199.00, 1, 20),
('AI调用包 10000次', 'ai_10k', 'ai_calls', 10000, 349.00, 1, 30),
('群发包 2000次', 'broadcast_2k', 'broadcasts', 2000, 49.00, 1, 40),
('群发包 10000次', 'broadcast_10k', 'broadcasts', 10000, 199.00, 1, 50),
('客户扩容包 500人', 'customers_500', 'customers', 500, 29.00, 1, 60)",
  'SELECT 1');
PREPARE stmt2 FROM @q2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
