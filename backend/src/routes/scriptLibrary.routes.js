/**
 * @file 话术库路由。
 */
import { Router } from 'express';
import * as scriptLibraryController from '../controllers/scriptLibrary.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth, requirePerm('ai:use'));

router.get('/industry-packs', asyncHandler(scriptLibraryController.listIndustryPacks));
router.post('/industry-packs/import', asyncHandler(scriptLibraryController.importIndustryPack));
router.get('/categories', asyncHandler(scriptLibraryController.categories));
router.get('/', asyncHandler(scriptLibraryController.list));
router.post('/', asyncHandler(scriptLibraryController.create));
router.put('/:id', asyncHandler(scriptLibraryController.update));
router.delete('/:id', asyncHandler(scriptLibraryController.remove));

export default router;
