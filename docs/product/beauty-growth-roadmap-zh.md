# 美业增长闭环 · 修正版产品路线图

> 版本：v1 · 2026-08-28
> 适用产品：中数云科 · 企微私域营销管家
> 目标行业（第一阶段）：美容院、皮肤管理门店

---

## 一、结论先行

我们**不做**一个新的「AI 美业获客增长平台」，我们把**已有的私域跟进系统补成完整的经营闭环**，再在上面加一层轻量的 AI 增长外壳。

理由：

1. 系统已沉淀的企微会话存档、线索分配、意向评分、SOP 流程引擎、广告归因、AI 话术，是竞品短期抄不走的资产。围绕它加固，边际成本最低。
2. 当前真实缺口在**漏斗下半段**（预约 / 到店 / 卡项 / 复购 / LTV），不在上半段。线索量做上去而漏斗接不住，等于给别人做嫁衣。
3. 内容生成、多平台自动分发、竞品数据爬取，是竞争最激烈、合规风险最高、壁垒最薄的环节，不适合作为第一战场。

### 对外定位口径

**现阶段**：美业门店的 AI 私域增长助手 —— 把人拉进来、跟到店、催复购。
不替代门店收银 / ERP 系统，与之共存。

**P1 完成后**可升级为：美业门店的 AI 获客与复购增长系统。

---

## 二、现状盘点

### 已具备（不要重造）

| 能力 | 现有载体 |
| --- | --- |
| 线索留资与自动分配 | `leadCapture.service` / `leadAssignment.service` / `tenant_lead_settings` |
| 意向评分与预警 | `customers.intent_score` / `intent_alerts` / `intentScore.service` |
| 企微会话存档与 AI 辅助回复 | `inbox_threads` / `inbox_messages` / `ai_reply_logs` |
| SOP 自动化流程 | `flows` / `flow_nodes` / `flow_runs` / `automation_rules` |
| 广告归因与 ROI | `ad_click_records` / `ad_conversion_events` / `agg_ads_roi_daily` |
| AI 内容生成 | `aiContent.service` / `ai_generation_logs` / `script_library_items` |
| 群发 / 短信 / 活码 / 裂变 | `broadcast_tasks` / `sms_tasks` / `wework_channels` / `campaigns` |
| 订单与产品目录 | `customer_orders` / `products`（`metadata` JSON 可按行业扩展） |
| 落地页与留资记录 | `landing_pages` / 留资记录页 |
| 计费与套餐 | `plans` / `subscriptions` / `usage_stats` / `usage_addon_packages` |

### 缺口（本路线图要补的）

搜索确认：`预约`、`到店`、`次卡`、`疗程`、`储值`、`核销` 在后端**仅出现在话术模板与提示词文本中**，无任何数据模型与业务模块。

1. **无预约与到店** —— 美业获客终点是"约到店"，不是"留电话"。
2. **无卡项与消耗** —— 疗程剩余次数、储值余额、卡有效期，是美业复购的驱动源。
3. **无消耗驱动的复购提醒** —— 现有意向评分基于聊天语义，无法覆盖"剩 2 次该续卡""28 天该回访"。
4. **无 LTV 口径 ROI** —— 现有 ROI 只算到首次成交，算不到 90 天内的复购与充值。
5. **首页非老板视角** —— 登录首页是 CRM 报表，不是"今天花了多少、赚了多少"。

---

## 二点五、实施进度

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| P0-1 在线预约 | 已完成 | 档期表、今日到店、排班管理、公开自助预约接口 |
| P0-2 卡项与消耗 | 已完成 | 次卡/储值卡/期限卡、核销、充值、手工调整（含审计） |
| P0-3 消耗驱动复购 | 已完成 | 8 个流程触发器 + 每日复购扫描任务 + 复购提醒台 |
| P0-4 老板驾驶舱 | 已完成 | `/app` 首屏改为经营指标 + 今日建议；原报表下沉至 `/app/dashboard` |
| 客户自助预约 H5 页 | 待开始 | 接口已就绪，缺前端页面 |

**P0 已全部完成。** 下一阶段进入 P1（LTV 归因、变美档案、美容师业绩、内容选题助手）。

部署需执行迁移：`database/100_beauty_appointments_cards.sql`
需开启定时任务：`ENABLE_REPURCHASE_SCAN_CRON=1`（每日 09:30 扫描）

---

## 三、优先级总览

| 优先级 | 主题 | 目标 |
| --- | --- | --- |
| **P0** | 闭环补全 | 预约 / 到店 / 卡项消耗 / 复购提醒 / 老板驾驶舱 |
| **P1** | 增长外壳 | LTV 归因、变美档案、美容师业绩、内容选题助手 |
| **P2** | 扩张 | 多平台发布、投流中心、竞品洞察、行业横向扩展 |

---

## 四、P0 · 闭环补全（第一阶段唯一重点）

### P0-1 在线预约

**要解决的问题**：线索留资后无处可约，店长退回微信手工排表。

功能范围：

- 员工侧：为客户创建预约（项目、时间、服务人员、时长、备注）
- 客户侧：H5 自助预约页（复用现有落地页域名与租户参数 `?t=tenantId`）
- 档期视图：按日 / 周查看，按服务人员分列
- 状态机：`booked`（已预约）→ `arrived`（已到店）→ `completed`（已完成） / `no_show`（爽约） / `cancelled`（已取消）
- 提醒：预约前 24h / 2h 自动提醒客户（走已有群发与短信通道），爽约自动生成跟进任务
- 客户详情页展示"下次到店时间"与历史到店记录

**与已有能力的衔接**：预约创建 / 到店 / 爽约三个事件作为触发器接入现有 `flows` 流程引擎，不新建调度器。

### P0-2 卡项与消耗

**要解决的问题**：不知道谁该被复购。

功能范围：

- 卡项类型定义：复用 `products`，通过 `metadata` 区分
  - 次卡（总次数 / 剩余次数）
  - 储值卡（面值 / 赠送 / 余额）
  - 年卡 / 期限卡（有效期）
- 客户持卡：一个客户可持多张卡，记录购买时间、金额、有效期、剩余量
- 核销：到店完成服务时扣次或扣款，生成消耗流水
- 手工调整：支持带原因的余额 / 次数修正，全量进审计日志

**明确不做**：不做收银、不做支付、不做库存。只做**记录**，因为复购提醒只需要记录。

### P0-3 消耗驱动的自动复购

**这是老板最肯付钱的功能。** 实现方式是给现有流程引擎增加一批美业触发器，不新建引擎。

新增触发器：

| 触发器 | 典型用途 |
| --- | --- |
| 疗程剩余次数 ≤ N | 续卡邀约 |
| 卡有效期剩余 ≤ N 天 | 到期提醒 + 续卡 |
| 储值余额 ≤ N 元 | 充值邀约 |
| 距上次到店 ≥ N 天 | 沉睡唤醒 |
| 服务完成后 +N 天 | 效果回访 |
| 预约爽约 | 二次邀约 |
| 生日 / 会员纪念日前 N 天 | 到店礼邀约 |

每个触发器配套预置话术模板（进 `script_library_items`，标记美业行业包），开箱即用。

### P0-4 老板驾驶舱

登录首页改为经营视角，**吸收 ChatGPT 方案第 15 条**。

第一屏只显示：

```
今日：新增线索  有效线索  预约  到店  成交  成交金额
本月：获客花费  获客成本 CAC  ROI  复购率
趋势：近 30 天折线
AI 建议：今天最该做的 3 件事
```

「AI 今日建议」第一版**基于自有真实数据的规则 + LLM 润色**，不引入任何外部市场数据。例如：

- 「今天有 6 位客户疗程剩 1 次，建议优先跟进（列表）」
- 「昨天 3 位客户爽约未跟进」
- 「抖音渠道本周 CAC 上升 40%，建议检查素材」

原有 CRM 报表下沉为二级页面，不删除。

### P0 验收标准

一家门店可以完全在系统内完成：**广告留资 → 分配跟进 → 约到店 → 到店核销 → 购卡 → 疗程消耗 → 自动催复购 → 二次到店**，且老板在首页能看到这条链路的转化率与金额。

---

## 五、P1 · 增长外壳

### P1-1 LTV 口径 ROI

现有 `agg_ads_roi_daily` 只算首单。扩展为：

- 首单 ROI（现有）
- 30 / 90 / 180 天累计 ROI（含复购与充值）
- 按渠道 / 计划 / 素材维度的 LTV
- CAC 回收周期

这是让老板续费的核心证据，也是对外做案例的弹药。

### P1-2 变美档案

- 肤质 / 肤况标签、过敏与禁忌史（写入 `customers.discovery_profile` 扩展或独立表）
- 疗程前后对比照（按次到店归档）
- 服务记录时间轴

对比照同时是转介绍弹药与 AI 生成朋友圈的素材来源，价值双重。

**合规要求**：对比照必须有客户书面授权记录，未授权不得进入任何对外内容生成流程。

### P1-3 美容师维度业绩

现有 `leaderboard` 是销售视角，补充手艺人视角：

- 按服务人员统计到店数、服务次数、核销金额、客户复购率
- 提成规则配置与试算

### P1-4 内容选题助手（薄版本）

**不做**多平台自动发布，**不做**竞品爬取。只做：

- 基于本店真实数据（热门项目、高转化客户画像、近期成交项目）生成本周内容选题
- 一键生成抖音脚本 / 小红书笔记 / 朋友圈文案（复用现有 `aiContent.service`）
- 生成内容带**发布追踪短链**，回流曝光与留资，形成"内容 → 线索"归因

人工复制粘贴发布完全可接受 —— 美业门店本来就是店长自己发。等这条链路跑出真实转化数据，再决定是否投入 P2 的自动发布。

### P1-5 内容合规护栏

美业内容涉及效果宣称，广告法风险高。AI 生成环节增加：

- 违禁词库校验（"根治""最有效""100%"等）
- 医疗化表述拦截
- 前后对比图使用授权校验
- 生成结果标注风险等级，高风险需人工确认后才可导出

---

## 六、P2 · 扩张（需前置条件满足才启动）

| 方向 | 启动前置条件 |
| --- | --- |
| 多平台自动发布 | 已取得抖音 / 小红书开放平台资质；P1-4 已验证内容带来真实线索 |
| AI 投流中心 | 已有 ≥ 20 家门店的真实投放数据可供训练建议模型 |
| 竞品与市场洞察 | 找到**合法且可持续**的数据源；否则不做（见风险章节） |
| 行业横向扩展 | 美业模型跑通并有 ≥ 50 家付费门店 |

投流中心若启动，必须遵循 ChatGPT 方案第 11 条的思路：**AI 给方案 → 人工确认 → 执行 → 数据回流 → AI 优化**，并强制预算上限、每日预算、异常报警、一键暂停。第一阶段绝不做全自动扣费执行。

---

## 七、数据模型设计（P0）

设计原则：**新增表，不改动已有表结构**；行业特性收敛到 `metadata` JSON，保证未来横向扩展。

### 7.1 预约 `appointments`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT UNSIGNED PK | |
| tenant_id | BIGINT UNSIGNED | 租户隔离 |
| customer_id | BIGINT UNSIGNED | 关联客户 |
| staff_id | BIGINT UNSIGNED NULL | 服务人员（users.id） |
| product_id | BIGINT UNSIGNED NULL | 预约项目 |
| title | VARCHAR(200) | 项目名快照 |
| start_at | DATETIME | 预约开始 |
| duration_min | SMALLINT UNSIGNED | 时长（分钟） |
| status | VARCHAR(24) | booked / arrived / completed / no_show / cancelled |
| source | VARCHAR(50) | 来源（自助预约 / 员工代约 / 流程触发） |
| arrived_at | DATETIME NULL | 实际到店时间 |
| completed_at | DATETIME NULL | |
| remark | VARCHAR(500) NULL | |
| created_by | BIGINT UNSIGNED NULL | |
| metadata | JSON NULL | 行业扩展 |

索引：`(tenant_id, start_at)`、`(tenant_id, customer_id)`、`(tenant_id, staff_id, start_at)`、`(tenant_id, status)`

### 7.2 客户持卡 `customer_cards`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT UNSIGNED PK | |
| tenant_id | BIGINT UNSIGNED | |
| customer_id | BIGINT UNSIGNED | |
| product_id | BIGINT UNSIGNED NULL | 关联卡项定义 |
| card_type | VARCHAR(24) | times（次卡）/ stored（储值）/ period（期限卡） |
| name | VARCHAR(200) | 卡名快照 |
| total_times | INT NULL | 总次数（次卡） |
| remaining_times | INT NULL | 剩余次数 |
| total_amount | DECIMAL(12,2) NULL | 面值（储值） |
| remaining_amount | DECIMAL(12,2) NULL | 余额 |
| paid_amount | DECIMAL(12,2) | 实付金额（进 LTV 计算） |
| valid_from | DATE NULL | |
| valid_until | DATE NULL | |
| status | VARCHAR(24) | active / used_up / expired / refunded / frozen |
| order_id | BIGINT UNSIGNED NULL | 关联 customer_orders |
| created_by | BIGINT UNSIGNED NULL | |
| metadata | JSON NULL | |

索引：`(tenant_id, customer_id, status)`、`(tenant_id, valid_until)`、`(tenant_id, status, remaining_times)`

### 7.3 消耗流水 `card_transactions`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | BIGINT UNSIGNED PK | |
| tenant_id | BIGINT UNSIGNED | |
| card_id | BIGINT UNSIGNED | |
| customer_id | BIGINT UNSIGNED | 冗余，便于查询 |
| appointment_id | BIGINT UNSIGNED NULL | 关联到店 |
| type | VARCHAR(24) | consume（核销）/ recharge（充值）/ refund / adjust（手工调整） |
| times_delta | INT NULL | 次数变动（负为消耗） |
| amount_delta | DECIMAL(12,2) NULL | 金额变动 |
| times_after | INT NULL | 变动后剩余次数（快照，便于对账） |
| amount_after | DECIMAL(12,2) NULL | 变动后余额 |
| reason | VARCHAR(200) NULL | 手工调整必填 |
| operator_id | BIGINT UNSIGNED NULL | |

索引：`(tenant_id, card_id)`、`(tenant_id, customer_id, created_at)`

> 手工调整（`adjust`）必须同时写入 `audit_logs`。

### 7.4 服务记录 `service_records`（P1 变美档案的载体，P0 可先建表最小字段）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id / tenant_id / customer_id | | |
| appointment_id | BIGINT UNSIGNED NULL | |
| staff_id | BIGINT UNSIGNED NULL | 服务人员 |
| product_id | BIGINT UNSIGNED NULL | |
| served_at | DATETIME | |
| skin_profile | JSON NULL | 肤质 / 肤况（P1） |
| before_images | JSON NULL | 前照（P1，需授权） |
| after_images | JSON NULL | 后照（P1，需授权） |
| media_consent | TINYINT | 影像使用授权，默认 0（P1） |
| notes | TEXT NULL | |

### 7.5 已有表的轻量扩展

均为**可空新增列**，不破坏现有逻辑：

- `customers`：`next_appointment_at`、`last_visit_at`、`visit_count`、`total_paid_amount`（LTV 缓存）
- `products.metadata`：约定美业结构 `{ card_type, times, valid_days, is_traffic_item }`
- `agg_ads_roi_daily`：`ltv_30d`、`ltv_90d`、`repurchase_amount`（P1）

---

## 八、API 设计（P0）

沿用现有 `/api/v1` 与 `asyncHandler` + `ok()` 规范，权限走现有 `perm_codes`。

### 预约

```
GET    /api/v1/appointments                 列表（按日期区间 / 员工 / 状态筛选）
GET    /api/v1/appointments/calendar        档期视图（按日/周，按员工分列）
POST   /api/v1/appointments                 创建
PUT    /api/v1/appointments/:id             修改
POST   /api/v1/appointments/:id/arrive      标记到店
POST   /api/v1/appointments/:id/complete    完成服务（可同时核销）
POST   /api/v1/appointments/:id/no-show     标记爽约
POST   /api/v1/appointments/:id/cancel      取消
```

公开自助预约（限流，参照 `lead.routes.js` 的 `rateLimit` 写法）：

```
GET    /api/v1/public/booking/:tenantId/slots     可约档期
POST   /api/v1/public/booking/:tenantId/submit    提交预约（自动建/匹配客户）
```

### 卡项

```
GET    /api/v1/customers/:id/cards          客户持卡列表
POST   /api/v1/customer-cards               开卡
POST   /api/v1/customer-cards/:id/consume   核销扣次/扣款
POST   /api/v1/customer-cards/:id/recharge  充值
POST   /api/v1/customer-cards/:id/adjust    手工调整（需 reason + 审计）
GET    /api/v1/customer-cards/:id/transactions  流水
GET    /api/v1/customer-cards/alerts        待续卡/将到期/低余额清单
```

### 驾驶舱

```
GET    /api/v1/cockpit/overview             今日 + 本月核心指标
GET    /api/v1/cockpit/trends?days=30       趋势
GET    /api/v1/cockpit/suggestions          AI 今日建议（规则 + LLM 润色）
```

### 权限码新增

`appointment:view` / `appointment:edit` / `card:view` / `card:edit` / `card:adjust` / `cockpit:view`

`card:adjust`（手工改余额）默认仅店长与管理员持有。

---

## 九、前端页面地图（P0）

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/app`（改造） | 老板驾驶舱 | 首屏经营指标 + AI 今日建议；原报表下沉 |
| `/app/appointments` | 预约档期 | 日/周视图，按员工分列，拖拽改期 |
| `/app/appointments/today` | 今日到店 | 门店前台高频页：签到、核销、爽约 |
| `/app/customers/:id`（改造） | 客户详情 | 增加「持卡」「到店记录」「下次预约」区块 |
| `/app/cards/alerts` | 复购提醒台 | 待续卡 / 将到期 / 低余额 / 沉睡客户 |
| `/app/appointments/schedules` | 服务人员排班 | 每周固定班次 + 按日期调休，决定自助预约可约时段 |
| `/app/settings`（改造） | 设置 | 增加卡项定义（P0-2） |
| `/booking/:tenantId` | 客户自助预约 H5 | 公开页，移动端优先 |

**UX 要点**：「今日到店」是前台一天点几十次的页面，必须做成大按钮、少跳转、可离线容错的形态，优先适配移动端与平板。

---

## 十、商业化调整

现有套餐体系（`plans` / `subscriptions` / `usage_addon_packages`）不推翻，做如下调整：

| 套餐 | 定位 | P0 后的卖点 |
| --- | --- | --- |
| 免费体验 | 获客 | 限 50 客户，含预约与卡项只读 |
| 基础版 | 单店起步 | 客户 + 跟进 + 预约 |
| 专业版 | 单店主力 | 加卡项消耗、自动复购、AI 话术 |
| 门店版 | 多员工门店 | 加驾驶舱、美容师业绩、广告 ROI |
| 连锁版 | 多门店 | 跨店数据、总部视角 |

AI 用量继续走现有增值包计量。

**定价锚点建议**：对门店老板的价值叙述从"管客户"改为"多做几单"。一次疗程续卡通常 2000–8000 元，专业版年费只要能促成 2–3 单续卡即回本 —— 这是销售话术的核心锚点，也应体现在驾驶舱的「本月因提醒而促成的复购金额」这个指标上。

---

## 十一、风险

### 技术风险

| 风险 | 应对 |
| --- | --- |
| 核销并发导致次数/余额错扣 | 数据库事务 + 行锁；流水表记录变动后快照用于对账 |
| 预约改期与档期冲突 | 服务端校验员工时间重叠，冲突返回明确错误 |
| 复购触发器造成消息轰炸 | 复用现有 `marketing_optouts` 与频控；同一客户同类提醒设最小间隔 |
| 首页驾驶舱聚合查询慢 | 沿用现有 `agg_*` 日聚合表模式，不做实时全表扫描 |

### 合规风险

| 风险 | 应对 |
| --- | --- |
| 效果宣称违反广告法 | P1-5 违禁词与医疗化表述拦截，高风险人工确认 |
| 前后对比照肖像权 | `media_consent` 强制授权字段，未授权不得进入内容生成 |
| 客户手机号与到店记录属敏感个人信息 | 沿用现有租户隔离与审计日志；导出行为记录操作人 |
| 竞品价格数据获取 | **不做**爬取。见下 |

### 关于「AI 竞品调研」的明确结论

ChatGPT 方案第 4 条要求 AI 分析本地竞品门店与价格，第 17 条又要求禁止编造数据、必须标注来源与可信度。在中国本地美业市场，**这两条实际互斥** —— 不存在合法、可持续、可批量获取的本地竞品真实价格数据源。

结论：第一阶段**不做竞品调研模块**。若未来做，只做两条合法路径：

1. 门店自行录入的竞品信息（人工采集，标注录入人与时间）
2. 平台内跨租户脱敏聚合的行业均值（需在用户协议中明确授权，且达到足够样本量才展示）

---

## 十二、竞争力回答

**为什么不直接用 ChatGPT / DeepSeek？**
通用大模型不知道你店里谁的疗程剩 1 次、谁上个月爽约、哪条广告带来的客户复购最高。我们的价值不在生成文字，在于**基于你门店真实经营数据触发正确的动作**。

**为什么不用普通 CRM？**
普通 CRM 只记录，不驱动。我们把"疗程剩余次数""卡到期""久未到店"变成自动执行的复购动作。

**为什么不用门店 ERP / 收银系统？**
收银系统管的是"人已经在店里之后的事"。我们管"怎么把人弄进来、怎么让人再来"。两者共存，我们不替代。

**为什么不找代运营公司？**
代运营按月收费且不沉淀资产，人走了数据也走了。我们的客户资产、话术、流程都留在门店自己手里。

**不可替代能力（护城河）**
企微会话数据 + 到店与消耗数据 + 广告归因数据，三者打通后形成的**闭环数据资产**。这需要时间积累，是竞品最难追赶的部分。

---

## 十三、下一步

1. 确认本路线图方向
2. 输出 P0 数据库迁移 SQL（`database/100_beauty_appointments.sql` 起）
3. 按 P0-1 → P0-2 → P0-3 → P0-4 顺序实现
4. 用演示租户 9999 灌入美业演示数据，更新销售话术脚本
