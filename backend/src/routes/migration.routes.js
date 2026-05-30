/**
 * @file 迁移活动路由。
 */
import { Router } from 'express';
import * as migrationController from '../controllers/migration.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { migrationImportUpload } from '../middlewares/uploadMigrationImport.js';

const router = Router();

router.use(requireAuth);

router.post('/campaigns', requirePerm('campaign:manage'), asyncHandler(migrationController.createCampaign));
router.get('/campaigns', requirePerm('campaign:view'), asyncHandler(migrationController.listCampaigns));

router.get('/campaigns/:id/records', requirePerm('campaign:view'), asyncHandler(migrationController.listRecords));
router.post(
  '/campaigns/:id/import',
  requirePerm('campaign:manage'),
  migrationImportUpload.single('file'),
  asyncHandler(migrationController.importContacts),
);

router.put('/campaigns/:id', requirePerm('campaign:manage'), asyncHandler(migrationController.updateCampaign));
router.get('/campaigns/:id', requirePerm('campaign:view'), asyncHandler(migrationController.getCampaignDetail));

router.patch('/records/:id/status', requirePerm('campaign:manage'), asyncHandler(migrationController.updateRecordStatus));
router.get('/records/:id/script', requirePerm('ai:use'), asyncHandler(migrationController.generateScript));

export default router;
