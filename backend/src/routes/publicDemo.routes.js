import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as publicDemoController from '../controllers/publicDemo.controller.js';

const router = Router();

router.get('/stats', asyncHandler(publicDemoController.stats));
router.get('/customers', asyncHandler(publicDemoController.customers));
router.get('/alerts', asyncHandler(publicDemoController.alerts));

export default router;
