-- ===========================================================
-- 087: 知识库 / 帮助中心
-- kb_categories: 文章分类
-- kb_articles: 知识库文章（支持 Markdown/HTML）
-- ===========================================================

CREATE TABLE IF NOT EXISTS kb_categories (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     INT          NOT NULL,
  name          VARCHAR(100) NOT NULL COMMENT '分类名称',
  slug          VARCHAR(100) COMMENT 'URL别名',
  description   VARCHAR(500),
  icon          VARCHAR(50)  COMMENT '图标标识',
  sort_order    INT          DEFAULT 0,
  is_published  TINYINT(1)  DEFAULT 0,
  created_by    INT,
  created_at    DATETIME     DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)  REFERENCES tenants(id),
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kb_articles (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id          INT           NOT NULL,
  category_id        INT,
  title              VARCHAR(200)  NOT NULL,
  slug               VARCHAR(200),
  summary            VARCHAR(500),
  content            TEXT          COMMENT '文章内容（Markdown或HTML）',
  content_type       ENUM('markdown','html','text') DEFAULT 'markdown',
  tags               JSON           COMMENT '标签数组',
  author_id          INT,
  status             ENUM('draft','published','archived') DEFAULT 'draft',
  is_featured        TINYINT(1)   DEFAULT 0 COMMENT '是否置顶推荐',
  is_ai_generated    TINYINT(1)   DEFAULT 0 COMMENT '是否AI生成',
  view_count         INT           DEFAULT 0,
  helpful_yes        INT           DEFAULT 0 COMMENT '有帮助投票数',
  helpful_no         INT           DEFAULT 0 COMMENT '无帮助投票数',
  sort_order         INT           DEFAULT 0,
  published_at       DATETIME,
  created_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id)   REFERENCES tenants(id),
  FOREIGN KEY (category_id) REFERENCES kb_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (author_id)   REFERENCES users(id),
  INDEX idx_tenant (tenant_id),
  INDEX idx_category (category_id),
  INDEX idx_status (status),
  INDEX idx_featured (is_featured),
  INDEX idx_published (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
