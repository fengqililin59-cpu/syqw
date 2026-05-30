-- 修复：登录 / 新建员工 500 / Unknown column 'wework_corp_id' in 'field list'（SELECT … FROM `tenants`）
-- 原因：旧库未执行 database/004_wework.sql，tenants 表缺少企微扫码与回调相关列；部分库还缺 allow_auto_send（见 013）。
--
-- 执行（推荐加 -f：某列已存在会报 Duplicate column，后续语句仍会执行）：
--   mysql -h127.0.0.1 -uroot -p wework_saas -f < database/022_tenants_missing_wework_columns.sql
--
-- 若登录仍报 User.wework_corp_id：请再执行 database/021_users_wework_corp_id.sql

SET NAMES utf8mb4;

ALTER TABLE `tenants`
  ADD COLUMN `wework_corp_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '企微企业 CorpID' AFTER `corp_secret`;

ALTER TABLE `tenants`
  ADD COLUMN `wework_agent_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '自建应用 AgentId' AFTER `wework_corp_id`;

ALTER TABLE `tenants`
  ADD COLUMN `wework_secret` VARCHAR(255) NULL DEFAULT NULL COMMENT '自建应用 Secret（用于 access_token）' AFTER `wework_agent_id`;

ALTER TABLE `tenants`
  ADD COLUMN `wework_token` VARCHAR(64) NULL DEFAULT NULL COMMENT '回调 Token' AFTER `wework_secret`;

ALTER TABLE `tenants`
  ADD COLUMN `wework_encoding_aes_key` VARCHAR(86) NULL DEFAULT NULL COMMENT '回调 EncodingAESKey' AFTER `wework_token`;

ALTER TABLE `tenants`
  ADD COLUMN `allow_auto_send` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否允许流程/自动化向客户直发企微消息' AFTER `status`;
