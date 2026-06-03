/**
 * @file 通知规则服务 — 规则 CRUD + 条件评估引擎
 */
const { NotificationRule, NotificationRuleLog, User, Role, Customer, sequelize } = require('../models/index.js');
const { Op, fn, col, literal } = require('sequelize');

class NotificationRuleService {

  // ==================== CRUD ====================

  async list(tenantId, { enabled, trigger_type, page = 1, pageSize = 20 } = {}) {
    const where = { tenant_id: tenantId };
    if (enabled !== undefined) where.enabled = enabled;
    if (trigger_type) where.trigger_type = trigger_type;

    const { count, rows } = await NotificationRule.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      include: [{ association: 'creator', attributes: ['id', 'real_name', 'username'] }],
    });
    return { items: rows, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
  }

  async getById(tenantId, id) {
    const rule = await NotificationRule.findOne({
      where: { id, tenant_id: tenantId },
      include: [{ association: 'creator', attributes: ['id', 'real_name', 'username'] }],
    });
    if (!rule) throw new Error('规则不存在');
    return rule;
  }

  async create(tenantId, data) {
    return NotificationRule.create({
      tenant_id: tenantId,
      name: data.name,
      description: data.description || null,
      enabled: data.enabled !== false,
      trigger_type: data.trigger_type,
      trigger_config: data.trigger_config,
      channels: data.channels || ['in_app'],
      recipient_type: data.recipient_type || 'specific',
      recipient_config: data.recipient_config || {},
      template: data.template,
      priority: data.priority || 'normal',
      cooldown_minutes: data.cooldown_minutes ?? 60,
      max_per_run: data.max_per_run ?? 50,
      created_by: data.created_by,
    });
  }

  async update(tenantId, id, data) {
    const rule = await this.getById(tenantId, id);
    const fields = ['name', 'description', 'enabled', 'trigger_type', 'trigger_config',
      'channels', 'recipient_type', 'recipient_config', 'template',
      'priority', 'cooldown_minutes', 'max_per_run'];
    for (const f of fields) {
      if (data[f] !== undefined) rule[f] = data[f];
    }
    await rule.save();
    return this.getById(tenantId, id);
  }

  async delete(tenantId, id) {
    const rule = await this.getById(tenantId, id);
    await rule.destroy();
    return { success: true };
  }

  async toggle(tenantId, id) {
    const rule = await this.getById(tenantId, id);
    rule.enabled = !rule.enabled;
    await rule.save();
    return rule;
  }

  // ==================== 条件评估引擎 ====================

  /**
   * 评估单条规则，返回应通知的用户 ID 列表 + 变量上下文
   */
  async evaluateRule(rule) {
    const config = rule.trigger_config;
    let matchedUserIds = [];
    let variables = {}; // 模板变量上下文

    switch (rule.trigger_type) {
      case 'schedule':
        // 定时触发：不需要评估条件，直接解析接收人
        matchedUserIds = await this._resolveRecipients(rule);
        break;

      case 'event':
        // 事件触发：根据 event 类型评估
        const result = await this._evaluateEvent(rule, config);
        matchedUserIds = result.userIds;
        variables = result.variables;
        break;

      case 'cron':
        // Cron 表达式触发：类似 schedule
        matchedUserIds = await this._resolveRecipients(rule);
        break;

      default:
        break;
    }

    return { userIds: matchedUserIds, variables };
  }

  /**
   * 评估事件类型触发条件
   */
  async _evaluateEvent(rule, config) {
    const { event, filters = {} } = config;
    const userIds = [];
    let variables = {};

    switch (event) {
      case 'followup_overdue': {
        // 超过 N 天未跟进的客户
        const daysOverdue = filters.days_overdue || 7;
        const cutoff = new Date(Date.now() - daysOverdue * 86400000);

        const customers = await Customer.findAll({
          where: {
            tenant_id: rule.tenant_id,
            owner_id: { [Op.not]: null },
            [Op.or]: [
              { last_followup_at: { [Op.lt]: cutoff } },
              { last_followup_at: null, created_at: { [Op.lt]: cutoff } },
            ],
          },
          attributes: ['id', 'name', 'owner_id', 'stage', 'last_followup_at'],
          limit: rule.max_per_run,
          order: [['last_followup_at', 'ASC', 'NULLS FIRST']],
        });

        for (const c of customers) {
          if (!userIds.includes(c.owner_id)) userIds.push(c.owner_id);
        }

        variables = {
          _customers: customers.map(c => ({
            customer_id: c.id, customer_name: c.name, stage: c.stage,
            days: daysOverdue, last_followup: c.last_followup_at,
          })),
        };
        break;
      }

      case 'stage_changed': {
        // 客户阶段变更（由外部触发传入 customer_id）
        if (filters.customer_id) {
          const customer = await Customer.findByPk(filters.customer_id, {
            attributes: ['id', 'name', 'owner_id', 'stage'],
          });
          if (customer && customer.owner_id) {
            userIds.push(customer.owner_id);
            variables = {
              customer_id: customer.id, customer_name: customer.name, stage: customer.stage,
              old_stage: filters.old_stage || '', new_stage: filters.new_stage || customer.stage,
            };
          }
        }
        break;
      }

      case 'deal_won': {
        if (filters.customer_id) {
          const customer = await Customer.findByPk(filters.customer_id, {
            attributes: ['id', 'name', 'owner_id', 'stage'],
          });
          if (customer && customer.owner_id) {
            userIds.push(customer.owner_id);
            variables = { customer_id: customer.id, customer_name: customer.name };
          }
        }
        break;
      }

      case 'task_due': {
        // 任务到期提醒：查询 tasks 表中即将到期的任务
        const { Task } = require('../models/index.js');
        const hoursAhead = filters.hours_ahead || 24;
        const now = new Date();
        const deadline = new Date(now.getTime() + hoursAhead * 3600000);

        const tasks = await Task.findAll({
          where: {
            tenant_id: rule.tenant_id,
            due_date: { [Op.between]: [now, deadline] },
            status: { [Op.notIn]: ['done', 'cancelled'] },
            assignee_id: { [Op.not]: null },
          },
          attributes: ['id', 'title', 'assignee_id', 'due_date'],
          limit: rule.max_per_run,
        });

        for (const t of tasks) {
          if (!userIds.includes(t.assignee_id)) userIds.push(t.assignee_id);
        }
        variables = {
          _tasks: tasks.map(t => ({
            task_id: t.id, task_title: t.title, due_date: t.due_date,
          })),
        };
        break;
      }

      case 'intent_high': {
        // 高意向客户提醒（意向分 >= threshold）
        const { CustomerScore } = require('../models/index.js');
        const threshold = filters.min_score || 80;

        const scores = await CustomerScore.findAll({
          where: {
            tenant_id: rule.tenant_id,
            score_value: { [Op.gte]: threshold },
          },
          include: [{
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'owner_id', 'stage'],
            where: { owner_id: { [Op.not]: null } },
          }],
          limit: rule.max_per_run,
          order: [['score_value', 'DESC']],
        });

        for (const s of scores) {
          if (s.customer && !userIds.includes(s.customer.owner_id)) {
            userIds.push(s.customer.owner_id);
          }
        }
        variables = {
          _customers: scores.map(s => ({
            customer_id: s.customer?.id, customer_name: s.customer?.name,
            score: s.score_value,
          })),
        };
        break;
      }

      case 'customer_inactive': {
        // 客户流失风险：N 天无任何活动
        const daysInactive = filters.days_inactive || 30;
        const cutoff = new Date(Date.now() - daysInactive * 86400000);

        const customers = await Customer.findAll({
          where: {
            tenant_id: rule.tenant_id,
            owner_id: { [Op.not]: null },
            updated_at: { [Op.lt]: cutoff },
          },
          attributes: ['id', 'name', 'owner_id', 'stage', 'updated_at'],
          limit: rule.max_per_run,
          order: [['updated_at', 'ASC']],
        });

        for (const c of customers) {
          if (!userIds.includes(c.owner_id)) userIds.push(c.owner_id);
        }
        variables = {
          _customers: customers.map(c => ({
            customer_id: c.id, customer_name: c.name, stage: c.stage,
            days: daysInactive, last_activity: c.updated_at,
          })),
        };
        break;
      }

      case 'customer_created': {
        // 新客户创建通知（由外部触发）
        if (filters.customer_id) {
          const customer = await Customer.findByPk(filters.customer_id, {
            attributes: ['id', 'name', 'owner_id', 'stage', 'source'],
          });
          if (customer) {
            if (customer.owner_id) userIds.push(customer.owner_id);
            // 也可通知分配的角色
            variables = {
              customer_id: customer.id, customer_name: customer.name,
              stage: customer.stage, source: customer.source,
            };
          }
        }
        break;
      }

      default:
        break;
    }

    // 如果规则配置了接收人，则取交集
    const resolvedRecipients = await this._resolveRecipients(rule);
    if (resolvedRecipients.length > 0) {
      return {
        userIds: userIds.filter(uid => resolvedRecipients.includes(uid)),
        variables,
      };
    }

    return { userIds, variables };
  }

  // ==================== 接收人解析 ====================

  async _resolveRecipients(rule) {
    const config = rule.recipient_config || {};

    switch (rule.recipient_type) {
      case 'specific':
        return config.user_ids || [];

      case 'role': {
        if (!config.role_id) return [];
        const users = await User.findAll({
          where: { tenant_id: rule.tenant_id, role_id: config.role_id },
          attributes: ['id'],
        });
        return users.map(u => u.id);
      }

      case 'owner':
        // 由事件评估时动态确定（事件已经返回了 owner）
        return [];

      case 'all': {
        const users = await User.findAll({
          where: { tenant_id: rule.tenant_id },
          attributes: ['id'],
        });
        return users.map(u => u.id);
      }

      default:
        return [];
    }
  }

  // ==================== 模板渲染 ====================

  /**
   * 将模板字符串中的 {{variable}} 替换为实际值
   */
  renderTemplate(template, variables) {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value ?? '');
    }
    return result;
  }

  // ==================== 日志 ====================

  async logTrigger(rule, recipientsCount, channelsUsed, status, errorMessage) {
    return NotificationRuleLog.create({
      tenant_id: rule.tenant_id,
      rule_id: rule.id,
      recipients_count: recipientsCount,
      channels_used: channelsUsed,
      status,
      error_message: errorMessage || null,
    });
  }

  async getLogs(tenantId, { rule_id, page = 1, pageSize = 20 } = {}) {
    const where = { tenant_id: tenantId };
    if (rule_id) where.rule_id = rule_id;

    const { count, rows } = await NotificationRuleLog.findAndCountAll({
      where,
      order: [['triggered_at', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      include: [{ association: 'rule', attributes: ['id', 'name'] }],
    });
    return { items: rows, total: count, page, pageSize, totalPages: Math.ceil(count / pageSize) };
  }
}

module.exports = new NotificationRuleService();
