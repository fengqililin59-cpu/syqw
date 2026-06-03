-- 095: 支付记录增加 purchase_type 字段，支持余额充值/加购包支付订单
ALTER TABLE payment_records
  ADD COLUMN purchase_type ENUM('subscription', 'balance_recharge', 'addon_purchase') 
    NOT NULL DEFAULT 'subscription' 
    AFTER pay_channel,
  ADD COLUMN metadata JSON NULL 
    AFTER remark;

-- 为 balance_recharge 支付订单放松 plan_id 约束
ALTER TABLE payment_records
  MODIFY COLUMN plan_id BIGINT UNSIGNED NULL;
