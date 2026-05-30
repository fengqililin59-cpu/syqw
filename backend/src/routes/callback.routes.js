import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as callController from '../controllers/call.controller.js';
import * as publicInboxController from '../controllers/publicInbox.controller.js';

const router = Router();

router.post('/tccc', asyncHandler(callController.tcccCallback));
router.post('/inbox/:tenantId/:channel', asyncHandler(publicInboxController.ingest));

export default router;
