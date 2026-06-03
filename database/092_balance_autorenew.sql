-- 092: 余额系统 + 自动续费
-- 支持用户预充值余额，套餐到期自动从余额扣款续费

CREATE TABLE IF NOT EXISTS tenant_balances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL UNIQUE,
  balance DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '当前余额（元）',
  total_recharged DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '累计充值金额',
  total_consumed DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '累计消费金额',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS balance_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT UNSIGNED NOT NULL,
  type ENUM('recharge', 'consume', 'refund') NOT NULL COMMENT '交易类型：充值/消费/退款',
  amount DECIMAL(10,2) NOT NULL COMMENT '交易金额',
  balance_after DECIMAL(10,2) NOT NULL COMMENT '交易后余额',
  channel ENUM('wechat', 'alipay', 'manual', 'auto_renew', 'addon_purchase') NOT NULL DEFAULT 'manual' COMMENT '交易渠道',
  reference VARCHAR(128) DEFAULT NULL COMMENT '关联单号',
  description VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_tenant (tenant_id),
  KEY idx_type (type),
  KEY idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订阅表增加自动续费相关字段
-- 使用存储过程安全添加列（幂等）
DROP PROCEDURE IF EXISTS add_subscription_columns;
DELIMITER $$
CREATE PROCEDURE add_subscription_columns()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_renew TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否开启自动续费';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew_plan_id') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_renew_plan_id BIGINT UNSIGNED DEFAULT NULL COMMENT '自动续费目标套餐ID';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'auto_renew_cycle') THEN
    ALTER TABLE subscriptions ADD COLUMN auto_renew_cycle ENUM('monthly','yearly') DEFAULT NULL COMMENT '自动续费周期';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'expiry_notified_at') THEN
    ALTER TABLE subscriptions ADD COLUMN expiry_notified_at DATETIME DEFAULT NULL COMMENT '到期通知发送时间';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'wework_saas' AND TABLE_NAME = 'subscriptions' AND COLUMN_NAME = 'reminder_notified_at') THEN
    ALTER TABLE subscriptions ADD COLUMN reminder_notified_at DATETIME DEFAULT NULL COMMENT '续费提醒发送时间';
  END IF;
END$$
DELIMITER ;
CALL add_subscription_columns();
DROP PROCEDURE IF EXISTS add_subscription_columns;

-- 充值固定面额配置
CREATE TABLE IF NOT EXISTS recharge_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL COMMENT '面额名称',
  amount DECIMAL(10,2) NOT NULL COMMENT '充值金额',
  bonus DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '赠送金额',
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 预置充值面额
INSERT IGNORE INTO recharge_packages (name, amount, bonus, sort_order) VALUES
('小额充值', 100.00, 0.00, 10),
('标准充值', 500.00, 20.00, 20),
('大额充值', 1000.00, 60.00, 30),
('超值充值', 3000.00, 240.00, 40),
('旗舰充值', 5000.00, 500.00, 50);
