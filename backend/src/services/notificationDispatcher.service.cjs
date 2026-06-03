/**
 * @file 通知分发器 — 多渠道路由分发（站内 / 企微 / 浏览器 Push）
 */
const { createNotification } = require('./notification.service.js');
const browserPushService = require('./browserPush.service.cjs');
const notificationRuleService = require('./notificationRule.service.cjs');
const { User, Tenant } = require('../models/index.js');

class NotificationDispatcher {

  /**
   * 对单条规则执行分发（由 Cron 或事件触发调用）
   * @param {object} rule - NotificationRule 实例
   * @param {object} context - 外部传入的上下文（如 customer_id）
   */
  async dispatch(rule, context = {}) {
    // 1. 检查冷却时间
    if (rule.last_triggered_at) {
      const cooldownMs = (rule.cooldown_minutes || 60) * 60000;
      if (Date.now() - new Date(rule.last_triggered_at).getTime() < cooldownMs) {
        return { skipped: true, reason: 'cooldown' };
      }
    }

    // 2. 评估规则条件 + 解析接收人
    const { userIds, variables } = await notificationRuleService.evaluateRule(rule);

    if (userIds.length === 0) {
      return { skipped: true, reason: 'no_recipients' };
    }

    // 3. 获取用户详情 + 租户企微配置
    const users = await User.findAll({
      where: { id: userIds, tenant_id: rule.tenant_id },
      attributes: ['id', 'name', 'wework_userid'],
    });

    const tenant = await Tenant.findByPk(rule.tenant_id, {
      attributes: ['id', 'wework_corp_id', 'wework_secret', 'wework_agent_id'],
    });

    const channels = rule.channels || ['in_app'];
    const results = { in_app: 0, wecom: 0, browser: 0, errors: [] };

    // 4. 遍历每个接收人，通过各渠道发送
    for (const user of users) {
      // 渲染个性化模板
      const userVars = { ...variables, user_name: user.name };
      const title = notificationRuleService.renderTemplate(rule.template.title || '', userVars);
      const body = notificationRuleService.renderTemplate(rule.template.body || '', userVars);
      const link = notificationRuleService.renderTemplate(rule.template.link || '', userVars);

      // 渠道：站内通知
      if (channels.includes('in_app')) {
        try {
          await createNotification(rule.tenant_id, {
            recipient_user_id: user.id,
            type: 'system_notice',
            title,
            body,
            related_type: 'notification_rule',
            related_id: String(rule.id),
          });
          results.in_app++;
        } catch (e) {
          results.errors.push(`in_app[user=${user.id}]: ${e.message}`);
        }
      }

      // 渠道：企业微信
      if (channels.includes('wecom') && user.wework_userid && tenant?.wework_corp_id) {
        try {
          const wecomContent = `${title}\n\n${body}${link ? `\n\n查看详情: ${link}` : ''}`;
          const { sendAgentTextMessage } = await import('./wework.service.js');
          await sendAgentTextMessage(tenant, { touser: user.wework_userid, content: wecomContent });
          results.wecom++;
        } catch (e) {
          results.errors.push(`wecom[user=${user.id}]: ${e.message}`);
        }
      }

      // 渠道：浏览器 Push
      if (channels.includes('browser')) {
        try {
          const pushPayload = {
            title,
            body,
            icon: '/logo192.png',
            badge: '/logo192.png',
            data: { url: link || '/app/notifications', rule_id: rule.id },
            tag: `rule-${rule.id}`,
          };
          const pushResult = await browserPushService.sendToUser(user.id, pushPayload);
          results.browser += pushResult.success || 0;
        } catch (e) {
          results.errors.push(`browser[user=${user.id}]: ${e.message}`);
        }
      }
    }

    // 5. 更新规则状态
    rule.last_triggered_at = new Date();
    rule.trigger_count = (rule.trigger_count || 0) + 1;
    await rule.save();

    // 6. 记录日志
    const status = results.errors.length === 0 ? 'success'
      : results.errors.length < userIds.length ? 'partial' : 'failed';
    await notificationRuleService.logTrigger(
      rule, userIds.length, channels, status,
      results.errors.length > 0 ? results.errors.join('; ') : null,
    );

    return { dispatched: true, recipients: userIds.length, channels, results };
  }

  /**
   * 外部事件触发（如客户阶段变更）
   * @param {string} event - 事件类型
   * @param {object} context - 事件上下文
   */
  async triggerEvent(event, context) {
    const { NotificationRule } = require('../models/index.js');

    // JSON 字段查询需要 raw 方式
    const [allEventRules] = await NotificationRule.sequelize.query(
      `SELECT * FROM notification_rules WHERE enabled = 1 AND trigger_type = 'event' AND JSON_EXTRACT(trigger_config, '$.event') = :event`,
      { replacements: { event }, model: NotificationRule, mapToModel: true },
    );

    const results = [];
    for (const rule of allEventRules) {
      const result = await this.dispatch(rule, context);
      results.push({ rule_id: rule.id, rule_name: rule.name, ...result });
    }
    return results;
  }
}

module.exports = new NotificationDispatcher();
