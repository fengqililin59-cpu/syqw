-- ============================================================================
-- ECS 计费修复脚本：补列、建表、初始化数据、去重
-- 幂等执行
-- ============================================================================
SET NAMES utf8mb4;

-- ============================================================================
-- 1. subscriptions 表补全 auto_renew 相关列
-- ============================================================================
-- 1a. auto_renew 列（可能已由092存储过程添加，以防万一再检查）
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew');
SET @sql_ar = IF(@col_exists = 0,
  'ALTER TABLE subscriptions ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否自动续费''',
  'SELECT ''auto_renew already exists'' AS msg');
PREPARE stmt FROM @sql_ar;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1b. auto_renew_plan_id 列
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew_plan_id');
SET @sql_arp = IF(@col_exists = 0,
  'ALTER TABLE subscriptions ADD COLUMN auto_renew_plan_id BIGINT UNSIGNED NULL COMMENT ''自动续费目标套餐'' AFTER auto_renew',
  'SELECT ''auto_renew_plan_id already exists'' AS msg');
PREPARE stmt FROM @sql_arp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1c. auto_renew_cycle 列
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew_cycle');
SET @sql_arc = IF(@col_exists = 0,
  'ALTER TABLE subscriptions ADD COLUMN auto_renew_cycle ENUM(''monthly'',''yearly'') NULL COMMENT ''自动续费周期'' AFTER auto_renew_plan_id',
  'SELECT ''auto_renew_cycle already exists'' AS msg');
PREPARE stmt FROM @sql_arc;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '✅ subscriptions 列补全完成' AS status;

-- ============================================================================
-- 2. products 表（产品/服务目录）
-- ============================================================================
CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT NULL,
  category VARCHAR(100) NULL COMMENT '产品分类',
  unit_price DECIMAL(12,2) NULL DEFAULT 0 COMMENT '单价',
  unit VARCHAR(20) NULL COMMENT '单位（件/套/次/人/小时等）',
  is_active TINYINT NOT NULL DEFAULT 1,
  image_url VARCHAR(500) NULL,
  metadata JSON NULL COMMENT '行业自定义属性',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_prod_tenant_cat (tenant_id, category),
  INDEX idx_prod_tenant_active (tenant_id, is_active),
  INDEX idx_prod_tenant_name (tenant_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT '✅ products 表创建完成' AS status;

-- ============================================================================
-- 3. tenant_balances 初始化（为有订阅的租户创建余额账户）
-- ============================================================================
INSERT IGNORE INTO tenant_balances (tenant_id, balance, total_recharged, total_consumed, frozen_balance, created_at, updated_at)
SELECT s.tenant_id, 0.00, 0.00, 0.00, 0.00, NOW(), NOW()
FROM subscriptions s
WHERE NOT EXISTS (SELECT 1 FROM tenant_balances tb WHERE tb.tenant_id = s.tenant_id);

SELECT '✅ tenant_balances 初始化完成' AS status;

-- ============================================================================
-- 4. recharge_packages 去重（保留每组最早的记录）
-- ============================================================================
DELETE p1 FROM recharge_packages p1
INNER JOIN recharge_packages p2
ON p1.name = p2.name AND p1.amount = p2.amount AND p1.id > p2.id;

SELECT '✅ recharge_packages 去重完成' AS status;

-- ============================================================================
-- 5. tenant_balances 表结构补充（frozen_balance 如不存在则加）
-- ============================================================================
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'tenant_balances' AND COLUMN_NAME = 'frozen_balance');
SET @sql_fb = IF(@col_exists = 0,
  'ALTER TABLE tenant_balances ADD COLUMN frozen_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''冻结金额''',
  'SELECT ''frozen_balance already exists'' AS msg');
PREPARE stmt FROM @sql_fb;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- 6. 最终验证
-- ============================================================================
SELECT 'subscriptions 列' AS tbl,
  GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION) AS cols
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions';

SELECT COUNT(*) AS recharge_pkg_cnt FROM recharge_packages;
SELECT COUNT(*) AS tenant_balance_cnt FROM tenant_balances;
SELECT 'products' AS tbl_exists FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'products';

SELECT '✅✅✅ ECS 计费修复全部完成 ✅✅✅' AS final_status;
