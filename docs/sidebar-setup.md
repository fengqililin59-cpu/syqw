# 企微侧边栏配置指南

## 1. 在企微管理后台配置

1. 登录企业微信管理后台。
2. 进入应用管理，选择对应自建应用。
3. 打开聊天工具栏配置，新增工具栏应用。
4. URL 填写：`https://your-domain.com/sidebar`
5. 可信域名填写：`your-domain.com`

## 2. 环境变量确认

确保 `backend/.env` 已配置：

- `WEWORK_CORP_ID=你的企业ID`
- `WEWORK_AGENT_ID=应用AgentID`
- `APP_URL=https://your-domain.com`

## 3. 销售使用方式

1. 在企微 PC 或手机端打开与客户聊天窗口。
2. 点击聊天窗口右上角工具栏图标。
3. 选择已配置的侧边栏应用。
4. 侧边栏自动展示客户画像与 AI 话术。

## 4. 注意事项

- 侧边栏 H5 必须使用 HTTPS。
- 域名必须加入企微可信域名列表。
- 员工首次使用需先完成企微授权登录。
- JS-SDK 签名 URL 必须和实际访问 URL 完全一致（不含 hash）。

## 5. token 读取说明

侧边栏 H5 使用 zustand persist 存储的 token：

- `localStorage` key：`auth-storage`
- 读取方式：

```ts
const raw = localStorage.getItem('auth-storage')
const token = raw ? JSON.parse(raw)?.state?.token : null
```

员工必须先在普通浏览器登录过系统，token 才会写入本地。若 token 不存在，侧边栏初始化会失败。后续可升级为企微免登录流程。

## 6. 免登录改造建议（后续）

当前版本先使用 localStorage token 方案快速上线验证。后续可增加 OAuth 静默授权：

1. 侧边栏检测 token 不存在。
2. 跳转 `/api/v1/wework/qr-login-url`（附带 `redirect_uri=/sidebar`）。
3. 企微 OAuth 完成后回调携带 token。
4. 前端写入 localStorage 并继续初始化侧边栏。
