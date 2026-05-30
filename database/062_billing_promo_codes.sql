SET NAMES utf8mb4;

-- 兑换码（平台方创建，租户自助激活套餐）
CREATE TABLE IF NOT EXISTS billing_promo_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(32) NOT NULL,
  plan_id BIGINT UNSIGNED NOT NULL,
  billing_cycle ENUM('monthly','yearly') NOT NULL DEFAULT 'yearly',
  max_redemptions INT UNSIGNED NOT NULL DEFAULT 1,
  redemption_count INT UNSIGNED NOT NULL DEFAULT 0,
  valid_until DATETIME NULL,
  note VARCHAR(255) NULL,
  created_by_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_promo_code (code),
  KEY idx_promo_plan (plan_id),
  KEY idx_promo_valid (valid_until)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS billing_promo_redemptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  promo_code_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  redeemed_by_user_id BIGINT UNSIGNED NOT NULL,
  redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_promo_tenant (promo_code_id, tenant_id),
  KEY idx_redemption_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 免费版定位为「试用到期后的体验版」，略收紧配额以促升级（非广告变现）
UPDATE plans
SET
  customers_limit = 50,
  seats_limit = 2,
  broadcasts_monthly = 200,
  ai_calls_monthly = 30
WHERE code = 'free';
