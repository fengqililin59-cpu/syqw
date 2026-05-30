-- 企微扫码登录：租户应用凭证 + 用户绑定 userid
-- 在已有库执行：mysql ... < database/004_wework.sql

SET NAMES utf8mb4;

ALTER TABLE `tenants`
  ADD COLUMN `wework_corp_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '企微企业 CorpID' AFTER `corp_secret`,
  ADD COLUMN `wework_agent_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '自建应用 AgentId' AFTER `wework_corp_id`,
  ADD COLUMN `wework_secret` VARCHAR(255) NULL DEFAULT NULL COMMENT '自建应用 Secret（用于 access_token）' AFTER `wework_agent_id`,
  ADD COLUMN `wework_token` VARCHAR(64) NULL DEFAULT NULL COMMENT '回调 Token' AFTER `wework_secret`,
  ADD COLUMN `wework_encoding_aes_key` VARCHAR(86) NULL DEFAULT NULL COMMENT '回调 EncodingAESKey' AFTER `wework_token`;

-- 可选：历史 corp_id / corp_secret 迁移到新字段（按需取消注释）
-- UPDATE tenants SET wework_corp_id = corp_id WHERE wework_corp_id IS NULL AND corp_id IS NOT NULL;
-- UPDATE tenants SET wework_secret = corp_secret WHERE wework_secret IS NULL AND corp_secret IS NOT NULL;

-- users.wework_userid 若初期脚本未包含再执行（若报 Duplicate column 可忽略）：
-- ALTER TABLE `users` ADD COLUMN `wework_userid` VARCHAR(64) NULL DEFAULT NULL COMMENT '企微成员 userid' AFTER `avatar_url`;
