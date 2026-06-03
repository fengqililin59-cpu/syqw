-- 收件箱：简单询价类（p1）高置信自动发送（合同/底价等仍人工）
ALTER TABLE `tenants`
  ADD COLUMN `inbox_ai_auto_send_pricing` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '收件箱 AI：p1 询价类高置信自动发送'
    AFTER `inbox_ai_auto_send`;
