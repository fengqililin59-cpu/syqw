const segmentService = require('../services/customerSegment.service.cjs');

exports.list = async (req, res) => {
  try {
    const segments = await segmentService.list(req.user.tenant_id);
    res.json({ code: 0, data: segments });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const seg = await segmentService.getById(req.user.tenant_id, req.params.id);
    res.json({ code: 0, data: seg });
  } catch (err) {
    res.status(err.message === '分组不存在' ? 404 : 500).json({ code: 500, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const seg = await segmentService.create(req.user.tenant_id, {
      ...req.body,
      created_by: req.user.id,
    });
    res.json({ code: 0, data: seg, message: '分组创建成功，已自动匹配成员' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const seg = await segmentService.update(req.user.tenant_id, req.params.id, req.body);
    res.json({ code: 0, data: seg, message: '分组更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await segmentService.delete(req.user.tenant_id, req.params.id);
    res.json({ code: 0, message: '分组已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const { page, page_size } = req.query;
    const result = await segmentService.getMembers(req.user.tenant_id, req.params.id, {
      page: parseInt(page) || 1,
      pageSize: parseInt(page_size) || 20,
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.refreshMembers = async (req, res) => {
  try {
    const result = await segmentService.refreshMembers(req.user.tenant_id, req.params.id);
    res.json({ code: 0, data: result, message: `匹配完成，共 ${result.matched} 人` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.refreshAll = async (req, res) => {
  try {
    const results = await segmentService.refreshAllAuto(req.user.tenant_id);
    res.json({ code: 0, data: results, message: `已刷新 ${results.length} 个分组` });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.preview = async (req, res) => {
  try {
    const { rules, match_type } = req.body;
    const result = await segmentService.previewRules(req.user.tenant_id, rules, match_type || 'all');
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};
