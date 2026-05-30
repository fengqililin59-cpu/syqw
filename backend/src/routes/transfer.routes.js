/**
 * @file 客户转移路由（离职继承 / 重新分配）。
 */
import { Router } from 'express';
import * as transferController from '../controllers/transfer.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.use(requirePerm('user:manage'));

router.post('/', asyncHandler(transferController.createTransfer));
router.get('/', asyncHandler(transferController.listTransfers));
router.get('/:id', asyncHandler(transferController.getTransfer));

export default router;
