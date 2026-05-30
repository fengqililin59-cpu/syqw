/**
 * @file 企微：扫码登录（公开）+ 接收消息回调（公开）+ 测试发消息（管理员）。
 */
import { Router } from 'express';
import * as weworkController from '../controllers/wework.controller.js';
import * as weworkMsgController from '../controllers/weworkMsg.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { requirePerm } from '../middlewares/requirePerm.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/qr-login-url', asyncHandler(weworkController.qrLoginUrl));
router.get('/callback', asyncHandler(weworkController.oauthCallback));

/** 客户联系 / 应用消息接收（需在企微后台配置与本租户 Token、EncodingAESKey 一致） */
router.get('/msg-callback', asyncHandler(weworkMsgController.verifyCallback));
// 企微回调：不挂 JWT，依赖 weworkMsgCrypto.service 验签保护
// 若验签失败 controller 已 400 拒绝，无需路由层鉴权
router.post(
  '/msg-callback',
  weworkMsgController.receiveCallbackBodyParser,
  asyncHandler(weworkMsgController.receiveCallback),
);

router.post('/test-send', requireAuth, requirePerm('settings:manage'), asyncHandler(weworkController.testSend));
router.get('/jssdk-signature', requireAuth, asyncHandler(weworkController.getJssdkSignature));

export default router;
