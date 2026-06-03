/**
 * @file 浏览器 Web Push 服务 — 基于 VAPID 协议的推送通知
 *
 * 使用 Web Push API (RFC 8291) 向已订阅的浏览器推送通知。
 * VAPID 密钥对使用环境变量配置，首次运行时自动生成。
 */
const webpush = require('web-push');
const { BrowserPushSubscription } = require('../models/index.js');
const { env } = require('../config/env.js');

// VAPID 密钥配置
const VAPID_SUBJECT = env.vapidSubject || 'mailto:admin@example.com';
const VAPID_PUBLIC_KEY = env.vapidPublicKey || '';
const VAPID_PRIVATE_KEY = env.vapidPrivateKey || '';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    vapidConfigured = true;
    return true;
  }
  // 自动生成密钥对（内存中，重启后会重置）
  if (!VAPID_PUBLIC_KEY && !VAPID_PRIVATE_KEY) {
    const keys = webpush.generateVAPIDKeys();
    webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
    // 暴露公钥供前端获取
    module.exports._autoPublicKey = keys.publicKey;
    vapidConfigured = true;
    console.log('[browser-push] Auto-generated VAPID keys (ephemeral)');
    return true;
  }
  return false;
}

class BrowserPushService {

  /**
   * 获取 VAPID 公钥（供前端订阅时使用）
   */
  getPublicKey() {
    if (!VAPID_PUBLIC_KEY && this._autoPublicKey) return this._autoPublicKey;
    return VAPID_PUBLIC_KEY;
  }

  /**
   * 保存浏览器 Push 订阅
   */
  async subscribe(tenantId, userId, subscription) {
    const { endpoint, keys } = subscription;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      throw new Error('无效的 PushSubscription 对象');
    }

    // Upsert: 同一 endpoint 的订阅只保留一条
    const [sub] = await BrowserPushSubscription.findOrCreate({
      where: { user_id: userId, endpoint },
      defaults: {
        tenant_id: tenantId,
        user_id: userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: subscription.user_agent || null,
        device_name: subscription.device_name || null,
        is_active: true,
        last_used_at: new Date(),
      },
    });

    if (!sub._options.isNewRecord) {
      // 更新已有订阅
      await sub.update({
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: subscription.user_agent || sub.user_agent,
        device_name: subscription.device_name || sub.device_name,
        is_active: true,
        last_used_at: new Date(),
      });
    }

    return { success: true, id: sub.id };
  }

  /**
   * 取消订阅
   */
  async unsubscribe(tenantId, userId, endpoint) {
    const sub = await BrowserPushSubscription.findOne({
      where: { user_id: userId, endpoint },
    });
    if (sub) {
      sub.is_active = false;
      await sub.save();
    }
    return { success: true };
  }

  /**
   * 获取用户的所有活跃订阅
   */
  async getUserSubscriptions(userId) {
    return BrowserPushSubscription.findAll({
      where: { user_id: userId, is_active: true },
    });
  }

  /**
   * 向指定用户推送浏览器通知
   * @param {number} userId
   * @param {object} payload - { title, body, icon, badge, data, tag }
   */
  async sendToUser(userId, payload) {
    if (!ensureVapid()) {
      return { success: 0, failed: 0, reason: 'VAPID not configured' };
    }

    const subscriptions = await this.getUserSubscriptions(userId);
    if (subscriptions.length === 0) {
      return { success: 0, failed: 0, reason: 'no_subscriptions' };
    }

    const pushPayload = JSON.stringify({
      title: payload.title || '新通知',
      body: payload.body || '',
      icon: payload.icon || '/logo192.png',
      badge: payload.badge || '/logo192.png',
      data: payload.data || {},
      tag: payload.tag || 'default',
      timestamp: Date.now(),
    });

    let success = 0;
    let failed = 0;
    const deadIds = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
        );
        success++;
        // 更新最后使用时间
        sub.last_used_at = new Date();
        await sub.save();
      } catch (e) {
        failed++;
        // 410 Gone 或 404: 订阅已失效
        if (e.statusCode === 410 || e.statusCode === 404) {
          deadIds.push(sub.id);
        }
      }
    }

    // 清理失效订阅
    if (deadIds.length > 0) {
      await BrowserPushSubscription.update(
        { is_active: false },
        { where: { id: deadIds } },
      );
    }

    return { success, failed, deadSubscriptions: deadIds.length };
  }

  /**
   * 获取用户订阅统计
   */
  async getStats(tenantId, userId) {
    const count = await BrowserPushSubscription.count({
      where: { user_id: userId, is_active: true },
    });
    return { active_subscriptions: count };
  }
}

module.exports = new BrowserPushService();
