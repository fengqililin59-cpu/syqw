/**
 * @file 邮件追踪 & 退订 公开路由（无需登录）。
 * - GET  /public/email-track/:trackId/open   → 追踪像素（1x1 GIF）
 * - GET  /public/email-track/:trackId/click  → 点击追踪 + 重定向
 * - GET  /public/unsubscribe/:contactValue   → 退订确认页
 * - POST /public/unsubscribe                 → 执行退订
 */
import { Router } from 'express';
import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';

const router = Router();

/** 1px 透明 GIF */
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// 追踪打开（邮件中嵌入 <img src=".../open" />）
router.get('/open/:trackId', async (req, res) => {
  const { trackId } = req.params;
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Expires', '0');
  res.send(PIXEL);

  try {
    const [msg] = await sequelize.query(
      `UPDATE marketing_messages
       SET status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
           opened_at = CASE WHEN opened_at IS NULL THEN NOW() ELSE opened_at END
       WHERE track_open_id = :trackId AND status = 'sent'`,
      { replacements: { trackId }, type: QueryTypes.UPDATE }
    );
    if (msg > 0) {
      // 同步活动级 open_count
      await sequelize.query(
        `UPDATE marketing_campaigns mc
         JOIN marketing_messages mm ON mm.campaign_id = mc.id
         SET mc.open_count = mc.open_count + 1
         WHERE mm.track_open_id = :trackId`,
        { replacements: { trackId }, type: QueryTypes.UPDATE }
      );
    }
  } catch { /* 追踪失败不影响像素返回 */ }
});

// 追踪点击（邮件中链接改为 /click/:trackId?url=...）
router.get('/click/:trackId', async (req, res) => {
  const { trackId } = req.params;
  const targetUrl = req.query.url || '/';

  try {
    await sequelize.query(
      `UPDATE marketing_messages
       SET status = CASE WHEN status IN ('sent','opened') THEN 'clicked' ELSE status END,
           clicked_at = CASE WHEN clicked_at IS NULL THEN NOW() ELSE clicked_at END
       WHERE track_click_id = :trackId AND status IN ('sent','opened')`,
      { replacements: { trackId }, type: QueryTypes.UPDATE }
    );
    await sequelize.query(
      `UPDATE marketing_campaigns mc
       JOIN marketing_messages mm ON mm.campaign_id = mc.id
       SET mc.click_count = mc.click_count + 1
       WHERE mm.track_click_id = :trackId`,
      { replacements: { trackId }, type: QueryTypes.UPDATE }
    );
  } catch { /* 追踪失败不影响跳转 */ }

  res.redirect(301, targetUrl);
});

// 退订确认
router.get('/unsubscribe/:contactValue', async (req, res) => {
  const { contactValue } = req.params;
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>取消订阅</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:60px auto;padding:20px;text-align:center;color:#333}h2{font-size:20px;margin-bottom:16px}p{font-size:14px;color:#666;margin-bottom:24px}button{background:#e24b4a;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:15px;cursor:pointer}button:hover{opacity:.9}</style></head>
<body>
  <h2>取消营销邮件订阅</h2>
  <p>确认取消 <strong>${escapeHtml(contactValue)}</strong> 的营销邮件订阅？</p>
  <form method="POST" action="/api/v1/public/unsubscribe">
    <input type="hidden" name="contactValue" value="${escapeHtml(contactValue)}">
    <button type="submit">确认取消订阅</button>
  </form>
</body></html>`);
});

// 执行退订
router.post('/unsubscribe', async (req, res) => {
  const contactValue = String(req.body?.contactValue || '').trim();
  if (!contactValue) {
    return res.status(400).send('<p>邮箱不能为空</p><a href="javascript:history.back()">返回</a>');
  }
  try {
    await sequelize.query(
      `INSERT IGNORE INTO marketing_optouts (tenant_id, contact_value, reason, created_at)
       SELECT DISTINCT tenant_id, :cv, '用户主动退订', NOW()
       FROM marketing_messages WHERE contact_value = :cv2 LIMIT 1`,
      { replacements: { cv: contactValue, cv2: contactValue }, type: QueryTypes.INSERT }
    );
  } catch { /* ignore */ }
  res.send(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>已取消订阅</title><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:480px;margin:60px auto;padding:20px;text-align:center;color:#333}h2{color:#1d9e75}</style></head>
<body><h2>已取消订阅</h2><p>您将不再收到来自我们的营销邮件。</p></body></html>`);
});

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export default router;
