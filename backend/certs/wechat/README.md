# 微信支付 API v3 证书目录

将以下文件放入此目录：

- `apiclient_key.pem` — 商户 API 私钥（从微信支付商户平台 → API安全 → API证书下载）
- `apiclient_cert.pem` — 商户 API 证书（可选，平台自动验证）
- `platform_cert.pem` — 微信支付平台证书（可选，用于回调验签）

**获取方式：**
1. 登录 [微信支付商户平台](https://pay.weixin.qq.com)
2. 进入「账户中心」→「API安全」→「API证书」
3. 下载证书压缩包，解压后得到 `apiclient_key.pem`

**环境变量说明：**
- `WECHAT_PAY_PRIVATE_KEY_PATH=./certs/wechat/apiclient_key.pem` — 私钥文件路径
- `WECHAT_PAY_PRIVATE_KEY=` — 也可直接粘贴 PEM 内容（替换换行为 \n）
- `WECHAT_PAY_PLATFORM_CERT=` — 平台证书 PEM 内容（用于回调验签，非必须）

**回调地址：** `https://wework.syzs.top/api/v1/billing/webhooks/wechat`

_此目录仅存放证书文件，不要提交到公开仓库。_
