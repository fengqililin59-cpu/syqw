/**
 * @file 合同管理路由
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import * as ctrl from '../controllers/contract.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', requirePerm('contract:view'), ctrl.getContracts);
router.get('/:id', requirePerm('contract:view'), ctrl.getContract);
router.post('/', requirePerm('contract:manage'), ctrl.createContract);
router.put('/:id', requirePerm('contract:manage'), ctrl.updateContract);
router.delete('/:id', requirePerm('contract:manage'), ctrl.deleteContract);

export default router;
