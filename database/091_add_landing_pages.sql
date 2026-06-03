-- ============================================================
-- 091 落地页构建器
-- CRM SaaS - Phase 13 营销获客：落地页管理
-- ============================================================

CREATE TABLE IF NOT EXISTS landing_pages (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    title           VARCHAR(200) NOT NULL COMMENT '落地页标题',
    slug            VARCHAR(100) NOT NULL COMMENT 'URL 路径标识',
    description     VARCHAR(500) COMMENT 'SEO 描述',
    status          ENUM('draft','published','archived') DEFAULT 'draft' COMMENT '状态',
    template        VARCHAR(50)  DEFAULT 'default' COMMENT '模板名称',
    content         JSON         NOT NULL COMMENT '页面区块 JSON',
    custom_css      TEXT         COMMENT '自定义样式',
    meta_title      VARCHAR(200) COMMENT 'SEO 标题',
    og_image        VARCHAR(500) COMMENT '分享图 URL',
    bg_color        VARCHAR(20)  DEFAULT '#ffffff' COMMENT '背景色',
    primary_color   VARCHAR(20)  DEFAULT '#534AB7' COMMENT '主题色',
    logo_url        VARCHAR(500) COMMENT 'Logo 图片',
    favicon_url     VARCHAR(500) COMMENT 'Favicon',
    enable_form     TINYINT(1)   DEFAULT 1 COMMENT '是否启用留资表单',
    form_title      VARCHAR(200) COMMENT '表单标题',
    form_fields     JSON         COMMENT '表单字段配置',
    submit_btn_text VARCHAR(50)  DEFAULT '立即咨询' COMMENT '提交按钮文案',
    success_msg     VARCHAR(500) DEFAULT '提交成功，我们会尽快联系您！' COMMENT '提交成功提示',
    redirect_url    VARCHAR(500) COMMENT '提交后跳转 URL',
    qrcode_url      VARCHAR(500) COMMENT '企微二维码图片 URL',
    qrcode_text     VARCHAR(200) COMMENT '企微二维码引导文案',
    view_count      INT UNSIGNED DEFAULT 0 COMMENT '访问量',
    submit_count    INT UNSIGNED DEFAULT 0 COMMENT '留资量',
    published_at    DATETIME     COMMENT '发布时间',
    created_by      BIGINT       COMMENT '创建人',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_slug (tenant_id, slug),
    INDEX idx_tenant (tenant_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='落地页';

CREATE TABLE IF NOT EXISTS landing_submissions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id       BIGINT       NOT NULL,
    landing_id      BIGINT       NOT NULL COMMENT '落地页 ID',
    customer_id     BIGINT       COMMENT '关联客户（创建后回填）',
    data            JSON         NOT NULL COMMENT '提交的表单数据',
    ip              VARCHAR(45)  COMMENT 'IP 地址',
    user_agent      VARCHAR(500) COMMENT '浏览器 UA',
    referer         VARCHAR(500) COMMENT '来源页面',
    utm_source      VARCHAR(200) COMMENT 'UTM 来源',
    utm_medium      VARCHAR(200) COMMENT 'UTM 媒介',
    utm_campaign    VARCHAR(200) COMMENT 'UTM 活动',
    created_at      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant (tenant_id),
    INDEX idx_landing (landing_id),
    INDEX idx_customer (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='落地页留资记录';
