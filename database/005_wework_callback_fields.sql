-- 增量补丁：仅当你曾执行过「旧版 004」（只有 wework_corp_id/agent/secret 三列）时再执行本文件。
-- 若使用当前仓库里的新版 database/004_wework.sql（已含 token / aes），无需执行本文件。
-- 单独某一列已存在时报 Duplicate column，可注释掉对应 ALTER 再执行。

SET NAMES utf8mb4;

ALTER TABLE `tenants`
  ADD COLUMN `wework_token` VARCHAR(64) NULL DEFAULT NULL COMMENT '回调 Token' AFTER `wework_secret`;

ALTER TABLE `tenants`
  ADD COLUMN `wework_encoding_aes_key` VARCHAR(86) NULL DEFAULT NULL COMMENT '回调 EncodingAESKey' AFTER `wework_token`;

-- 旧库 AgentId 若为 VARCHAR(32)，可与企微文档对齐加宽（可选）：
-- ALTER TABLE `tenants` MODIFY COLUMN `wework_agent_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '自建应用 AgentId';
