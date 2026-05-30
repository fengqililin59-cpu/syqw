# 腾讯云 TCCC 外呼开通指南

## 1. 开通步骤

1. 登录腾讯云控制台  
   <https://cloud.tencent.com/product/tccc>

2. 开通「云呼叫中心 TCCC」
   - 选择「自建呼叫中心」方案
   - 申请客服电话号码（约 100元/月）
   - 记录 SDK App ID

3. 创建 API 密钥  
   <https://console.cloud.tencent.com/cam/capi>
   - 记录 SecretId 和 SecretKey

4. 配置话单回调地址  
   在 TCCC 控制台 -> 系统配置 -> 话单推送  
   填写：`https://your-domain.com/api/v1/callback/tccc`

## 2. 系统配置

在 ZhiFlow 系统设置 -> TCCC 配置 填写：
- SDK App ID
- Secret ID
- Secret Key（保密）
- 客服号码（格式：075512345678）

或直接修改服务器 `backend/.env`：

```env
TCCC_MOCK=0
TCCC_SDK_APP_ID=你的AppID
TCCC_SECRET_ID=你的SecretId
TCCC_SECRET_KEY=你的SecretKey
TCCC_SERVER_NUMBER=客服号码
```

修改后重启后端：`pm2 restart all`

## 3. 销售员工设置

每位销售登录后，进入设置 -> 外呼设置：
- 选择「手机接听」并填写本人手机号
- 或选择「网页软电话」（需要麦克风权限）

## 4. 测试验证

发起一通测试电话：
- 确认销售手机收到来电
- 接听后客户端有来电
- 通话结束后系统自动记录通话时长
- 客户跟进记录自动更新
