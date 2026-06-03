/**
 * @file 余额与自动续费路由。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as balanceController from '../controllers/balance.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/balance', asyncHandler(balanceController.getBalance));
router.get('/balance/packages', asyncHandler(balanceController.listRechargePackages));
router.post('/balance/recharge', requirePerm('settings:manage'), asyncHandler(balanceController.createRecharge));
router.post('/balance/recharge-order', requirePerm('settings:manage'), asyncHandler(balanceController.createRechargeOrder));
router.get('/balance/transactions', requirePerm('settings:manage'), asyncHandler(balanceController.listTransactions));

router.get('/subscription/auto-renew', asyncHandler(balanceController.getAutoRenew));
router.put('/subscription/auto-renew', requirePerm('settings:manage'), asyncHandler(balanceController.updateAutoRenew));

export default router;
