-- 支付宝 page.pay 跳转 URL 含签名，历史上曾写入 pay_code_url 导致超长；列宽放宽并兼容旧数据
SET NAMES utf8mb4;

ALTER TABLE payment_records
  MODIFY COLUMN pay_code_url VARCHAR(2048) NULL COMMENT '支付标记/微信 code_url（支付宝仅存 pagepay:订单号）';
