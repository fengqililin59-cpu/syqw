-- 收件箱：低风险 FAQ 类 AI 回复可自动发送（投诉/报价等仍须人工审核）
ALTER TABLE `tenants`
  ADD COLUMN `inbox_ai_auto_send` TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '收件箱 AI：p0 低风险且高置信时自动发送'
    AFTER `allow_auto_send`;
