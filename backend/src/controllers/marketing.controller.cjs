const marketingCampaignService = require('../services/marketingCampaign.service.cjs');
const messageTemplateService = require('../services/messageTemplate.service.cjs');
const { MarketingCampaign, MessageTemplate } = require('../models/index.js');
const { Op } = require('sequelize');

// ==================== 营销活动 Controller ====================

exports.getCampaigns = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { page, page_size, type, status, keyword } = req.query;
    const result = await marketingCampaignService.getCampaigns(tenantId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(page_size) || 20,
      type, status, keyword,
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const campaign = await marketingCampaignService.getCampaign(tenantId, req.params.id);
    res.json({ code: 0, data: campaign });
  } catch (err) {
    res.status(404).json({ code: 404, message: err.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const userId = req.auth.userId;
    const campaign = await marketingCampaignService.createCampaign(tenantId, userId, req.body);
    res.json({ code: 0, data: campaign, message: '活动创建成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const campaign = await marketingCampaignService.updateCampaign(tenantId, req.params.id, req.body);
    res.json({ code: 0, data: campaign, message: '活动更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    await marketingCampaignService.deleteCampaign(tenantId, req.params.id);
    res.json({ code: 0, message: '活动已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const result = await marketingCampaignService.sendCampaign(tenantId, req.params.id);
    res.json({ code: 0, data: result, message: `已提交发送，共 ${result.sent_count} 条` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getCampaignStats = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const stats = await marketingCampaignService.getCampaignStats(tenantId, req.params.id);
    res.json({ code: 0, data: stats });
  } catch (err) {
    res.status(404).json({ code: 404, message: err.message });
  }
};

// ==================== 消息模板 Controller ====================

exports.getTemplates = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { page, page_size, type, keyword, is_active } = req.query;
    const result = await messageTemplateService.getTemplates(tenantId, {
      page: parseInt(page) || 1,
      pageSize: parseInt(page_size) || 20,
      type, keyword, isActive: is_active,
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const template = await messageTemplateService.getTemplate(tenantId, req.params.id);
    res.json({ code: 0, data: template });
  } catch (err) {
    res.status(404).json({ code: 404, message: err.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const userId = req.auth.userId;
    const template = await messageTemplateService.createTemplate(tenantId, userId, req.body);
    res.json({ code: 0, data: template, message: '模板创建成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const template = await messageTemplateService.updateTemplate(tenantId, req.params.id, req.body);
    res.json({ code: 0, data: template, message: '模板更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    await messageTemplateService.deleteTemplate(tenantId, req.params.id);
    res.json({ code: 0, message: '模板已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.toggleTemplateActive = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const template = await messageTemplateService.toggleActive(tenantId, req.params.id);
    res.json({ code: 0, data: template, message: `已${template.is_active ? '启用' : '停用'}` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// ==================== 营销看板 Controller ====================

exports.getDashboard = async (req, res) => {
  try {
    const tenantId = req.auth.tenantId;
    const { days } = req.query;
    const result = await marketingCampaignService.getDashboardAnalytics(tenantId, {
      days: parseInt(days) || 30,
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};
