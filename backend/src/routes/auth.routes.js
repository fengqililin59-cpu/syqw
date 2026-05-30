/**
 * @file 认证路由：注册、登录、登出、当前用户。
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/index.js';
import { ok } from '../utils/response.js';

const router = Router();

/** 登录限流：同 IP 每 15 分钟最多 20 次，防暴力破解 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请 15 分钟后再试', data: null },
});

/** OTP 限流：同 IP 每 10 分钟最多 5 次，防短信轰炸 */
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '验证码发送过于频繁，请稍后再试', data: null },
});

router.get('/register/options', asyncHandler(authController.registerOptions));
router.post('/register/send-otp', otpLimiter, asyncHandler(authController.sendRegisterOtp));
router.post('/register', loginLimiter, asyncHandler(authController.register));
router.post('/login', loginLimiter, asyncHandler(authController.login));
router.post('/guest-login', asyncHandler(authController.guestLogin));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', requireAuth, asyncHandler(authController.me));
router.get('/me/permissions', requireAuth, asyncHandler(authController.myPermissions));
router.post(
  '/exit-demo',
  requireAuth,
  asyncHandler(async (req, res) => {
    await User.update(
      { demo_mode: 0 },
      {
        where: {
          id: req.user.id,
          tenant_id: req.user.tenant_id,
        },
      },
    );
    return ok(res, { success: true });
  }),
);

export default router;
