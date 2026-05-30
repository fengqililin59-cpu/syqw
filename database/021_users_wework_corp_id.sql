-- 修复：登录 / 新建员工 500 / Unknown column 'User.wework_corp_id' in 'field list'
-- 原因：User 模型含 wework_corp_id，旧库 users 表未加列。
-- 若 tenants 查询也报缺 wework_corp_id，请先执行 database/022_tenants_missing_wework_columns.sql。
-- 若提示 Duplicate column，说明已加过，可忽略。

SET NAMES utf8mb4;

ALTER TABLE `users`
  ADD COLUMN `wework_corp_id` VARCHAR(64) NULL DEFAULT NULL COMMENT '扫码登录 CorpID（与成员绑定一致）' AFTER `wework_userid`;
