/**
 * @file 浏览器 Push 订阅 Controller — 订阅管理 + VAPID 公钥
 */
const browserPushService = require('../services/browserPush.service.cjs');

/**
 * 获取 VAPID 公钥（前端 Service Worker 注册时使用）
 */
exports.getVapidPublicKey = async (req, res) => {
  try {
    const publicKey = browserPushService.getPublicKey();
    if (!publicKey) {
      return res.status(400).json({ code: 400, message: 'VAPID 密钥未配置' });
    }
    res.json({ code: 0, data: { publicKey } });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

/**
 * 保存浏览器 Push 订阅
 */
exports.subscribe = async (req, res) => {
  try {
    const result = await browserPushService.subscribe(
      req.user.tenant_id,
      req.user.id,
      req.body,
    );
    res.json({ code: 0, data: result, message: '订阅成功' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

/**
 * 取消浏览器 Push 订阅
 */
exports.unsubscribe = async (req, res) => {
  try {
    const result = await browserPushService.unsubscribe(
      req.user.tenant_id,
      req.user.id,
      req.body.endpoint,
    );
    res.json({ code: 0, data: result, message: '已取消订阅' });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};

/**
 * 获取当前用户的订阅状态
 */
exports.getStatus = async (req, res) => {
  try {
    const stats = await browserPushService.getStats(req.user.tenant_id, req.user.id);
    res.json({ code: 0, data: stats });
  } catch (err) {
    res.status(500).json({ code: 500, message: err.message });
  }
};
