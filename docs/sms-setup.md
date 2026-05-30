# 阿里云短信上线指南

## 1. 已开通确认
登录阿里云短信控制台：  
<https://dysms.console.aliyun.com>  
确认以下已就绪：
- 短信签名已审核通过（如「ZhiFlow」）
- 至少一个短信模板已审核通过
- 记录模板 Code（格式：SMS_xxxxxxxxx）

## 2. 获取 AccessKey
<https://ram.console.aliyun.com/manage/ak>  
建议新建子账号，只授权 `AliyunDysmsFullAccess`。  
不要用主账号 AK（安全风险）。

## 3. 系统配置
在 ZhiFlow 系统设置 -> 短信配置 填写：
- Access Key ID
- Access Key Secret
- 默认签名（与阿里云审核通过的签名一致）

或修改服务器 `.env`：

```env
SMS_MOCK=0
```

修改后重启后端：`pm2 restart all`

## 4. 在系统里录入模板
进入「短信营销」->「短信模板」->「新建模板」：
- 模板名称：自定义（如「活动邀请」）
- 阿里云模板 Code：`SMS_xxxxxxxxx`
- 签名名称：与阿里云一致
- 内容预览：粘贴模板内容原文
- 变量列表：填写变量名（如 `name,product`）

## 5. 发测试短信验证
设置页 -> 短信配置 ->「发测试短信」  
输入自己手机号确认收到。

## 6. 频控说明
- 同一手机号每分钟最多 1 条
- 同一手机号每天最多 10 条（阿里云限制）
- 群发任务建议错峰：避开早 8 点前和晚 10 点后

## 7. 回滚方式
如遇发送异常：

```env
SMS_MOCK=1
```

然后执行 `pm2 restart all`。  
任务会立即停止真实发送，切回 Mock 模式。
