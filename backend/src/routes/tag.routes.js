/**
 * @file 客户标签路由。
 */
import { Router } from 'express';
import * as tagController from '../controllers/tag.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/categories', requirePerm('customer:view'), asyncHandler(tagController.categories));
router.get('/', requirePerm('customer:view'), asyncHandler(tagController.list));
router.post('/', requirePerm('customer:edit'), asyncHandler(tagController.create));
router.put('/:id', requirePerm('customer:edit'), asyncHandler(tagController.update));
router.delete('/:id', requirePerm('customer:edit'), asyncHandler(tagController.remove));

export default router;
