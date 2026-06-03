const {
  categoryService,
  articleService,
  publicCategoryService,
} = require('../services/knowledgeBase.service.cjs');
const { parsePublicTenantId } = require('../utils/publicTenant.js');

function publicTenantId(req) {
  return parsePublicTenantId(req);
}

function tenantIdFromReq(req) {
  const tid = req.auth?.tenantId ?? req.user?.tenant_id ?? req.user?.get?.('tenant_id');
  if (tid == null || !Number.isFinite(Number(tid))) {
    throw new Error('未登录或租户无效');
  }
  return Number(tid);
}

// ==================== 分类 Controller ====================

exports.listCategories = async (req, res) => {
  try {
    const { include_unpublished, is_published } = req.query;
    const includeUnpublished =
      include_unpublished === 'true' ||
      is_published === 'false' ||
      is_published === '0';
    const list = await categoryService.list(tenantIdFromReq(req), {
      includeUnpublished,
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getCategory = async (req, res) => {
  try {
    const cat = await categoryService.getById(tenantIdFromReq(req), req.params.id);
    res.json({ code: 0, data: cat });
  } catch (err) {
    res.status(err.message === '分类不存在' ? 404 : 500).json({ code: 500, message: err.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const cat = await categoryService.create(tenantIdFromReq(req), { ...req.body, created_by: req.user.id });
    res.json({ code: 0, data: cat, message: '分类创建成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const cat = await categoryService.update(tenantIdFromReq(req), req.params.id, req.body);
    res.json({ code: 0, data: cat, message: '分类更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    await categoryService.delete(tenantIdFromReq(req), req.params.id);
    res.json({ code: 0, message: '分类已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// ==================== 文章 Controller ====================

exports.listArticles = async (req, res) => {
  try {
    const { category_id, status, search, keyword, featured, is_featured, page, page_size } = req.query;
    const result = await articleService.list(tenantIdFromReq(req), {
      category_id: category_id ? parseInt(category_id, 10) : undefined,
      status,
      search,
      keyword,
      featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
      is_featured: is_featured === 'true' ? true : is_featured === 'false' ? false : undefined,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(page_size, 10) || 20,
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getArticle = async (req, res) => {
  try {
    const article = await articleService.getById(tenantIdFromReq(req), req.params.id);
    // 增加浏览量
    await articleService.incrementView(tenantIdFromReq(req), req.params.id);
    res.json({ code: 0, data: article });
  } catch (err) {
    res.status(err.message === '文章不存在' ? 404 : 500).json({ code: 500, message: err.message });
  }
};

exports.getArticleBySlug = async (req, res) => {
  try {
    const article = await articleService.getBySlug(tenantIdFromReq(req), req.params.slug);
    if (!article) return res.status(404).json({ code: 404, message: '文章不存在' });
    await articleService.incrementView(tenantIdFromReq(req), article.id);
    res.json({ code: 0, data: article });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.createArticle = async (req, res) => {
  try {
    const article = await articleService.create(tenantIdFromReq(req), { ...req.body, author_id: req.user.id });
    res.json({ code: 0, data: article, message: '文章创建成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.updateArticle = async (req, res) => {
  try {
    const article = await articleService.update(tenantIdFromReq(req), req.params.id, req.body);
    res.json({ code: 0, data: article, message: '文章更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.deleteArticle = async (req, res) => {
  try {
    await articleService.delete(tenantIdFromReq(req), req.params.id);
    res.json({ code: 0, message: '文章已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.voteHelpful = async (req, res) => {
  try {
    const { helpful } = req.body; // true / false
    await articleService.voteHelpful(tenantIdFromReq(req), req.params.id, helpful === true || helpful === 'true');
    res.json({ code: 0, message: '感谢反馈' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.listFeatured = async (req, res) => {
  try {
    const { limit } = req.query;
    const list = await articleService.listFeatured(tenantIdFromReq(req), parseInt(limit) || 6);
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.listRecent = async (req, res) => {
  try {
    const { limit } = req.query;
    const list = await articleService.listRecent(tenantIdFromReq(req), parseInt(limit) || 10);
    res.json({ code: 0, data: list });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.articleStats = async (req, res) => {
  try {
    const stats = await articleService.getStats(tenantIdFromReq(req));
    res.json({ code: 0, data: stats });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.publishArticle = async (req, res) => {
  try {
    const article = await articleService.publish(tenantIdFromReq(req), req.params.id);
    res.json({ code: 0, data: article, message: '已发布' });
  } catch (err) {
    res.status(err.message === '文章不存在' ? 404 : 500).json({ code: 500, message: err.message });
  }
};

exports.archiveArticle = async (req, res) => {
  try {
    const article = await articleService.archive(tenantIdFromReq(req), req.params.id);
    res.json({ code: 0, data: article, message: '已归档' });
  } catch (err) {
    res.status(err.message === '文章不存在' ? 404 : 500).json({ code: 500, message: err.message });
  }
};

// ==================== 公开帮助中心（?tenant= 租户 ID） ====================

exports.publicListCategories = async (req, res) => {
  try {
    const list = await publicCategoryService.listPublished(publicTenantId(req));
    res.json({ code: 0, data: list });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ code: status, message: err.message });
  }
};

exports.publicListArticles = async (req, res) => {
  try {
    const { category_id, keyword } = req.query;
    const list = await articleService.listPublic(publicTenantId(req), {
      category_id: category_id ? parseInt(category_id, 10) : undefined,
      keyword,
    });
    res.json({ code: 0, data: list });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ code: status, message: err.message });
  }
};

exports.publicGetArticle = async (req, res) => {
  try {
    const tenantId = publicTenantId(req);
    const article = await articleService.getPublicBySlug(tenantId, req.params.slug);
    if (!article) return res.status(404).json({ code: 404, message: '文章不存在' });
    await articleService.incrementViewPublic(tenantId, article.id);
    res.json({ code: 0, data: article });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ code: status, message: err.message });
  }
};

exports.publicTrackView = async (req, res) => {
  try {
    await articleService.incrementViewPublic(publicTenantId(req), req.params.id);
    res.json({ code: 0, message: 'ok' });
  } catch (err) {
    const status = err.status === 404 ? 404 : err.status || 500;
    res.status(status).json({ code: status, message: err.message });
  }
};

exports.publicRateArticle = async (req, res) => {
  try {
    const { helpful } = req.body;
    await articleService.voteHelpfulPublic(
      publicTenantId(req),
      req.params.id,
      helpful === true || helpful === 'true',
    );
    res.json({ code: 0, message: '感谢反馈' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ code: status, message: err.message });
  }
};
