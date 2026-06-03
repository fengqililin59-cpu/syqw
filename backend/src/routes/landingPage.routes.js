/**
 * @file 落地页路由。
 * - 管理 API：/api/v1/landing-pages（需登录）
 * - 公开 API：/api/v1/public/landing（无需登录）
 */
import { Router } from 'express';
import { createRequire } from 'module';
import { authenticateToken, authorizeTenant } from '../middleware/auth.js';

const require = createRequire(import.meta.url);
const svc = require('../services/landingPage.service.cjs');
const { LandingPage, LandingSubmission, Customer } = require('../models/index.js');
const { Op } = require('sequelize');
const leadCaptureSvc = require('../services/leadCapture.service.js');

const router = Router();

// ===== 管理端 API =====

router.get('/', authenticateToken, authorizeTenant, async (req, res) => {
  const { page, pageSize, status, keyword } = req.query;
  const result = await svc.list(req.auth.tenantId, { page: +page, pageSize: +pageSize, status, keyword });
  res.json({ code: 0, data: result });
});

router.get('/:id', authenticateToken, authorizeTenant, async (req, res) => {
  const lp = await svc.get(req.auth.tenantId, req.params.id);
  res.json({ code: 0, data: lp });
});

router.post('/', authenticateToken, authorizeTenant, async (req, res) => {
  const lp = await svc.create(req.auth.tenantId, req.auth.userId, req.body);
  res.json({ code: 0, data: lp, message: '落地页创建成功' });
});

router.put('/:id', authenticateToken, authorizeTenant, async (req, res) => {
  const lp = await svc.update(req.auth.tenantId, req.params.id, req.body);
  res.json({ code: 0, data: lp, message: '更新成功' });
});

router.post('/:id/publish', authenticateToken, authorizeTenant, async (req, res) => {
  const lp = await svc.publish(req.auth.tenantId, req.params.id);
  res.json({ code: 0, data: lp, message: '已发布' });
});

router.post('/:id/unpublish', authenticateToken, authorizeTenant, async (req, res) => {
  const lp = await svc.unpublish(req.auth.tenantId, req.params.id);
  res.json({ code: 0, data: lp, message: '已下线' });
});

router.delete('/:id', authenticateToken, authorizeTenant, async (req, res) => {
  await svc.remove(req.auth.tenantId, req.params.id);
  res.json({ code: 0, message: '已删除' });
});

router.get('/:id/stats', authenticateToken, authorizeTenant, async (req, res) => {
  const stats = await svc.getStats(req.auth.tenantId, req.params.id);
  res.json({ code: 0, data: stats });
});

router.get('/:id/submissions', authenticateToken, authorizeTenant, async (req, res) => {
  const { page, pageSize } = req.query;
  const result = await svc.getSubmissions(req.auth.tenantId, {
    page: +page, pageSize: +pageSize, landingId: req.params.id,
  });
  res.json({ code: 0, data: result });
});

// ===== 公开 API =====

// 按 slug 获取落地页内容（前端渲染用）
router.get('/public/:slug', async (req, res) => {
  try {
    const lp = await LandingPage.findOne({
      where: { slug: req.params.slug, status: 'published' },
      attributes: { exclude: ['created_by'] },
    });
    if (!lp) return res.status(404).json({ code: 404, message: '页面不存在' });
    res.json({ code: 0, data: lp });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

// 记录访问量
router.post('/public/:slug/view', async (req, res) => {
  try {
    await LandingPage.increment('view_count', {
      where: { slug: req.params.slug, status: 'published' },
    });
    res.json({ code: 0 });
  } catch {
    res.json({ code: 0 });
  }
});

// 提交留资
router.post('/public/:slug/submit', async (req, res) => {
  try {
    const lp = await LandingPage.findOne({
      where: { slug: req.params.slug, status: 'published' },
    });
    if (!lp) return res.status(404).json({ code: 404, message: '页面不存在' });

    const formData = req.body;
    const submission = await LandingSubmission.create({
      tenant_id: lp.tenant_id,
      landing_id: lp.id,
      data: formData,
      ip: req.ip,
      user_agent: req.get('user-agent'),
      referer: req.get('referer'),
      utm_source: req.query.utm_source,
      utm_medium: req.query.utm_medium,
      utm_campaign: req.query.utm_campaign,
    });

    await LandingPage.increment('submit_count', { where: { id: lp.id } });

    // 尝试通过 leadCapture 创建客户
    try {
      if (leadCaptureSvc && leadCaptureSvc.handleLeadForm) {
        await leadCaptureSvc.handleLeadForm(lp.tenant_id, formData);
      }
    } catch { /* 留资失败不影响提交成功 */ }

    res.json({ code: 0, data: { id: submission.id }, message: lp.success_msg || '提交成功' });
  } catch (e) {
    res.status(500).json({ code: 500, message: e.message });
  }
});

export default router;
