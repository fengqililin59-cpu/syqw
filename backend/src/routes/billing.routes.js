/**
 * @file 套餐计费路由（含余额、自动续费）。
 */
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { requirePlatformAdmin } from '../middlewares/requirePlatformAdmin.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as billingController from '../controllers/billing.controller.js';
import * as balanceController from '../controllers/balance.controller.js';
import * as addonController from '../controllers/addon.controller.js';

const router = Router();

router.get('/plans', asyncHandler(billingController.getPlans));
router.get('/payment/channels', asyncHandler(billingController.getPaymentChannels));

router.post(
  '/webhooks/wechat',
  asyncHandler(billingController.wechatPayWebhook),
);
router.post(
  '/webhooks/wechat/mock',
  asyncHandler(billingController.wechatPayMockWebhook),
);
router.post('/webhooks/alipay', asyncHandler(billingController.alipayPayWebhook));
router.post('/webhooks/alipay/mock', asyncHandler(billingController.alipayPayMockWebhook));

router.get('/wechat/mp-oauth-callback', asyncHandler(billingController.wechatMpOAuthCallback));

router.use(requireAuth);
router.get(
  '/wechat/jsapi-ready',
  requirePerm('settings:manage'),
  asyncHandler(billingController.getWechatJsapiReady),
);
router.get(
  '/wechat/mp-oauth-url',
  requirePerm('settings:manage'),
  asyncHandler(billingController.getWechatMpOAuthUrl),
);
router.get('/subscription', asyncHandler(billingController.getSubscription));
router.get('/usage', asyncHandler(billingController.getUsage));

router.post('/subscription', requirePlatformAdmin, asyncHandler(billingController.upsertSubscription));
router.post('/payment', requirePerm('settings:manage'), asyncHandler(billingController.createPayment));
router.get(
  '/payment/:outTradeNo/status',
  requirePerm('settings:manage'),
  asyncHandler(billingController.getPaymentStatus),
);
router.post('/payment/confirm', requirePlatformAdmin, asyncHandler(billingController.confirmPayment));
router.get('/payments', requirePerm('settings:manage'), asyncHandler(billingController.listPayments));
router.get(
  '/statement/export',
  requirePerm('settings:manage'),
  asyncHandler(billingController.exportSubscriptionStatement),
);
router.get(
  '/payments/pending-online',
  requirePerm('settings:manage'),
  asyncHandler(billingController.listPendingOnlinePayments),
);
router.post('/redeem', requirePerm('settings:manage'), asyncHandler(billingController.redeemPromo));
router.get(
  '/invoice-requests',
  requirePerm('settings:manage'),
  asyncHandler(billingController.listInvoiceRequests),
);
router.post(
  '/invoice-requests',
  requirePerm('settings:manage'),
  asyncHandler(billingController.createInvoiceRequest),
);
router.get(
  '/invoice-requests/:invoiceId/download',
  requirePerm('settings:manage'),
  asyncHandler(billingController.downloadInvoice),
);
router.get('/subscription/auto-invoice', asyncHandler(billingController.getAutoInvoice));
router.put('/subscription/auto-invoice', requirePerm('settings:manage'), asyncHandler(billingController.updateAutoInvoice));

router.get('/platform/pending-payments', requirePlatformAdmin, asyncHandler(billingController.listPendingPaymentsPlatform));
router.get('/platform/promo-codes', requirePlatformAdmin, asyncHandler(billingController.listPromoCodes));
router.post('/platform/promo-codes', requirePlatformAdmin, asyncHandler(billingController.createPromoCode));

// 用量加购包
router.get('/addons', asyncHandler(addonController.listAddonPackages));
router.get('/addons/mine', asyncHandler(addonController.getActiveAddons));
router.post('/addons/purchase', requirePerm('settings:manage'), asyncHandler(addonController.purchaseAddon));

// 余额系统
router.get('/balance', asyncHandler(balanceController.getBalance));
router.get('/balance/packages', asyncHandler(balanceController.listRechargePackages));
router.post('/balance/recharge', requirePerm('settings:manage'), asyncHandler(balanceController.createRecharge));
router.post('/balance/recharge-order', requirePerm('settings:manage'), asyncHandler(balanceController.createRechargeOrder));
router.get('/balance/transactions', requirePerm('settings:manage'), asyncHandler(balanceController.listTransactions));

// 自动续费
router.get('/subscription/auto-renew', asyncHandler(balanceController.getAutoRenew));
router.put('/subscription/auto-renew', requirePerm('settings:manage'), asyncHandler(balanceController.updateAutoRenew));

export default router;
