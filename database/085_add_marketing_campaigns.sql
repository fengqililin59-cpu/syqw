-- ============================================================
-- 营销活动 & 消息模板 & 发送记录
-- CRM SaaS - Phase 8 营销自动化
-- ============================================================

-- 1. 营销活动表
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    name            VARCHAR(200) NOT NULL COMMENT '活动名称',
    type            ENUM('email','sms','wechat') NOT NULL DEFAULT 'email' COMMENT '渠道类型',
    status          ENUM('draft','scheduled','sending','sent','cancelled') NOT NULL DEFAULT 'draft',
    subject         VARCHAR(300) NULL COMMENT '邮件主题 / 短信前缀',
    content         TEXT         NULL COMMENT '邮件HTML内容 / 短信文本',
    template_id     BIGINT       NULL COMMENT '关联消息模板',
    target_filter   JSON         NULL COMMENT '目标客户筛选条件 {tags:[], stage:, source:}',
    target_count    INT          DEFAULT 0 COMMENT '目标客户数量',
    sent_count      INT          DEFAULT 0 COMMENT '已发送数量',
    open_count      INT          DEFAULT 0 COMMENT '打开数量(邮件)',
    click_count     INT          DEFAULT 0 COMMENT '点击数量',
    reply_count     INT          DEFAULT 0 COMMENT '回复数量',
    bounce_count    INT          DEFAULT 0 COMMENT '退信数量',
    scheduled_at    DATETIME     NULL COMMENT '定时发送时间',
    sent_at         DATETIME     NULL COMMENT '实际发送时间',
    created_by      BIGINT       NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status),
    INDEX idx_type   (type),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销活动';

-- 2. 消息模板表
CREATE TABLE IF NOT EXISTS message_templates (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    name            VARCHAR(200) NOT NULL COMMENT '模板名称',
    type            ENUM('email','sms','wechat') NOT NULL DEFAULT 'email',
    subject         VARCHAR(300) NULL COMMENT '邮件主题模板',
    content         TEXT         NOT NULL COMMENT '模板内容(支持变量替换)',
    variables       JSON         NULL COMMENT '可用变量列表 ["customer_name","company_name",...]',
    is_active       TINYINT(1)  DEFAULT 1,
    created_by      BIGINT       NULL,
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_type   (type),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息模板库';

-- 3. 营销发送记录表
CREATE TABLE IF NOT EXISTS marketing_messages (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    campaign_id     BIGINT       NOT NULL,
    customer_id     BIGINT       NULL COMMENT 'NULL=测试发送/非注册联系人',
    contact_value   VARCHAR(500) NOT NULL COMMENT '邮箱地址 / 手机号',
    subject          VARCHAR(300) NULL,
    content         TEXT         NULL COMMENT '实际发送内容(变量已替换)',
    status          ENUM('pending','sent','failed','opened','clicked','bounced') DEFAULT 'pending',
    error_message   TEXT         NULL COMMENT '发送失败原因',
    sent_at         DATETIME     NULL,
    opened_at       DATETIME     NULL,
    clicked_at      DATETIME     NULL,
    track_open_id   VARCHAR(64)  NULL COMMENT '打开追踪像素ID',
    track_click_id  VARCHAR(64)  NULL COMMENT '点击追踪ID',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant      (tenant_id),
    INDEX idx_campaign    (campaign_id),
    INDEX idx_customer    (customer_id),
    INDEX idx_status      (status),
    INDEX idx_contact     (contact_value(100)),
    FOREIGN KEY (tenant_id)   REFERENCES tenants(id)   ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销消息发送记录';

-- 4. 营销偏好退订表
CREATE TABLE IF NOT EXISTS marketing_optouts (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    customer_id     BIGINT       NULL,
    contact_value   VARCHAR(500) NOT NULL COMMENT '邮箱/手机号',
    reason          VARCHAR(500) NULL COMMENT '退订原因',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_contact (tenant_id, contact_value(100)),
    FOREIGN KEY (tenant_id)   REFERENCES tenants(id)   ON DELETE CASCADE,
    FOREIGN KEY (customer_id)  REFERENCES customers(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='营销退订记录';

COMMIT;
