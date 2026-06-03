const { MarketingCampaign, MarketingMessage, MessageTemplate, Customer, MarketingOptOut, User, sequelize } = require('../models/index.js');
const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

/** 邮件追踪基础 URL（前端域名，也可通过 env 配置） */
const TRACK_BASE = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',')[0].trim()
  : process.env.APP_BASE_URL || 'http://localhost:3000';

function createMailTransport() {
  const host = (process.env.SMTP_HOST || '').trim();
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === '1' || String(process.env.SMTP_PORT) === '465',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
}

class MarketingCampaignService {
  // 获取活动列表
  async getCampaigns(tenantId, { page = 1, pageSize = 20, type, status, keyword } = {}) {
    const where = { tenant_id: tenantId };
    if (type) where.type = type;
    if (status) where.status = status;
    if (keyword) where.name = { [Op.like]: `%${keyword}%` };

    const { rows, count } = await MarketingCampaign.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'real_name'], required: false }],
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return { list: rows, total: count, page, size: pageSize };
  }

  // 获取单个活动
  async getCampaign(tenantId, campaignId) {
    const campaign = await MarketingCampaign.findOne({
      where: { id: campaignId, tenant_id: tenantId },
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'real_name'], required: false },
        { model: MessageTemplate, as: 'template' },
      ],
    });
    if (!campaign) throw new Error('活动不存在');
    return campaign;
  }

  // 创建活动
  async createCampaign(tenantId, userId, data) {
    const campaign = await MarketingCampaign.create({
      tenant_id: tenantId,
      created_by: userId,
      ...data,
      status: 'draft',
    });

    // 计算目标客户数量
    if (data.target_filter) {
      const targetCount = await this._countTargetCustomers(tenantId, data.target_filter);
      await campaign.update({ target_count: targetCount });
    }

    return this.getCampaign(tenantId, campaign.id);
  }

  // 更新活动
  async updateCampaign(tenantId, campaignId, data) {
    const campaign = await MarketingCampaign.findOne({
      where: { id: campaignId, tenant_id: tenantId },
    });
    if (!campaign) throw new Error('活动不存在');
    if (!['draft', 'scheduled'].includes(campaign.status)) {
      throw new Error('只能编辑草稿或已排期的活动');
    }

    await campaign.update(data);

    // 重新计算目标客户数量
    if (data.target_filter) {
      const targetCount = await this._countTargetCustomers(tenantId, data.target_filter);
      await campaign.update({ target_count: targetCount });
    }

    return this.getCampaign(tenantId, campaign.id);
  }

  // 删除活动
  async deleteCampaign(tenantId, campaignId) {
    const campaign = await MarketingCampaign.findOne({
      where: { id: campaignId, tenant_id: tenantId },
    });
    if (!campaign) throw new Error('活动不存在');
    if (['sending', 'sent'].includes(campaign.status)) {
      throw new Error('已发送的活动不能删除');
    }
    await campaign.destroy();
  }

  // 发送活动（模拟发送，实际应调用邮件/短信服务）
  async sendCampaign(tenantId, campaignId) {
    const campaign = await MarketingCampaign.findOne({
      where: { id: campaignId, tenant_id: tenantId },
    });
    if (!campaign) throw new Error('活动不存在');
    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('活动状态不允许发送');
    }

    // 获取目标客户
    const customers = await this._getTargetCustomers(tenantId, campaign.target_filter || {});
    
    // 创建发送记录
    const messages = [];
    for (const customer of customers) {
      const contactValue = campaign.type === 'email' ? customer.email : customer.phone;
      if (!contactValue) continue;

      // 检查退订
      const optOut = await MarketingOptOut.findOne({
        where: { tenant_id: tenantId, contact_value: contactValue },
      });
      if (optOut) continue;

      // 变量替换
      let content = campaign.content || '';
      let subject = campaign.subject || '';
      content = content.replace(/\{\{customer_name\}\}/g, customer.name || '');
      content = content.replace(/\{\{company_name\}\}/g, customer.company || '');
      subject = subject.replace(/\{\{customer_name\}\}/g, customer.name || '');
      subject = subject.replace(/\{\{company_name\}\}/g, customer.company || '');

      const trackOpenId = crypto.randomBytes(12).toString('hex');
      const trackClickId = crypto.randomBytes(12).toString('hex');

      const message = await MarketingMessage.create({
        tenant_id: tenantId,
        campaign_id: campaignId,
        customer_id: customer.id,
        contact_value: contactValue,
        subject,
        content,
        status: 'pending',
        track_open_id: trackOpenId,
        track_click_id: trackClickId,
      });
      messages.push({ message, contactValue, trackOpenId, trackClickId });
    }

    // 更新活动状态（先更新再发送，避免前端看到不一致状态）
    await campaign.update({
      status: 'sending',
      sent_count: messages.length,
      sent_at: new Date(),
    });

    // 实际发送邮件
    const smtpConfigured = (process.env.SMTP_HOST || '').trim();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || '';

    if (campaign.type === 'email' && smtpConfigured) {
      await this._sendEmails(campaign, messages, fromAddress);
    } else if (campaign.type === 'email') {
      // SMTP 未配置，标记为已发送（演示模式）
      for (const { message } of messages) {
        await message.update({ status: 'sent', sent_at: new Date() });
      }
      await campaign.update({ status: 'sent', sent_at: new Date() });
    }

    return { sent_count: messages.length };
  }

  // 实际邮件发送
  async _sendEmails(campaign, messages, fromAddress) {
    const transport = createMailTransport();
    if (!transport) return;

    let sentCount = 0;
    let bounceCount = 0;
    const apiBase = TRACK_BASE.replace(/\/+$/, '');

    for (const { message, contactValue, trackOpenId, trackClickId } of messages) {
      try {
        let html = message.content || '';
        // 注入追踪像素
        const openPixel = `<img src="${apiBase}/api/v1/public/email-track/open/${trackOpenId}" width="1" height="1" alt="" style="display:none" />`;
        html = html.replace('</body>', openPixel + '</body>');
        if (!html.includes('</body>')) html += openPixel;

        // 替换链接为追踪链接（简单替换 http/https 开头的链接）
        html = html.replace(
          /href="(https?:\/\/[^"]+)"/g,
          `href="${apiBase}/api/v1/public/email-track/click/${trackClickId}?url=$1"`
        );

        // 追加退订链接
        const unsubscribeLink = `${apiBase}/api/v1/public/unsubscribe/${encodeURIComponent(contactValue)}`;
        const unsubscribeHtml = `<br><br><hr style="border:none;border-top:1px solid #e0e0e0"><p style="font-size:12px;color:#999">如果您不想再收到此类邮件，可以<a href="${unsubscribeLink}" style="color:#999">取消订阅</a>。</p>`;
        html = html.replace('</body>', unsubscribeHtml + '</body>');
        if (!html.includes('</body>')) html += unsubscribeHtml;

        const subject = message.subject || campaign.subject || '';

        await transport.sendMail({
          from: fromAddress || undefined,
          to: contactValue,
          subject,
          html,
        });

        await message.update({ status: 'sent', sent_at: new Date(), content: html });
        sentCount++;
      } catch (e) {
        const errMsg = String(e?.message || e).slice(0, 500);
        await message.update({ status: 'failed', error_message: errMsg });
        bounceCount++;
      }
    }

    await campaign.update({ status: 'sent', sent_at: new Date(), bounce_count: bounceCount });
  }

  // 获取活动统计
  async getCampaignStats(tenantId, campaignId) {
    const campaign = await MarketingCampaign.findOne({
      where: { id: campaignId, tenant_id: tenantId },
    });
    if (!campaign) throw new Error('活动不存在');

    const messageStats = await MarketingMessage.findAll({
      where: { campaign_id: campaignId, tenant_id: tenantId },
      attributes: [
        'status',
        [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    return {
      campaign: campaign.toJSON(),
      message_stats: messageStats,
    };
  }

  // 营销看板分析
  async getDashboardAnalytics(tenantId, { days = 30 } = {}) {
    // 1. 汇总指标
    const [summary] = await sequelize.query(`
      SELECT
        COUNT(*)                                                      AS total_sent,
        SUM(CASE WHEN mm.status IN ('opened','clicked') THEN 1 ELSE 0 END) AS total_opened,
        SUM(CASE WHEN mm.status = 'clicked' THEN 1 ELSE 0 END)        AS total_clicked,
        SUM(CASE WHEN mm.status = 'bounced' THEN 1 ELSE 0 END)        AS total_bounced
      FROM marketing_messages mm
      JOIN marketing_campaigns mc ON mc.id = mm.campaign_id
      WHERE mm.tenant_id = :tenantId
        AND mm.status IN ('sent','opened','clicked','bounced')
        AND mm.sent_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
    `, { replacements: { tenantId, days }, type: QueryTypes.SELECT });

    // 退订数
    const [optOutRow] = await sequelize.query(`
      SELECT COUNT(*) AS total_unsubscribed
      FROM marketing_optouts
      WHERE tenant_id = :tenantId
        AND created_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
    `, { replacements: { tenantId, days }, type: QueryTypes.SELECT });

    const totalSent       = Number(summary.total_sent) || 0;
    const totalOpened     = Number(summary.total_opened) || 0;
    const totalClicked    = Number(summary.total_clicked) || 0;
    const totalBounced    = Number(summary.total_bounced) || 0;
    const totalUnsub      = Number(optOutRow.total_unsubscribed) || 0;
    const openRate        = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
    const clickRate       = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0';
    const bounceRate      = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : '0.0';

    // 2. 每日趋势（按 sent_at 日期分组）
    const trendRows = await sequelize.query(`
      SELECT
        DATE(mm.sent_at)                                                       AS date,
        COUNT(*)                                                               AS sent,
        SUM(CASE WHEN mm.status IN ('opened','clicked') THEN 1 ELSE 0 END)     AS opened,
        SUM(CASE WHEN mm.status = 'clicked' THEN 1 ELSE 0 END)                 AS clicked,
        SUM(CASE WHEN mm.status = 'bounced' THEN 1 ELSE 0 END)                 AS bounced
      FROM marketing_messages mm
      JOIN marketing_campaigns mc ON mc.id = mm.campaign_id
      WHERE mm.tenant_id = :tenantId
        AND mm.status IN ('sent','opened','clicked','bounced')
        AND mm.sent_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
      GROUP BY DATE(mm.sent_at)
      ORDER BY date ASC
    `, { replacements: { tenantId, days }, type: QueryTypes.SELECT });

    const trend = trendRows.map(r => ({
      date: r.date,
      sent: Number(r.sent),
      opened: Number(r.opened),
      clicked: Number(r.clicked),
      bounced: Number(r.bounced),
      open_rate: Number(r.sent) > 0 ? ((Number(r.opened) / Number(r.sent)) * 100).toFixed(1) : '0.0',
      click_rate: Number(r.sent) > 0 ? ((Number(r.clicked) / Number(r.sent)) * 100).toFixed(1) : '0.0',
    }));

    // 3. 活动排行榜（按打开率排序，最近 90 天）
    const campaignRows = await sequelize.query(`
      SELECT
        mc.id,
        mc.name,
        mc.type,
        mc.sent_count,
        mc.open_count,
        mc.click_count,
        mc.bounce_count,
        ROUND(IF(mc.sent_count > 0, mc.open_count / mc.sent_count * 100, 0), 1)  AS open_rate,
        ROUND(IF(mc.sent_count > 0, mc.click_count / mc.sent_count * 100, 0), 1) AS click_rate,
        mc.sent_at
      FROM marketing_campaigns mc
      WHERE mc.tenant_id = :tenantId
        AND mc.status = 'sent'
        AND mc.sent_count > 0
        AND mc.sent_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      ORDER BY open_rate DESC
      LIMIT 20
    `, { replacements: { tenantId }, type: QueryTypes.SELECT });

    // 4. 按渠道汇总
    const channelRows = await sequelize.query(`
      SELECT
        mc.type,
        SUM(mc.sent_count)                                                                      AS sent,
        SUM(mc.open_count)                                                                      AS opened,
        SUM(mc.click_count)                                                                     AS clicked,
        ROUND(IF(SUM(mc.sent_count) > 0, SUM(mc.open_count) / SUM(mc.sent_count) * 100, 0), 1) AS open_rate,
        ROUND(IF(SUM(mc.sent_count) > 0, SUM(mc.click_count) / SUM(mc.sent_count) * 100, 0), 1) AS click_rate
      FROM marketing_campaigns mc
      WHERE mc.tenant_id = :tenantId
        AND mc.status = 'sent'
        AND mc.sent_at >= DATE_SUB(NOW(), INTERVAL :days DAY)
      GROUP BY mc.type
    `, { replacements: { tenantId, days }, type: QueryTypes.SELECT });

    return {
      summary: {
        total_sent: totalSent,
        total_opened: totalOpened,
        total_clicked: totalClicked,
        total_bounced: totalBounced,
        total_unsubscribed: totalUnsub,
        open_rate: openRate,
        click_rate: clickRate,
        bounce_rate: bounceRate,
      },
      trend,
      campaigns: campaignRows,
      channels: channelRows,
    };
  }

  // 私有方法：计算目标客户数量
  async _countTargetCustomers(tenantId, targetFilter) {
    const where = { tenant_id: tenantId };
    if (targetFilter.tags && targetFilter.tags.length > 0) {
      // 简化：假设客户有tags字段
    }
    if (targetFilter.stage) where.stage = targetFilter.stage;
    if (targetFilter.source) where.source = targetFilter.source;
    
    return await Customer.count({ where });
  }

  // 私有方法：获取目标客户列表
  async _getTargetCustomers(tenantId, targetFilter) {
    const where = { tenant_id: tenantId };
    if (targetFilter.tags && targetFilter.tags.length > 0) {
      // 简化：假设客户有tags字段
    }
    if (targetFilter.stage) where.stage = targetFilter.stage;
    if (targetFilter.source) where.source = targetFilter.source;
    
    return await Customer.findAll({ where, limit: 1000 });
  }
}

module.exports = new MarketingCampaignService();
