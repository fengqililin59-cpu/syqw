/**
 * @file 通知规则 Controller — 规则 CRUD + 日志查询 + 手动触发
 */
const notificationRuleService = require('../services/notificationRule.service.cjs');
const notificationDispatcher = require('../services/notificationDispatcher.service.cjs');

// ==================== 规则 CRUD ====================

exports.listRules = async (req, res) => {
  try {
    const { enabled, trigger_type, page, page_size } = req.query;
    const result = await notificationRuleService.list(req.user.tenant_id, {
      enabled: enabled !== undefined ? enabled === 'true' : undefined,
      trigger_type,
      page: parseInt(page) || 1,
      pageSize: parseInt(page_size) || 20,
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.getRule = async (req, res) => {
  try {
    const rule = await notificationRuleService.getById(req.user.tenant_id, req.params.id);
    res.json({ code: 0, data: rule });
  } catch (err) {
    res.status(err.message === '规则不存在' ? 404 : 500).json({ code: 500, message: err.message });
  }
};

exports.createRule = async (req, res) => {
  try {
    const rule = await notificationRuleService.create(req.user.tenant_id, {
      ...req.body,
      created_by: req.user.id,
    });
    res.json({ code: 0, data: rule, message: '通知规则创建成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.updateRule = async (req, res) => {
  try {
    const rule = await notificationRuleService.update(req.user.tenant_id, req.params.id, req.body);
    res.json({ code: 0, data: rule, message: '通知规则更新成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.deleteRule = async (req, res) => {
  try {
    await notificationRuleService.delete(req.user.tenant_id, req.params.id);
    res.json({ code: 0, message: '通知规则已删除' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

exports.toggleRule = async (req, res) => {
  try {
    const rule = await notificationRuleService.toggle(req.user.tenant_id, req.params.id);
    res.json({ code: 0, data: rule, message: rule.enabled ? '规则已启用' : '规则已禁用' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// ==================== 手动触发 ====================

exports.triggerRule = async (req, res) => {
  try {
    const rule = await notificationRuleService.getById(req.user.tenant_id, req.params.id);
    const result = await notificationDispatcher.dispatch(rule, req.body || {});
    res.json({ code: 0, data: result, message: '规则已触发' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// ==================== 日志 ====================

exports.listLogs = async (req, res) => {
  try {
    const { rule_id, page, page_size } = req.query;
    const result = await notificationRuleService.getLogs(req.user.tenant_id, {
      rule_id: rule_id ? parseInt(rule_id) : undefined,
      page: parseInt(page) || 1,
      pageSize: parseInt(page_size) || 20,
    });
    res.json({ code: 0, data: result });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

// ==================== 事件类型常量 ====================

exports.getEventTypes = async (req, res) => {
  const types = [
    { value: 'followup_overdue', label: '跟进逾期', description: '客户超过N天未跟进时触发' },
    { value: 'stage_changed', label: '阶段变更', description: '客户销售阶段变化时触发' },
    { value: 'deal_won', label: '成交', description: '客户成交时触发' },
    { value: 'task_due', label: '任务到期', description: '任务即将到期时触发' },
    { value: 'intent_high', label: '高意向', description: '客户意向分达到阈值时触发' },
    { value: 'customer_inactive', label: '客户流失风险', description: '客户N天无活动时触发' },
    { value: 'customer_created', label: '新客户创建', description: '新客户入库时触发' },
  ];
  res.json({ code: 0, data: types });
};
