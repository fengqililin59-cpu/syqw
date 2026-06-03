const { KbCategory, KbArticle, User, sequelize } = require('../models/index.js');
const { Op } = require('sequelize');
const { assertPublicTenant } = require('../utils/publicTenant.js');

/** users 表无 name 列，勿用 author.name / creator.name */
const USER_ATTRS = ['id', 'username', 'real_name'];

const PUBLIC_CATEGORY_ATTRS = ['id', 'name', 'slug', 'description', 'icon', 'sort_order'];
const PUBLIC_ARTICLE_ATTRS = [
  'id', 'title', 'slug', 'summary', 'content', 'content_type', 'tags',
  'status', 'is_featured', 'view_count', 'helpful_yes', 'helpful_no',
  'published_at', 'updated_at', 'category_id',
];

function pickRow(row, fields) {
  const plain = row?.toJSON ? row.toJSON() : row;
  const out = {};
  for (const f of fields) {
    if (plain[f] !== undefined) out[f] = plain[f];
  }
  return out;
}

function toPublicCategory(row) {
  const base = pickRow(row, PUBLIC_CATEGORY_ATTRS);
  return base;
}

function toPublicArticle(row) {
  const base = pickRow(row, PUBLIC_ARTICLE_ATTRS);
  if (row.category) {
    base.category = pickRow(row.category, ['id', 'name', 'slug']);
  }
  if (row.author) {
    const a = pickRow(row.author, ['id', 'real_name', 'username']);
    base.author_name = a.real_name || a.username || null;
  }
  return base;
}

class KbCategoryService {

  async list(tenantId, { includeUnpublished = false } = {}) {
    const where = { tenant_id: tenantId };
    if (!includeUnpublished) where.is_published = true;
    return KbCategory.findAll({
      where,
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
      include: [{ model: User, as: 'creator', attributes: USER_ATTRS, required: false }],
    });
  }

  async getById(tenantId, id) {
    const cat = await KbCategory.findOne({
      where: { id, tenant_id: tenantId },
      include: [{ model: User, as: 'creator', attributes: USER_ATTRS, required: false }],
    });
    if (!cat) throw new Error('分类不存在');
    return cat;
  }

  async create(tenantId, data) {
    return KbCategory.create({
      tenant_id: tenantId,
      name: data.name,
      slug: data.slug || null,
      description: data.description || '',
      icon: data.icon || '',
      sort_order: data.sort_order || 0,
      is_published: !!data.is_published,
      created_by: data.created_by,
    });
  }

  async update(tenantId, id, data) {
    const cat = await this.getById(tenantId, id);
    const fields = ['name', 'slug', 'description', 'icon', 'sort_order', 'is_published'];
    for (const f of fields) {
      if (data[f] !== undefined) cat[f] = data[f];
    }
    await cat.save();
    return this.getById(tenantId, id);
  }

  async delete(tenantId, id) {
    const cat = await this.getById(tenantId, id);
    const articleCount = await KbArticle.count({ where: { category_id: id, tenant_id: tenantId } });
    if (articleCount > 0) throw new Error('该分类下还有文章，请先移除');
    await cat.destroy();
  }
}

class KbArticleService {

  async list(tenantId, { category_id, status, search, keyword, featured, is_featured, page = 1, pageSize = 20 } = {}) {
    const where = { tenant_id: tenantId };
    if (category_id) where.category_id = category_id;
    if (status) where.status = status;
    const featuredFlag = featured !== undefined ? featured : is_featured;
    if (featuredFlag !== undefined) where.is_featured = featuredFlag;
    const term = search || keyword;
    if (term) {
      where[Op.or] = [
        { title: { [Op.like]: `%${term}%` } },
        { summary: { [Op.like]: `%${term}%` } },
      ];
    }
    const offset = (page - 1) * pageSize;
    const { count, rows } = await KbArticle.findAndCountAll({
      where,
      include: [
        { association: 'category', attributes: ['id', 'name'] },
        { model: User, as: 'author', attributes: USER_ATTRS, required: false },
      ],
      order: [['is_featured', 'DESC'], ['sort_order', 'ASC'], ['published_at', 'DESC']],
      limit: pageSize,
      offset,
    });
    return { total: count, list: rows, page, pageSize };
  }

  async getById(tenantId, id) {
    const article = await KbArticle.findOne({
      where: { id, tenant_id: tenantId },
      include: [
        { association: 'category', attributes: ['id', 'name'] },
        { model: User, as: 'author', attributes: USER_ATTRS, required: false },
      ],
    });
    if (!article) throw new Error('文章不存在');
    return article;
  }

  async getBySlug(tenantId, slug) {
    return KbArticle.findOne({
      where: { tenant_id: tenantId, slug, status: 'published' },
      include: [
        { association: 'category', attributes: ['id', 'name'] },
        { model: User, as: 'author', attributes: USER_ATTRS, required: false },
      ],
    });
  }

  async create(tenantId, data) {
    const article = await KbArticle.create({
      tenant_id: tenantId,
      category_id: data.category_id || null,
      title: data.title,
      slug: data.slug || null,
      summary: data.summary || '',
      content: data.content || '',
      content_type: data.content_type || 'markdown',
      tags: data.tags || [],
      author_id: data.author_id,
      status: data.status || 'draft',
      is_featured: !!data.is_featured,
      is_ai_generated: !!data.is_ai_generated,
      sort_order: data.sort_order || 0,
      published_at: data.status === 'published' ? new Date() : null,
    });
    return this.getById(tenantId, article.id);
  }

  async update(tenantId, id, data) {
    const article = await this.getById(tenantId, id);
    const fields = ['category_id', 'title', 'slug', 'summary', 'content', 'content_type', 'tags', 'status', 'is_featured', 'is_ai_generated', 'sort_order'];
    const wasDraft = article.status === 'draft';
    for (const f of fields) {
      if (data[f] !== undefined) article[f] = data[f];
    }
    // 首次发布时自动填 published_at
    if (wasDraft && article.status === 'published' && !article.published_at) {
      article.published_at = new Date();
    }
    await article.save();
    return this.getById(tenantId, id);
  }

  async delete(tenantId, id) {
    const article = await this.getById(tenantId, id);
    await article.destroy();
  }

  async incrementView(tenantId, id) {
    await KbArticle.increment('view_count', { where: { id, tenant_id: tenantId } });
  }

  async voteHelpful(tenantId, id, isHelpful) {
    const field = isHelpful ? 'helpful_yes' : 'helpful_no';
    await KbArticle.increment(field, { where: { id, tenant_id: tenantId } });
  }

  async listFeatured(tenantId, limit = 6) {
    return KbArticle.findAll({
      where: { tenant_id: tenantId, status: 'published', is_featured: true },
      include: [{ association: 'category', attributes: ['id', 'name'] }],
      order: [['sort_order', 'ASC'], ['published_at', 'DESC']],
      limit,
    });
  }

  async listRecent(tenantId, limit = 10) {
    return KbArticle.findAll({
      where: { tenant_id: tenantId, status: 'published' },
      include: [{ association: 'category', attributes: ['id', 'name'] }],
      order: [['published_at', 'DESC']],
      limit,
    });
  }

  async listByCategory(tenantId, categoryId) {
    return KbArticle.findAll({
      where: { tenant_id: tenantId, category_id: categoryId, status: 'published' },
      order: [['is_featured', 'DESC'], ['sort_order', 'ASC']],
    });
  }

  async getStats(tenantId) {
    const base = { where: { tenant_id: tenantId } };
    const [total, published, draft, archived, featured, ai_generated, viewSum] = await Promise.all([
      KbArticle.count(base),
      KbArticle.count({ where: { tenant_id: tenantId, status: 'published' } }),
      KbArticle.count({ where: { tenant_id: tenantId, status: 'draft' } }),
      KbArticle.count({ where: { tenant_id: tenantId, status: 'archived' } }),
      KbArticle.count({ where: { tenant_id: tenantId, is_featured: true } }),
      KbArticle.count({ where: { tenant_id: tenantId, is_ai_generated: true } }),
      KbArticle.sum('view_count', base),
    ]);
    return {
      total,
      published,
      draft,
      archived,
      featured,
      ai_generated,
      total_views: Number(viewSum) || 0,
    };
  }

  async publish(tenantId, id) {
    return this.update(tenantId, id, { status: 'published' });
  }

  async archive(tenantId, id) {
    return this.update(tenantId, id, { status: 'archived' });
  }

  /** 公开帮助中心：仅已发布文章 */
  async listPublic(tenantId, { category_id, keyword } = {}) {
    await assertPublicTenant(tenantId);
    const where = { tenant_id: tenantId, status: 'published' };
    if (category_id) where.category_id = category_id;
    const term = keyword && String(keyword).trim();
    if (term) {
      where[Op.or] = [
        { title: { [Op.like]: `%${term}%` } },
        { summary: { [Op.like]: `%${term}%` } },
      ];
    }
    const rows = await KbArticle.findAll({
      where,
      attributes: PUBLIC_ARTICLE_ATTRS,
      include: [{ association: 'category', attributes: ['id', 'name', 'slug'], required: false }],
      order: [['is_featured', 'DESC'], ['sort_order', 'ASC'], ['published_at', 'DESC']],
      limit: 200,
    });
    return rows.map(toPublicArticle);
  }

  async getPublicBySlug(tenantId, slug) {
    await assertPublicTenant(tenantId);
    const article = await KbArticle.findOne({
      where: { tenant_id: tenantId, slug, status: 'published' },
      attributes: PUBLIC_ARTICLE_ATTRS,
      include: [
        { association: 'category', attributes: ['id', 'name', 'slug'], required: false },
        { model: User, as: 'author', attributes: USER_ATTRS, required: false },
      ],
    });
    if (!article) return null;
    return toPublicArticle(article);
  }

  async incrementViewPublic(tenantId, id) {
    await assertPublicTenant(tenantId);
    const n = await KbArticle.increment('view_count', {
      where: { id, tenant_id: tenantId, status: 'published' },
    });
    if (!n || !n[0]) throw new Error('文章不存在或未发布');
  }

  async voteHelpfulPublic(tenantId, id, isHelpful) {
    await assertPublicTenant(tenantId);
    const field = isHelpful ? 'helpful_yes' : 'helpful_no';
    const n = await KbArticle.increment(field, {
      where: { id, tenant_id: tenantId, status: 'published' },
    });
    if (!n || !n[0]) throw new Error('文章不存在或未发布');
  }
}

class KbPublicCategoryService {
  async listPublished(tenantId) {
    await assertPublicTenant(tenantId);
    const rows = await KbCategory.findAll({
      where: { tenant_id: tenantId, is_published: true },
      attributes: PUBLIC_CATEGORY_ATTRS,
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    return rows.map(toPublicCategory);
  }
}

module.exports = {
  categoryService: new KbCategoryService(),
  articleService: new KbArticleService(),
  publicCategoryService: new KbPublicCategoryService(),
};
