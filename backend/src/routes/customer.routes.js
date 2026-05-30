/**
 * @file 客户与跟进记录路由（需登录）。
 */
import { Router } from 'express';
import * as customerController from '../controllers/customer.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { requireQuota } from '../middlewares/requireQuota.js';
import { csvUpload } from '../middlewares/uploadCsv.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/customers/export', requirePerm('customer:export'), asyncHandler(customerController.exportList));
router.post('/customers/import-csv', requirePerm('customer:edit'), csvUpload.single('file'), asyncHandler(customerController.importCsv));
router.post('/customers/import/preview', requirePerm('customer:edit'), asyncHandler(customerController.importPreview));
router.post('/customers/import', requirePerm('customer:edit'), asyncHandler(customerController.importMany));

router.get('/customers', requirePerm('customer:view'), asyncHandler(customerController.list));
router.post('/customers', requirePerm('customer:edit'), requireQuota('customers'), asyncHandler(customerController.create));
router.get(
  '/customers/by-external-userid/:externalUserId',
  requirePerm('customer:view'),
  asyncHandler(customerController.getByExternalUserId),
);

router.get('/customers/:id/follow-ups', requirePerm('customer:view'), asyncHandler(customerController.listFollowUps));
router.get('/customers/:id/timeline', requirePerm('customer:view'), asyncHandler(customerController.timeline));
router.post('/customers/:id/follow-ups', requirePerm('customer:edit'), asyncHandler(customerController.createFollowUp));
router.post('/customers/:id/transfer', requirePerm('customer:edit'), asyncHandler(customerController.transfer));
router.put('/customers/:id/tags', requirePerm('customer:edit'), asyncHandler(customerController.setTags));

router.get('/customers/:id/messages', requirePerm('customer:view'), asyncHandler(customerController.listMessages));
router.post('/customers/:id/rollback-auto-deal', requirePerm('customer:edit'), asyncHandler(customerController.rollbackAutoDeal));

router.post('/customers/:id/score-intent', requirePerm('ai:use'), asyncHandler(customerController.scoreIntent));
router.get('/customers/:id/score-history', requirePerm('customer:view'), asyncHandler(customerController.scoreHistory));

router.get('/customers/:id', requirePerm('customer:view'), asyncHandler(customerController.detail));
router.put('/customers/:id', requirePerm('customer:edit'), asyncHandler(customerController.update));
router.delete('/customers/:id', requirePerm('customer:delete'), asyncHandler(customerController.remove));

export default router;
