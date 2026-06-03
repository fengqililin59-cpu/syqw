-- payment_records 补 pay_code_url（支付宝/微信跳转 URL）
SET NAMES utf8mb4;

SET @c = (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_records' AND COLUMN_NAME = 'pay_code_url');
SET @sql = IF(@c = 0,
  'ALTER TABLE payment_records ADD COLUMN pay_code_url VARCHAR(512) NULL COMMENT ''支付跳转或二维码'' AFTER out_trade_no',
  'SELECT ''pay_code_url exists'' AS msg');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SELECT 'done' AS status;
