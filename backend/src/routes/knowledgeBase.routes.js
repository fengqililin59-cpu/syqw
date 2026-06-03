/**
 * @file 知识库分类与文章路由。
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import { authenticateToken, authorizeTenant } from '../middleware/auth.js';

const require = createRequire(import.meta.url);
const ctrl = require('../controllers/knowledgeBase.controller.cjs');

const router = Router();

const kbPublicLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ code: 429, message: '请求过于频繁，请稍后再试' });
  },
});

/** 公开帮助中心（无需登录，?tenant=租户ID） */
router.get('/public/categories', kbPublicLimiter, ctrl.publicListCategories);
router.get('/public/articles', kbPublicLimiter, ctrl.publicListArticles);
router.get('/public/articles/:slug', kbPublicLimiter, ctrl.publicGetArticle);
router.post('/public/articles/:id/view', kbPublicLimiter, ctrl.publicTrackView);
router.post('/public/articles/:id/rate', kbPublicLimiter, ctrl.publicRateArticle);

router.get('/categories', authenticateToken, authorizeTenant, ctrl.listCategories);
router.get('/categories/:id', authenticateToken, authorizeTenant, ctrl.getCategory);
router.post('/categories', authenticateToken, authorizeTenant, ctrl.createCategory);
router.put('/categories/:id', authenticateToken, authorizeTenant, ctrl.updateCategory);
router.delete('/categories/:id', authenticateToken, authorizeTenant, ctrl.deleteCategory);

router.get('/articles', authenticateToken, authorizeTenant, ctrl.listArticles);
router.get('/articles/stats', authenticateToken, authorizeTenant, ctrl.articleStats);
router.get('/articles/featured', authenticateToken, authorizeTenant, ctrl.listFeatured);
router.get('/articles/recent', authenticateToken, authorizeTenant, ctrl.listRecent);
router.get('/articles/slug/:slug', authenticateToken, authorizeTenant, ctrl.getArticleBySlug);
router.get('/articles/:id', authenticateToken, authorizeTenant, ctrl.getArticle);
router.post('/articles', authenticateToken, authorizeTenant, ctrl.createArticle);
router.put('/articles/:id', authenticateToken, authorizeTenant, ctrl.updateArticle);
router.delete('/articles/:id', authenticateToken, authorizeTenant, ctrl.deleteArticle);
router.post('/articles/:id/publish', authenticateToken, authorizeTenant, ctrl.publishArticle);
router.post('/articles/:id/archive', authenticateToken, authorizeTenant, ctrl.archiveArticle);
router.post('/articles/:id/vote', authenticateToken, authorizeTenant, ctrl.voteHelpful);

export default router;
