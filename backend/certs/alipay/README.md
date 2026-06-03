# 支付宝当面付 证书目录

将以下文件放入此目录（或通过 `.env` 内联 PEM）：

| 文件 | 含义 |
|------|------|
| `app_private_key.pem` | **应用私钥**（你自己生成，勿泄露） |
| `alipay_public_key.pem` | **支付宝公钥**（开放平台保存应用公钥后，在页面上复制/下载） |
| `app_public_key_for_upload.pem` | 由 `npm run verify:alipay` 从私钥导出，仅用于上传到开放平台 |

## 常见错误：验签出错 / isv.invalid-signature

表示 **`.env` 里的应用私钥** 与 **开放平台已上传的应用公钥** 不是同一对密钥。

1. 在本机执行：`cd backend && npm run verify:alipay`
2. 将生成的 `app_public_key_for_upload.pem` 上传到开放平台 → 开发设置 → 接口加签方式 → 应用公钥（RSA2）
3. 保存后，把页面上的 **支付宝公钥** 写入 `alipay_public_key.pem` 或 `ALIPAY_PUBLIC_KEY`
4. ECS：`pm2 restart zhiflow-api`，再执行一次 `node scripts/verify-alipay.mjs` 应显示「网关验签: 通过」

**不要混淆：**

- 应用公钥 → 上传到支付宝（可由私钥导出）
- 应用私钥 → 只放在服务器 / `.env`，永远不要上传
- 支付宝公钥 → 只用于验签支付宝回调，不能代替应用公钥上传

## 环境变量

```bash
ALIPAY_APP_ID=你的应用ID
ALIPAY_SANDBOX=0          # 生产；沙箱填 1
# 二选一：内联 PEM 或文件路径（未设内联时自动读 certs 下默认文件）
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
# ALIPAY_PRIVATE_KEY_PATH=certs/alipay/app_private_key.pem
# ALIPAY_PUBLIC_KEY_PATH=certs/alipay/alipay_public_key.pem
BILLING_NOTIFY_BASE_URL=https://wework.syzs.top
```

回调地址：`https://wework.syzs.top/api/v1/billing/webhooks/alipay`

本地联调可设 `ALIPAY_MOCK=1`（勿用于生产）。

_此目录证书勿提交到公开仓库。_
