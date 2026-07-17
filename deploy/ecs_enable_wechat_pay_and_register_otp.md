# ECS：开启微信支付 + 注册验证码

## 一、为什么线上没有「微信支付」？

计费页按钮来自接口 `GET /api/v1/billing/payment/channels`：

- `wechat.enabled === true` 才显示「微信支付」
- 后端 `isWechatPayConfigured()` 为真才 enabled

**本地**常见在 `backend/.env` 里设了 `WECHAT_PAY_MOCK=1`，所以能看到微信按钮。  
**线上**若未配置商户号且未开 MOCK，`wechat.enabled` 为 `false`，页面上就只有支付宝 / 线下 / 余额。

### 方案 A：生产真实收款（推荐上线前）

在 `/var/www/wework-saas/backend/.env` 增加（证书路径按实际）：

```bash
BILLING_NOTIFY_BASE_URL=https://wework.syzs.top
WECHAT_PAY_MCH_ID=你的商户号
WECHAT_PAY_APP_ID=公众号或小程序AppID
WECHAT_PAY_API_V3_KEY=32位APIv3密钥
WECHAT_PAY_SERIAL_NO=证书序列号
WECHAT_PAY_PRIVATE_KEY_PATH=certs/wechat/apiclient_key.pem
WECHAT_PAY_PLATFORM_CERT=   # 或粘贴平台证书 PEM
# 微信内 H5 支付（可选）
# WECHAT_MP_APP_SECRET=公众号AppSecret
```

```bash
pm2 restart syqw-api --update-env
curl -sS https://wework.syzs.top/api/v1/billing/payment/channels \
  -H "Authorization: Bearer 你的token" | head -c 400
```

应看到 `"wechat":{"enabled":true,...}`。

### 方案 B：仅联调（与支付宝 MOCK 类似）

```bash
WECHAT_PAY_MOCK=1
BILLING_NOTIFY_BASE_URL=https://wework.syzs.top
```

重启后计费页会出现「微信支付」，可走模拟成功（勿长期用于真实收款）。

---

## 二、为什么线上注册没有验证码？

注册页是否显示验证码由 `GET /api/v1/auth/register/options` 决定：

```json
{ "otpRequired": true, "channels": ["email"] }
```

- **本地**：`NODE_ENV` 非 production 时，即使没配 SMTP，开发环境也会兜底返回 `email`/`sms` 渠道，所以 localhost 能看到验证码。
- **线上**：`REGISTER_OTP_REQUIRED` 默认为 **0**（见 `backend/.env.production`），且 production **不会** 开发兜底，未配 SMTP/短信则 `otpRequired` 为 false。

### 开启步骤

1. 建表（若未执行过）：

```bash
sudo mysql wework_saas < /var/www/wework-saas-git/database/024_registration_otp_challenges.sql
```

2. 编辑 `/var/www/wework-saas/backend/.env`：

**邮箱验证码（任选其一发信方式）：**

```bash
REGISTER_OTP_REQUIRED=1
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=0
SMTP_USER=你的发信账号
SMTP_PASS=你的密码
SMTP_FROM="ZhiFlow <noreply@yourdomain.com>"
REGISTER_OTP_MAIL_SUBJECT=ZhiFlow 注册验证码
```

**或阿里云短信：**

```bash
REGISTER_OTP_REQUIRED=1
REGISTER_OTP_ALIYUN_KEY_ID=
REGISTER_OTP_ALIYUN_KEY_SECRET=
REGISTER_OTP_ALIYUN_SIGN_NAME=
REGISTER_OTP_ALIYUN_TEMPLATE_CODE=
```

3. 重启并验证：

```bash
pm2 restart syqw-api --update-env
curl -sS https://wework.syzs.top/api/v1/auth/register/options
```

应返回 `"otpRequired":true` 且 `channels` 非空。

4. 浏览器无痕打开 `https://wework.syzs.top/register`，应出现「获取验证码」。

---

## 三、本地与线上对齐清单

| 功能 | 本地 | 线上要一致 |
|------|------|------------|
| 微信支付按钮 | `WECHAT_PAY_MOCK=1` 或完整商户配置 | 同上写入 ECS `.env` |
| 注册验证码 | 开发环境自动兜底 | `REGISTER_OTP_REQUIRED=1` + SMTP 或阿里云 SMS |
| 前端 | `npm run dev` | `npm run build` + rsync 两处静态目录 |
