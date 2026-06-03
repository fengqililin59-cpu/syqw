SET NAMES utf8mb4;

-- 微信支付 Native：保存二维码链接与微信订单号
ALTER TABLE payment_records
  ADD COLUMN pay_code_url VARCHAR(512) NULL COMMENT '微信 Native code_url' AFTER out_trade_no,
  ADD COLUMN wechat_transaction_id VARCHAR(64) NULL COMMENT '微信支付订单号' AFTER pay_code_url;
