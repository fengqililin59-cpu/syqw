/**
 * @file 浏览器 Push 订阅路由。
 */
import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ctrl = require('../controllers/browserPush.controller.cjs');

const router = Router();

router.use(requireAuth);

router.get('/vapid-public-key', requirePerm('customer:read'), asyncHandler(ctrl.getVapidPublicKey));
router.get('/status', requirePerm('customer:read'), asyncHandler(ctrl.getStatus));
router.post('/subscribe', requirePerm('customer:read'), asyncHandler(ctrl.subscribe));
router.post('/unsubscribe', requirePerm('customer:read'), asyncHandler(ctrl.unsubscribe));

export default router;
