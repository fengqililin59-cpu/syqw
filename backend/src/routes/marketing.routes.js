/**
 * @file 营销活动与模板路由。
 */
import { Router } from 'express';
import { createRequire } from 'module';
import { authenticateToken, authorizeTenant } from '../middleware/auth.js';

const require = createRequire(import.meta.url);
const ctrl = require('../controllers/marketing.controller.cjs');

const router = Router();

router.get('/campaigns', authenticateToken, authorizeTenant, ctrl.getCampaigns);
router.get('/campaigns/:id', authenticateToken, authorizeTenant, ctrl.getCampaign);
router.post('/campaigns', authenticateToken, authorizeTenant, ctrl.createCampaign);
router.put('/campaigns/:id', authenticateToken, authorizeTenant, ctrl.updateCampaign);
router.delete('/campaigns/:id', authenticateToken, authorizeTenant, ctrl.deleteCampaign);
router.post('/campaigns/:id/send', authenticateToken, authorizeTenant, ctrl.sendCampaign);
router.get('/campaigns/:id/stats', authenticateToken, authorizeTenant, ctrl.getCampaignStats);

router.get('/templates', authenticateToken, authorizeTenant, ctrl.getTemplates);
router.get('/templates/:id', authenticateToken, authorizeTenant, ctrl.getTemplate);
router.post('/templates', authenticateToken, authorizeTenant, ctrl.createTemplate);
router.put('/templates/:id', authenticateToken, authorizeTenant, ctrl.updateTemplate);
router.delete('/templates/:id', authenticateToken, authorizeTenant, ctrl.deleteTemplate);
router.post('/templates/:id/toggle', authenticateToken, authorizeTenant, ctrl.toggleTemplateActive);

router.get('/dashboard', authenticateToken, authorizeTenant, ctrl.getDashboard);

export default router;
