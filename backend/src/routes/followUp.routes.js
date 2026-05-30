/**
 * @file 跟进记录路由：租户下全量列表（非嵌套在单客户路径下）。
 */
import { Router } from 'express';
import * as followUpController from '../controllers/followUp.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePerm('customer:view'), asyncHandler(followUpController.list));
router.get('/overdue', requirePerm('customer:view'), asyncHandler(followUpController.overdue));
router.get('/export', requirePerm('customer:export'), asyncHandler(followUpController.exportList));
router.delete('/:id', requirePerm('customer:delete'), asyncHandler(followUpController.remove));

export default router;
