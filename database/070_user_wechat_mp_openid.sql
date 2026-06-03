SET NAMES utf8mb4;

ALTER TABLE users
  ADD COLUMN wechat_mp_openid VARCHAR(64) NULL COMMENT '公众号 openid（JSAPI 支付）' AFTER wework_corp_id;
