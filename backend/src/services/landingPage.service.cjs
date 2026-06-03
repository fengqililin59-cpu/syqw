const { LandingPage, LandingSubmission, Customer, User } = require('../models/index.js');
const { Op } = require('sequelize');
const crypto = require('crypto');

class LandingPageService {
  async list(tenantId, { page = 1, pageSize = 20, status, keyword } = {}) {
    const where = { tenant_id: tenantId };
    if (status) where.status = status;
    if (keyword) where.title = { [Op.like]: `%${keyword}%` };

    const { rows, count } = await LandingPage.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'real_name'], required: false }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      attributes: { exclude: ['content', 'custom_css'] },
    });
    return { list: rows, total: count, page, size: pageSize };
  }

  async get(tenantId, id) {
    const lp = await LandingPage.findOne({
      where: { id, tenant_id: tenantId },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'real_name'], required: false },
      ],
    });
    if (!lp) throw new Error('落地页不存在');
    return lp;
  }

  async getBySlug(slug) {
    const lp = await LandingPage.findOne({
      where: { slug, status: 'published' },
      attributes: { exclude: ['created_by'] },
    });
    if (!lp) throw new Error('落地页不存在或未发布');
    return lp;
  }

  async create(tenantId, userId, data) {
    const slug = data.slug || `lp-${crypto.randomBytes(4).toString('hex')}`;
    // 检查 slug 唯一性
    const existing = await LandingPage.findOne({ where: { tenant_id: tenantId, slug } });
    if (existing) throw new Error(`路径 "${slug}" 已被占用`);

    return LandingPage.create({
      tenant_id: tenantId,
      created_by: userId,
      slug,
      ...data,
      content: data.content || { sections: [] },
      form_fields: data.form_fields || [
        { key: 'name', label: '姓名', type: 'text', required: true },
        { key: 'phone', label: '手机号', type: 'tel', required: true },
        { key: 'company', label: '公司名称', type: 'text', required: false },
      ],
    });
  }

  async update(tenantId, id, data) {
    const lp = await LandingPage.findOne({ where: { id, tenant_id: tenantId } });
    if (!lp) throw new Error('落地页不存在');

    if (data.slug && data.slug !== lp.slug) {
      const existing = await LandingPage.findOne({
        where: { tenant_id: tenantId, slug: data.slug, id: { [Op.ne]: id } },
      });
      if (existing) throw new Error(`路径 "${data.slug}" 已被占用`);
    }

    await lp.update(data);
    return this.get(tenantId, id);
  }

  async publish(tenantId, id) {
    const lp = await LandingPage.findOne({ where: { id, tenant_id: tenantId } });
    if (!lp) throw new Error('落地页不存在');
    await lp.update({ status: 'published', published_at: new Date() });
    return this.get(tenantId, id);
  }

  async unpublish(tenantId, id) {
    const lp = await LandingPage.findOne({ where: { id, tenant_id: tenantId } });
    if (!lp) throw new Error('落地页不存在');
    await lp.update({ status: 'draft' });
    return lp;
  }

  async remove(tenantId, id) {
    const lp = await LandingPage.findOne({ where: { id, tenant_id: tenantId } });
    if (!lp) throw new Error('落地页不存在');
    await LandingSubmission.destroy({ where: { landing_id: id } });
    await lp.destroy();
  }

  // 记录访问
  async recordView(tenantId, id) {
    await LandingPage.increment('view_count', { where: { id, tenant_id: tenantId } });
  }

  // 获取留资列表
  async getSubmissions(tenantId, { page = 1, pageSize = 20, landingId } = {}) {
    const where = { tenant_id: tenantId };
    if (landingId) where.landing_id = landingId;

    const { rows, count } = await LandingSubmission.findAndCountAll({
      where,
      include: [
        { model: LandingPage, as: 'landing', attributes: ['id', 'title'], required: false },
        { model: Customer, attributes: ['id', 'name', 'phone', 'email'], required: false },
      ],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return { list: rows, total: count, page, size: pageSize };
  }

  // 获取单个落地页统计
  async getStats(tenantId, id) {
    const lp = await LandingPage.findOne({
      where: { id, tenant_id: tenantId },
      attributes: ['id', 'title', 'slug', 'view_count', 'submit_count', 'published_at', 'status'],
    });
    if (!lp) throw new Error('落地页不存在');

    const recentSubs = await LandingSubmission.findAll({
      where: { landing_id: id },
      order: [['created_at', 'DESC']],
      limit: 10,
      attributes: ['data', 'created_at', 'utm_source'],
    });

    return { ...lp.toJSON(), recent_submissions: recentSubs };
  }
}

module.exports = new LandingPageService();
