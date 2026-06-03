const { MessageTemplate } = require('../models/index.js');

class MessageTemplateService {
  // 获取模板列表
  async getTemplates(tenantId, { page = 1, pageSize = 20, type, keyword, isActive } = {}) {
    const where = { tenant_id: tenantId };
    if (type) where.type = type;
    if (keyword) where.name = { [require('sequelize').Op.like]: `%${keyword}%` };
    if (isActive !== undefined) where.is_active = isActive === 'true' || isActive === true;

    const { rows, count } = await MessageTemplate.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return { list: rows, total: count, page, size: pageSize };
  }

  // 获取单个模板
  async getTemplate(tenantId, templateId) {
    const template = await MessageTemplate.findOne({
      where: { id: templateId, tenant_id: tenantId },
    });
    if (!template) throw new Error('模板不存在');
    return template;
  }

  // 创建模板
  async createTemplate(tenantId, userId, data) {
    const template = await MessageTemplate.create({
      tenant_id: tenantId,
      created_by: userId,
      ...data,
    });
    return this.getTemplate(tenantId, template.id);
  }

  // 更新模板
  async updateTemplate(tenantId, templateId, data) {
    const template = await MessageTemplate.findOne({
      where: { id: templateId, tenant_id: tenantId },
    });
    if (!template) throw new Error('模板不存在');
    await template.update(data);
    return this.getTemplate(tenantId, template.id);
  }

  // 删除模板
  async deleteTemplate(tenantId, templateId) {
    const template = await MessageTemplate.findOne({
      where: { id: templateId, tenant_id: tenantId },
    });
    if (!template) throw new Error('模板不存在');
    await template.destroy();
  }

  // 切换激活状态
  async toggleActive(tenantId, templateId) {
    const template = await MessageTemplate.findOne({
      where: { id: templateId, tenant_id: tenantId },
    });
    if (!template) throw new Error('模板不存在');
    await template.update({ is_active: !template.is_active });
    return this.getTemplate(tenantId, template.id);
  }
}

module.exports = new MessageTemplateService();
