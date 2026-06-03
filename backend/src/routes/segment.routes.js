/**
 * @file 客户分群路由。
 */
import { Router } from 'express';
import { createRequire } from 'module';
import { authenticateToken, authorizeTenant } from '../middleware/auth.js';

const require = createRequire(import.meta.url);
const ctrl = require('../controllers/segment.controller.cjs');

const router = Router();

router.get('/', authenticateToken, authorizeTenant, ctrl.list);
router.post('/', authenticateToken, authorizeTenant, ctrl.create);
router.post('/preview', authenticateToken, authorizeTenant, ctrl.preview);
router.post('/refresh-all', authenticateToken, authorizeTenant, ctrl.refreshAll);
router.get('/:id', authenticateToken, authorizeTenant, ctrl.getById);
router.put('/:id', authenticateToken, authorizeTenant, ctrl.update);
router.delete('/:id', authenticateToken, authorizeTenant, ctrl.remove);
router.get('/:id/members', authenticateToken, authorizeTenant, ctrl.getMembers);
router.post('/:id/refresh', authenticateToken, authorizeTenant, ctrl.refreshMembers);

export default router;
