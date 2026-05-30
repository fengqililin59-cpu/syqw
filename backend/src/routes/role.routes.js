/**
 * @file 角色路由：供管理后台读取角色下拉数据。
 */
import { Router } from 'express';
import * as roleController from '../controllers/role.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requireAnyPerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth);
router.use(requireAnyPerm('user:manage', 'settings:manage'));

router.get('/catalog', asyncHandler(roleController.catalog));
/** 与 GET /catalog 相同，兼容文档路径 GET /roles/permissions */
router.get('/permissions', asyncHandler(roleController.catalog));
router.get('/', asyncHandler(roleController.list));
router.post('/grant-ai-employee-perms', asyncHandler(roleController.grantAiEmployeePerms));
router.post('/', asyncHandler(roleController.create));
router.put('/:id', asyncHandler(roleController.update));
router.delete('/:id', asyncHandler(roleController.remove));

export default router;
