SET NAMES utf8mb4;

-- 套餐定义表（系统级，不属于某个租户）
CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(32) NOT NULL UNIQUE,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  customers_limit INT NOT NULL DEFAULT -1,
  seats_limit INT NOT NULL DEFAULT -1,
  broadcasts_monthly INT NOT NULL DEFAULT -1,
  ai_calls_monthly INT NOT NULL DEFAULT -1,
  features JSON NOT NULL DEFAULT (JSON_ARRAY()),
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预置三个套餐
INSERT IGNORE INTO plans
(name, code, price_monthly, price_yearly,
 customers_limit, seats_limit,
 broadcasts_monthly, ai_calls_monthly,
 features, sort_order)
VALUES
('免费版', 'free', 0, 0,
 100, 3, 500, 100,
 JSON_ARRAY('customer_manage','broadcast',
   'channel_track','dashboard'),
 10),
('专业版', 'pro', 299, 2990,
 5000, 20, 10000, 2000,
 JSON_ARRAY('customer_manage','broadcast',
   'channel_track','dashboard','automation',
   'ai_full','campaign','migration',
   'intent_alert','audit_log'),
 20),
('企业版', 'enterprise', 999, 9990,
 -1, -1, -1, -1,
 JSON_ARRAY('all'),
 30);

-- 租户订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL UNIQUE,
  plan_id BIGINT UNSIGNED NOT NULL,
  billing_cycle ENUM('monthly','yearly')
    NOT NULL DEFAULT 'monthly',
  status ENUM('trialing','active','expired',
    'cancelled') NOT NULL DEFAULT 'trialing',
  trial_ends_at DATETIME NULL,
  current_period_start DATETIME NULL,
  current_period_end DATETIME NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sub_plan (plan_id),
  KEY idx_sub_status (status),
  KEY idx_sub_period_end (current_period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用量统计表（按月滚动）
CREATE TABLE IF NOT EXISTS usage_stats (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  stat_month CHAR(7) NOT NULL,
  customers_count INT UNSIGNED NOT NULL DEFAULT 0,
  seats_count INT UNSIGNED NOT NULL DEFAULT 0,
  broadcasts_used INT UNSIGNED NOT NULL DEFAULT 0,
  ai_calls_used INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_usage_tenant_month (tenant_id, stat_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 支付记录表
CREATE TABLE IF NOT EXISTS payment_records (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  billing_cycle ENUM('monthly','yearly')
    NOT NULL DEFAULT 'monthly',
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'CNY',
  status ENUM('pending','paid','failed','refunded')
    NOT NULL DEFAULT 'pending',
  pay_channel ENUM('wechat','alipay','manual')
    NOT NULL DEFAULT 'manual',
  out_trade_no VARCHAR(64) NOT NULL UNIQUE,
  paid_at DATETIME NULL,
  remark VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_tenant (tenant_id),
  KEY idx_payment_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 为现有租户创建默认订阅（免费版，14天试用）
INSERT IGNORE INTO subscriptions
  (tenant_id, plan_id, status, trial_ends_at)
SELECT
  t.id,
  (SELECT id FROM plans WHERE code='free'),
  'trialing',
  DATE_ADD(NOW(), INTERVAL 14 DAY)
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM subscriptions s
  WHERE s.tenant_id = t.id
);
