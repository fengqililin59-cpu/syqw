/**
 * @file 通知规则路由。
 */
import { Router } from 'express';
import { createRequire } from 'module';
import { authenticateToken, authorizeTenant } from '../middleware/auth.js';

const require = createRequire(import.meta.url);
const ctrl = require('../controllers/notificationRule.controller.cjs');

const router = Router();

router.get('/event-types', authenticateToken, authorizeTenant, ctrl.getEventTypes);
router.get('/', authenticateToken, authorizeTenant, ctrl.listRules);
router.get('/logs', authenticateToken, authorizeTenant, ctrl.listLogs);
router.get('/:id', authenticateToken, authorizeTenant, ctrl.getRule);
router.post('/', authenticateToken, authorizeTenant, ctrl.createRule);
router.put('/:id', authenticateToken, authorizeTenant, ctrl.updateRule);
router.delete('/:id', authenticateToken, authorizeTenant, ctrl.deleteRule);
router.post('/:id/toggle', authenticateToken, authorizeTenant, ctrl.toggleRule);
router.post('/:id/trigger', authenticateToken, authorizeTenant, ctrl.triggerRule);

export default router;
