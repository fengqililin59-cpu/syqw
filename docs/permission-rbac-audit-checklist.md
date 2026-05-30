# RBAC 路由审计对照清单

用于联调与回归：确认「后端接口守卫」与「前端入口可见性」一致，避免出现按钮可见但接口 403，或按钮不可见但接口可调用的问题。

## 审计范围

- 后端：`backend/src/routes`
- 前端：`frontend/src/components/layout/DashboardLayout.tsx`、`frontend/src/pages/*`
- 审计口径：仅统计已显式使用 `requirePerm(...)` 的受保护接口

## 权限点与后端接口

- `settings:manage`
  - `/roles` 全部接口（角色管理）
  - `/users` 全部接口（员工管理）
  - `/settings/wework` 读写
  - `/sync/customers`
  - `/ads/spend/bulk`、`/ads/spend/sync/tencent`
  - `/ads/jobs/summary`、`/ads/jobs`、`/ads/rollup/run-daily`
  - `/wework/test-send`

- `audit:view`
  - `/settings/audit-logs`

- `customer:view`
  - `/customers` 查询、详情、消息、跟进列表、评分历史
  - `/follow-ups` 列表
  - `/tags` 查询、分类
  - `/channel-live/groups`、`/channel-live/channels` 查询

- `customer:edit`
  - `/customers` 新增、编辑、导入、转移、打标签、新增跟进
  - `/tags` 新增、编辑、删除
  - `/channel-live/groups`、`/channel-live/channels` 增删改

- `customer:delete`
  - `/customers/:id` 删除
  - `/follow-ups/:id` 删除

- `customer:export`
  - `/customers/export`
  - `/follow-ups/export`

- `broadcast:view`
  - `/broadcast-tasks` 列表、详情、导出、接收人

- `broadcast:send`
  - `/broadcast-tasks` 创建、取消、立即发送

- `campaign:view`
  - `/campaigns` 列表、详情、统计、我的报名

- `campaign:manage`
  - `/campaigns` 新增、编辑、启停终止、复制、报名、模拟邀请、生成邀请码
  - `/ads/conversion`

- `automation:view`
  - `/automation/rules`
  - `/flows/meta`、`/flows` 列表与详情

- `automation:manage`
  - `/automation/rules/:id`、`/automation/rules/bootstrap`
  - `/automation/run-scan`、`/automation/customers/:customerId/pause`
  - `/flows` 新增/更新/删除/运行

- `dashboard:view`
  - `/dashboard/overview`、`/dashboard/stats`、`/dashboard/charts`
  - `/track/report`、`/track/events/report`、`/track/report/details`
  - `/ads/roi`、`/ads/roi/trend`、`/ads/roi/details`、`/ads/spend`

- `ai:use`
  - `/ai/generate-copy`、`/ai/generate-poster`、`/ai/reply-suggestions`、`/ai/chat`
  - `/customers/:id/score-intent`

## 前端入口映射（可见性）

- 菜单与导航（`DashboardLayout`）
  - `settings:manage`：员工管理、系统设置、角色管理
  - `customer:view`：客户管理、跟进记录
  - `ai:use`：AI 助手
  - `campaign:view`：裂变活动
  - `broadcast:view`：群发任务
  - `automation:view`：自动化
  - `dashboard:view`：数据看板
  - `audit:view`：审计日志

- 页面级权限（关键页面）
  - `BroadcastTasksPage`：`broadcast:view` / `broadcast:send`
  - `CustomersPage`：`customer:edit` / `customer:delete` / `customer:export` / `settings:manage`
  - `CampaignsPage`、`CampaignDetailPage`：`campaign:view` / `campaign:manage`
  - `FlowBuilderPage`：`automation:manage`
  - `SettingsPage`、`UsersPage`、`RolesPage`：`settings:manage`
  - `ChannelLiveCodePage`：`customer:edit`

## 联调测试用例（最小集）

- 创建一个仅有 `customer:view` 的角色：
  - 预期：客户列表可见；新增/编辑/删除/导出按钮隐藏；调用写接口返回 403。

- 创建一个仅有 `broadcast:view` 的角色：
  - 预期：可看群发任务；不可创建、取消、立即发送。

- 创建一个仅有 `automation:manage` 且无 `automation:view` 的角色：
  - 预期：可执行写接口，但若前端只依赖 `automation:view` 渲染入口，菜单可能不可见（需产品确认是否要求「manage 蕴含 view」）。

- 创建一个仅有 `dashboard:view` 的角色：
  - 预期：可访问仪表盘与 ROI/渠道报表；不可触发聚合任务与广告花费同步。

- 创建一个仅有 `settings:manage` 的角色：
  - 预期：可管理用户/角色/系统配置；不可查看审计日志（除非额外授予 `audit:view`）。

## 备注

- 当前权限模型为“精确匹配 + `*` 通配”；不存在自动父子权限推导。
- 若希望减少配置复杂度，建议后续增加权限组模板（运营、销售主管、数据分析）并内置推荐组合。
