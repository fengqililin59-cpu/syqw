# 美业增长漏斗现状盘点（基于实际代码）

> 盘点范围：`获客系统/`（Next.js + Prisma + PostgreSQL，下称 **Growth OS**）与 `frontend/` + `backend/`（Vite React + Express + Sequelize + MySQL，下称 **ZhiFlow**）。
> 盘点方式：读代码 + 读 schema + 本地只读 SQL 计数。所有结论附文件路径与行号。
> 本文只做现状判断与决策输入，**不含工时估算、不含排期**。
>
> **修订记录**：初版为纯盘点（未改动任何代码）。**2026-08-29 修订**：§五「第 1 层」的三项（状态节点时间戳、utm/source 透传、内容归因）已实现并合入 `获客系统` 的 `feat-ai-growth-os-plan-c267Vv` 分支，文中被推翻的现状描述已就地标注并指向实际文件；被推翻的表述保留原文（划删或"原盘点结论"字样）以便对照。**第 2 层及以后未动。**
>
> **本地数据免责**：文中出现的行数来自本地开发库 `growth_os`（`获客系统/.env` 指向 `127.0.0.1:5432/growth_os`），执行方式是显式 `BEGIN READ ONLY` 事务内的 `count(*)`。**本地数据量不代表生产**，它只能证明"某字段在本地从未被写过"这类线索，不能证明生产同样为空。

---

## 零、结论先行

1. **Growth OS 覆盖的是漏斗前四环（曝光素材 → 线索获取 → 线索分级 → 首次触达），后四环（预约 / 到店 / 成交 / 复购）在数据模型上只以 `BeautyLeadStatus` 的枚举值形式存在，没有任何独立实体、没有时间戳、没有自动化触发器。** 定位里的"到店率 / 成交率 / 复购率"，在 Growth OS 里**一个都算不出来**。
2. ~~**`dealCount` / `dealAmount` 不是孤例，同类问题至少还有两处**：`BeautyContent.linkedLeadCount` 全代码库**零写入方**却被喂进每日建议的 LLM prompt；`BeautyLead.contentId` 同样零写入方。~~ **【2026-08-29 已修复】** 归因链路已打通：落地页表单透传 utm、API 回填 `BeautyLead.contentId` 并原子递增 `BeautyContent.linkedLeadCount`，内容中心可选投放落地页并在内容卡展示「带来 N 条线索」。同时 `BeautyLead` 补上四个状态节点时间戳。见 §5「第 1 层」。**注意：本层修复只覆盖漏斗上半段的度量，环 5/6/8（预约/到店/复购）仍是真空。**
3. **ZhiFlow 那套确实把后半段做完了**（`appointments` / `customer_cards` / `card_transactions` + 10 个流程触发器 + 驾驶舱的 `arrival_rate` / `repurchase_rate`），但它与 Growth OS **完全不通**：不同语言、不同数据库、不同租户模型，两边源码互不引用（在 `backend/src` 与 `frontend/src` 全文搜索 `获客系统` / `growth_os` / `growth-os`，**零命中**）。
4. 因此当前状态不是"一个产品有缺口"，而是**两个半成品各占漏斗一半，且没有拼接口**。

---

## 一、逐环盘点

每环四问：**① 有没有数据（能不能算指标）② 有没有干预手段 ③ 在哪套代码里 ④ 最关键缺口**。

### 环 1 · 曝光 / 流量获取

| 维度 | 结论 |
|---|---|
| **数据** | **Growth OS：无。** 美业侧唯一与"曝光"沾边的是 `BeautyLandingPage.viewCount`（`获客系统/prisma/schema.prisma:2070`），写入方是落地页的 GET（`获客系统/src/app/api/lp/beauty/[slug]/route.ts:59` 与 `获客系统/src/app/lp/beauty/[slug]/page.tsx:39`）——那是**落地页 PV，不是渠道曝光**。`BeautyContent` 生成的小红书/抖音/朋友圈文案**没有任何发布或回流字段**，`copiedCount`（`schema.prisma:2175`，写入方 `获客系统/src/app/api/beauty/content/[id]/route.ts:47`）记的是"店主在后台点了几次复制"。<br>**ZhiFlow：有。** `ad_click_records` / `ad_conversion_events` / `agg_ads_roi_daily` / `page_visits`（`backend/src/models/` 下同名文件），`backend/src/services/adTracking.service.js`、`pageTracking.service.js`。 |
| **干预** | Growth OS：`获客系统/src/lib/beauty/content-gen.ts` 生成五类文案（小红书/朋友圈/短视频脚本/抖音/活动方案），**只能复制粘贴，无发布通道**。<br>ZhiFlow：`aiContent.service.js` + `broadcast_tasks` / `sms_tasks` + 裂变活动 `campaign.service.js`。 |
| **代码归属** | 内容生成两边都有（重复）；投放归因只有 ZhiFlow。 |
| **缺口** | Growth OS 侧「内容 → 曝光 → 线索」这条链，**"内容 → 线索"已于 2026-08-29 打通**（见环 2），但中间的"曝光"仍完全没有数据——文案没有发布通道，也拿不到平台侧的曝光/点击回流。 |

### 环 2 · 线索获取

| 维度 | 结论 |
|---|---|
| **数据** | **Growth OS：有，且是全系统最扎实的一环。** `BeautyLead`（`schema.prisma:2085`）两条真实入口：① 落地页提交 `获客系统/src/app/api/lp/beauty/[slug]/route.ts:138`；② 企微活码回调建线索 `获客系统/src/app/api/beauty/wework/msg-callback/route.ts`（双层幂等、CorpID 校验、`externalcontact/get` 拉昵称）。渠道溯源 `BeautyLead.channelId`（`schema.prisma:2107`）在回调路径写入，活码 `addCount` 由 `获客系统/src/lib/wework/contact-way.ts:181` 递增。 |
| **⚠ 字段存在 ≠ 有数据（已于 2026-08-29 修复）** | **原盘点结论（已不再成立）**：utm 三字段是死字段、落地页线索 `source` 恒为 `OTHER`、`BeautyLead.contentId` 与 `BeautyContent.linkedLeadCount` 全代码库零写入方且后者被喂进 LLM prompt。<br>**现状**：归因链路已打通。`获客系统/src/lib/beauty/attribution.ts` 做 utm 白名单解析（只取白名单字段、逐个截长，不把整个 query string 带进库；来源先看显式 `source`，再按 `utm_source` 推断），前后端共用；落地页表单 `获客系统/src/app/lp/beauty/[slug]/BeautyLandingForm.tsx` 透传解析结果，API `获客系统/src/app/api/lp/beauty/[slug]/route.ts` 二次校验后落库，带内容标识时回填 `BeautyLead.contentId` 并原子递增 `BeautyContent.linkedLeadCount`（他店内容标识不认）。推广链接由内容中心生成（`获客系统/src/components/beauty/BeautyContentClient.tsx` + `获客系统/src/lib/beauty/content-promotion.ts`），多落地页的门店可选择投放页面，避免归因从第一条线索起就归错页；内容卡直接展示「带来 N 条线索」。回归见 `获客系统/src/lib/beauty/attribution.test.ts`、`content-promotion.test.ts`。<br>**遗留**：`source` / utm 只在**落地页路径**生效，企微活码回调路径仍走 `channelId` 溯源、不产生 utm；且**本地开发库的历史线索不会被回填**，存量行仍是 `OTHER` / NULL。 |
| **干预** | 活码 CRUD + 能力探测（`获客系统/src/lib/wework/contact-way.ts`、`probe.ts`）、落地页 CRUD（`获客系统/src/app/api/beauty/landing/`）、提交限流（`route.ts:75,124`）。 |
| **代码归属** | **两边都有（重复建设）**：ZhiFlow 有 `backend/src/services/leadCapture.service.js`（H5 留资建 `Customer`）、`landingPage.service.cjs`、`weworkContactWay.service.js`（同样的企微「联系我」活码，`CONTACT_WAY_STATE_MAX_LEN = 30` 与 Growth OS 的 30 字符 state 是同一套约束的两份实现）。 |
| **缺口** | ~~归因链断在最前面~~ **已补齐（2026-08-29）**：落地页线索现在能说清"从哪条内容/哪个渠道来的"。剩余缺口是**归因只覆盖新数据**，以及内容侧仍只有"复制/带来线索"两个量，**没有平台侧曝光与点击数据**（环 1 依旧真空）。 |

### 环 3 · 线索质量分级

| 维度 | 结论 |
|---|---|
| **数据** | **Growth OS：有，且有真实写入方。** `aiScore` / `aiGrade` / `aiScoreDetail` / `aiFollowUp`（`schema.prisma:2112-2115`），写入方 `获客系统/src/lib/beauty/lead-scoring.ts:49-57`，被落地页提交（`lp/.../route.ts:171`）与手动 rescore（`获客系统/src/app/api/beauty/leads/[id]/route.ts:238`）调用。本地库 `aiScore is not null` 的行数 = 全部线索数（1/1）。 |
| **口径警示（事实，非推断）** | 评分是**纯规则**，四维打分函数 `calculateScore`（`lead-scoring.ts:63-205`）的输入**只有表单静态字段**（`name` / `phone` / `interestedService` / `budget` / `message` / `source` / 门店 `avgPrice` 与 `services`）。**没有任何行为信号，也没有任何后验校准**——因为没有成交结果可回流（见环 7）。所以 "S 级"目前是**表单填得全不全**的代名词，不是"更容易成交"的证据。 |
| **干预** | 分级结果驱动通知卡片文案（`获客系统/src/lib/wework/message.ts` 的 `buildNewLeadCard`）与列表排序展示。 |
| **代码归属** | 两边都有：ZhiFlow 的 `intentScore.service.js` / `intent_alerts` 基于**企微会话语义**打分，与 Growth OS 的表单规则分是两种完全不同的口径。 |
| **缺口** | 无闭环校验。要验证"S 级是否真的更容易成交"，前提是环 7 有可用数据——目前没有。 |

### 环 4 · 首次触达与响应

| 维度 | 结论 |
|---|---|
| **数据** | **半有。** 有的是「**是否已派单 + 是否推送成功**」：`BeautyLead.assignedEmployeeId` / `BeautyEmployee.assignedAt`（`schema.prisma:2120,2233`，写入方 `获客系统/src/lib/beauty/assign-lead.ts:70`）、`BeautyWeWorkOutbox` 与 `BeautyWeWorkMessageLog`（`schema.prisma:2346,2378`）有完整投递状态与 `retryCount`。<br>**「响应速度」已可算（2026-08-29）**：`BeautyLead` 补上 `contactedAt`（迁移 `获客系统/prisma/migrations/20260829050000_beauty_lead_status_timestamps`），由 `获客系统/src/lib/beauty/deal-stats.ts` 的 `changeLeadStatus` 在首次进入 `CONTACTED` 时盖戳（已有值不覆盖、状态回退不清空）。**首响时长 = `contactedAt - createdAt`，从此可算**；但只对改完之后新流转的线索有效，存量行为 NULL，且盖戳依赖有人真的去改状态——**没改状态就等于没跟进记录，这一点没变**。<br>跟进记录 `followUpNotes` 是 Json 数组（`schema.prisma:2119`），前端自行拼 `{date, note}`（`获客系统/src/components/beauty/BeautyLeadsClient.tsx:117-127`），**不可聚合查询**。 |
| **干预** | **这一环是 Growth OS 做得最重的地方**：出站队列 + 退避 + 门店级限频 + `DEAD` 告警（`获客系统/src/lib/wework/outbox.ts`，消费者 `获客系统/src/app/api/cron/beauty-wework-outbox/route.ts`）；分配通知文案单一来源（`获客系统/src/lib/beauty/notify-assignment.ts`）。 |
| **代码归属** | 两边都有：ZhiFlow 的 `leadAssignment.service.js` + `inbox_threads` / `ai_reply_logs`（会话存档与 AI 辅助回复，Growth OS 完全没有）。 |
| **缺口** | 首响时长本身已可算，缺的是**基于它的动作**：**没有超时未跟进的兜底动作**（V2 计划文档第六节把"超时转派"列为延后项，与此一致）。 |

### 环 5 · 预约

| 维度 | 结论 |
|---|---|
| **数据** | **Growth OS：只有一个枚举值，没有实体。** `BeautyLeadStatus.BOOKED`（`schema.prisma:2462`）。**没有预约时间、没有预约项目、没有服务人员、没有档期**。唯一的写入方式是有人手动 PATCH `/api/beauty/leads/[id]`（`获客系统/src/app/api/beauty/leads/[id]/route.ts:217-228`）。落地页模板里有个叫 `APPOINTMENT` 的枚举（`schema.prisma:2436`），但它只是**页面文案模板**（`获客系统/src/components/beauty/BeautyLandingClient.tsx:52` "客户填写预约信息"），提交后走的仍是普通建线索路径，不产生任何预约记录。<br>**ZhiFlow：有完整实体。** `backend/src/models/appointment.model.js`、`backend/src/services/appointment.service.js`、`backend/src/routes/appointment.routes.js`，状态机 `booked / arrived / completed / no_show / cancelled`，并回写 `Customer.next_appointment_at`（`appointment.service.js:135`）。 |
| **干预** | Growth OS：**无**（人工改状态之外没有任何动作）。<br>ZhiFlow：流程触发器 `appointment_booked` / `appointment_no_show`（`backend/src/constants/flowTriggers.js:7,9`）可挂自动提醒与二次邀约。 |
| **代码归属** | **只有 ZhiFlow。** |
| **缺口** | Growth OS 侧是**真空**。ZhiFlow 侧的缺口是**客户自助预约 H5 页未做**——接口存在（roadmap §八），但 `frontend/src/pages` 下没有任何 Booking 页面（已列目录确认），与 `docs/product/beauty-growth-roadmap-zh.md:65` 自述的"待开始"一致。 |

### 环 6 · 到店

| 维度 | 结论 |
|---|---|
| **数据** | **Growth OS：有了 `visitedAt`（2026-08-29 盖戳），但仍无到店记录实体，到店率照样算不出来。** 原因是口径：到店率的分母是**预约数**，而环 5 连预约实体都没有。`visitedAt` 目前只能支撑"留资到到店的时长分布"，不能支撑 `arrival_rate`。<br>**ZhiFlow：能算。** `cockpit.service.js:43` 定义 `ARRIVED_STATUSES = ['arrived','completed']`，`cockpit.service.js` 的 `getOverview` 直接产出 `today.arrival_rate = pct(todayArrived, todayBooked)`。到店动作同时写 `Customer.last_visit_at` 与 `visit_count += 1`（`backend/src/services/appointment.service.js:333-334`）。 |
| **干预** | Growth OS：无。<br>ZhiFlow：`appointment_arrived` / `service_completed` 触发器（`flowTriggers.js:8,10`），前台「今日到店」页 `frontend/src/pages/AppointmentsPage.tsx`。 |
| **代码归属** | **只有 ZhiFlow。** |
| **缺口** | Growth OS 侧真空。 |

### 环 7 · 首次成交

| 维度 | 结论 |
|---|---|
| **数据** | **这是本次盘点的核心分辨点。** `BeautyEmployee.dealCount` / `dealAmount`（`schema.prisma:2231-2232`）**现在确实有唯一写入方** `获客系统/src/lib/beauty/deal-stats.ts`（`changeLeadStatus` 第 65 行、`transferDealStats` 第 32 行），调用方三处：`leads/[id]/route.ts:204,218,291` 与 `assign-lead.ts:73`。写入逻辑本身是对的（事务 + 条件更新，反复 PATCH 只累加一次；改派与删除都做了对称冲销）。<br>**但"有写入方"离"能回答成交率"仍差两步**：<br>① **写入完全依赖人工**——唯一触发条件是有人把线索 PATCH 成 `DEAL`。没有订单、没有收款、没有核销，系统无从自动得知成交发生。<br>② ~~**`BeautyLead` 没有 `dealAt`**，因此「本月成交率」结构上无法计算。~~ **【2026-08-29 已修复】** `dealAt` 已随四个节点时间戳一起补上并由 `changeLeadStatus` 盖戳，**「本月线索的成交率」= 该时间窗内 `dealAt` 非空的线索数 ÷ 同窗 `createdAt` 的线索数，现在可算**（口径是"以线索为分母"，不是以预约为分母）。两条限定仍在：仍**依赖人工把线索 PATCH 成 `DEAL`**，且**存量线索的 `dealAt` 为 NULL**，短期内比率会偏低。<br>③ 状态历史不可回溯：美业侧**没有事件表**（Growth OS 有 `LeadEvent` / `LeadScoreHistory`，`schema.prisma:1236,1249`，但那挂在非美业的 `Lead` 上）。线索从 `NEW` 直接被改成 `DEAL`，中间的 `BOOKED` / `VISITED` 是否发生过、何时发生，**改完即丢失**。<br>本地开发库佐证（**不代表生产**）：`BeautyLead` 1 行且状态全为 `NEW`；`dealAmount is not null` 0 行；`BeautyEmployee` 1 行，`dealCount` / `dealAmount` 均为 0。 |
| **干预** | Growth OS：无。成交是被"记录"的，不是被"促成"的。<br>ZhiFlow：`customer_orders` + `customer_cards.paid_amount`，驾驶舱 `getOverview` 的 `revenue = 订单收入 + 开卡实付`（`cockpit.service.js`）。 |
| **代码归属** | 计数在 Growth OS，金额与订单实体在 ZhiFlow。 |
| **缺口** | **时间戳已补，仍缺事件流与自动成交信号。** 节点时间戳只留"每种状态最后一次发生的时间"，回退与重复流转不可回溯，同期群分析仍需事件表（§五 第 2 层第 4 项）。 |

### 环 8 · 复购 / 续卡

| 维度 | 结论 |
|---|---|
| **数据** | **Growth OS：完全没有。** 全库无卡项、无消耗、无二次成交概念——在 `获客系统/src/lib/beauty`、`src/app/api/beauty`、`src/components/beauty` 三个目录搜索「卡项 / 疗程 / 储值 / 核销 / 复购」，**命中全部落在 AI 提示词与 mock 文案里**（如 `content-gen.ts:234,244`、`prompts.ts:88`），**没有一处是数据模型或业务逻辑**。`BeautyLead` 一条线索只有一个 `dealAmount`，**第二次成交无处可放**。<br>**ZhiFlow：有。** `customer_cards`（次卡/储值/期限卡）+ `card_transactions`（`backend/src/models/customerCard.model.js`、`cardTransaction.model.js`、`backend/src/services/customerCard.service.js`），驾驶舱产出 `month.repurchase_rate = pct(visit_count>=2 的客户, visit_count>=1 的客户)`（`cockpit.service.js`）。 |
| **干预** | **只有 ZhiFlow，而且是它最成型的一块**：4 个定时触发器 `card_times_low` / `card_expiring` / `card_balance_low` / `customer_sleeping`，默认阈值 2 次 / 30 天 / 200 元 / 60 天（`backend/src/services/repurchaseScanner.service.js:14-17`），由 `backend/src/jobs/repurchaseScan.cron.js` 驱动。<br>**注意：该 cron 默认关闭**，需 `ENABLE_REPURCHASE_SCAN_CRON=1`（`backend/src/config/env.js:199`，`repurchaseScan.cron.js:11`）。roadmap 已注明此事（`beauty-growth-roadmap-zh.md:70`）。 |
| **代码归属** | **只有 ZhiFlow。** |
| **缺口** | Growth OS 侧真空且**结构上无法承载**（不是加字段能解决的，见 §四）。 |

### 环 9 · 转介绍

| 维度 | 结论 |
|---|---|
| **数据** | **Growth OS：无。** 无邀请人字段、无裂变实体。<br>**ZhiFlow：有。** `campaigns` / `campaign_enrollments` / `invite_records`（`backend/src/services/campaign.service.js` 头注释即「裂变活动：活动 CRUD、报名发码、邀请计数、企微 state 回传匹配、统计」）。 |
| **干预** | 只有 ZhiFlow（发码、邀请计数、奖励发放 `campaignRewardJob.service.js`）。 |
| **代码归属** | **只有 ZhiFlow。** |
| **缺口** | Growth OS 侧真空。ZhiFlow 侧未查证其是否已按美业场景做过参数化——**未找到**美业专属的裂变模板配置，此处不下结论。 |

### 附：驾驶舱这一环本身

Growth OS 的美业驾驶舱 `获客系统/src/app/api/beauty/dashboard/route.ts` 输出的 11 个指标（`route.ts:42-100`）**全部是线索量与内容量**：总线索、今日新线索、本周/本月线索、待跟进（`status=NEW`）、S 级线索数、内容数、落地页数、7 日趋势。**没有一个是转化率**。这与 ZhiFlow 驾驶舱直接给 `arrival_rate` / `repurchase_rate` / `cac` / `roi`（`cockpit.service.js` 的 `getOverview` 返回体）形成直接对照。

另：Growth OS 的每日 AI 建议**没有定时任务**——`获客系统/src/app/api/cron/` 下 6 条 cron 无一是美业建议，生成只能由店主/店长手动 POST `/api/beauty/dashboard/advice`（`获客系统/src/app/api/beauty/dashboard/advice/route.ts:16-38`，带 `canManageStore` 门禁）。本地库 `BeautyDailyAdvice` 0 行。

---

## 二、覆盖情况一览

| 环 | Growth OS 有数据 | Growth OS 有干预 | ZhiFlow 有数据 | ZhiFlow 有干预 | 判定 |
|---|---|---|---|---|---|
| 1 曝光/流量 | 仅落地页 PV | 只生成不发布 | ✅ | ✅ | ZhiFlow 强 |
| 2 线索获取 | ✅（归因已打通，2026-08-29） | ✅ | ✅ | ✅ | **重复建设** |
| 3 质量分级 | ✅（无后验校准） | 弱 | ✅（另一口径） | ✅ | **重复建设，口径互斥** |
| 4 首次触达 | ✅（首响时长已可算，2026-08-29） | ✅ 强 | ✅ | ✅ 强 | **重复建设** |
| 5 预约 | ❌ 仅枚举 + `bookedAt` | ❌ | ✅ | ✅ | ZhiFlow 独有 |
| 6 到店 | ❌ 有 `visitedAt`，无预约分母 | ❌ | ✅ | ✅ | ZhiFlow 独有 |
| 7 首次成交 | 半（成交率可算，仍靠人工录入） | ❌ | ✅ | 半 | 互补 |
| 8 复购/续卡 | ❌ 完全没有 | ❌ | ✅ | ✅ 强 | ZhiFlow 独有 |
| 9 转介绍 | ❌ | ❌ | ✅ | ✅ | ZhiFlow 独有 |

---

## 三、A · 定位匹配度（诚实判断）

以「**持续获客 + 提高到店率 / 成交率 / 复购率**」为标准：

**Growth OS 单独看，"获客"这半段已经能自证效果（成交率与首响时长可算、渠道与内容归因已通），但到店率与复购率仍答不上来。**

- **到店率**：`visitedAt` 有了，**分母仍不存在**——到店率的分母是预约数，Growth OS 没有预约实体。**仍是真空**（除非改用"线索 → 到店"口径，那不是行业通行的 `arrival_rate`）。
- **成交率**：**已可算（2026-08-29）**。`dealAt` 盖戳后可按任意时间窗算"该窗线索的成交率"。两条限定：写入 100% 依赖人工 PATCH 成 `DEAL`（系统无从自动得知成交），且存量线索无 `dealAt`，短期比率偏低。
- **复购率**：连"第二次成交"这个概念在数据模型里都不存在。**完全真空**，且属架构决策（§4.2 方向乙），不是加字段能解决。
- **持续获客**：**归因反馈回路已接通（2026-08-29）**——落地页线索带真实 `source` 与 utm，内容标识回填到 `BeautyLead.contentId` 并递增 `BeautyContent.linkedLeadCount`，"哪条内容/哪个渠道有效"现在可以回答，AI 每日建议也不再吃恒为 0 的输入。剩下的盲区是**平台侧曝光与点击**（环 1 依旧只有落地页 PV）。

**把两套合起来看，漏斗九环在"某套代码里"都有覆盖，但没有任何一条真实线索能跨越两套系统。** 一个客户在 Growth OS 里被建成 `BeautyLead`（PostgreSQL），在 ZhiFlow 里被建成 `Customer`（MySQL），两者无共享标识、无同步任务、无 API 调用（已验证：`backend/src` 与 `frontend/src` 中无任何指向 Growth OS 的引用）。所以**"合起来就完整了"是不成立的**——目前是两条各自断头的半截漏斗。

**一句话**：定位描述的是九环闭环，实现是两个各占一半且不相连的四五环。**要么承认现在卖的是"获客 + 派单 + 私域触达"（Growth OS 能兑现的部分），要么先解决拼接问题。**

**与现有文档的一致性**：`docs/product/beauty-growth-roadmap-zh.md:11` 的判断（"当前真实缺口在漏斗下半段"）与本次盘点完全吻合，且它给出的应对是"在 ZhiFlow 上补"——从代码看，那条路确实走通了。矛盾之处见 §五。

---

## 四、B · 两套代码的收敛建议

### 4.1 逐环重复与互补

**重复建设（同一件事有两份实现）**

| 环 | Growth OS | ZhiFlow | 性质 |
|---|---|---|---|
| 企微活码 | `src/lib/wework/contact-way.ts` | `backend/src/services/weworkContactWay.service.js` | **同一个企微 API 的两份封装**，连 30 字符 state 约束都各写了一遍 |
| 企微 token / 加解密 / 消息 | `src/lib/wework/access-token.ts`、`msg-crypto.ts`、`message.ts` | `wework.service.js`、`weworkMsgCrypto.service.js`、`weworkMessage.service.js` | 同上。Growth OS 侧的 token 缓存用了 PG advisory lock，质量更高（V2 计划文档第五节标注"禁止重写"） |
| 落地页 + 留资 | `BeautyLandingPage` + `api/lp/beauty/[slug]` | `landingPage.service.cjs` + `leadCapture.service.js` | 两份 C 端留资入口 |
| 线索分配 | `src/lib/beauty/assign-lead.ts` | `leadAssignment.service.js` | 两份派单逻辑 |
| 线索评分 | `lead-scoring.ts`（表单规则分） | `intentScore.service.js`（会话语义分） | **口径不同，不是简单重复**——合并要先定口径 |
| AI 内容生成 | `content-gen.ts` | `aiContent.service.js` | 两份 |
| 驾驶舱 | `api/beauty/dashboard`（量指标） | `cockpit.service.js`（率指标） | 两份，且**指标定义不重叠** |

**互补（只有一边有）**

- 只有 Growth OS：门店 AI 定位分析（`store-analysis.ts`）、美业专用玫瑰金前端与门店角色模型（`resolve-store.ts`）、企微出站队列（退避/限频/DEAD 告警，`outbox.ts`）、企微能力三层探测（`probe.ts`）。
- 只有 ZhiFlow：**预约、到店、卡项、消耗、复购触发器、裂变、会话存档、广告归因、订单** —— 即整个漏斗下半段。

### 4.2 三个可行方向

> 以下是判断，不是结论；每条都标了代价与风险。**本次未动任何代码。**

**方向甲：以 ZhiFlow 为主体，Growth OS 美业模块作为"获客前端"逐步退役**

- 依据：漏斗下半段是**结构性资产**（实体 + 状态机 + 触发器 + 聚合表），迁移成本远高于上半段；上半段（活码/落地页/评分/派单）ZhiFlow 已各有一份实现，不是从零开始。
- 迁走的应该是**能力而非代码**：Growth OS 的企微 token advisory lock 方案与出站队列（退避/限频/DEAD）是明确优于 ZhiFlow 现状的设计，值得作为设计参考重写进 Node/Express 侧。
- **代价**：`获客系统/` 的美业前端（6 个页面 + 5 个 client 组件）与门店角色模型（`BeautyEmployeeRole` 四角色 + `resolveBeautyStore` 的 SELF/STORE scope）在 ZhiFlow 的 `perm_codes` 体系里**没有对应物**，要重做权限映射。V2 计划文档第八节记录的 15 项修复（回调幂等、CorpID 校验、OAuth 闭环、能力探测……）**都会作废或需重做一遍**。
- **风险**：这批修复刚刚落地、尚未上线验证（V2 文档第十节上线清单一条未勾）。**在未经生产验证就宣布作废，等于承认这一轮投入是沉没成本**——这是决策层面的问题，不是技术问题。

**方向乙：以 Growth OS 为主体，把预约/卡项/复购在 Prisma 侧重建**

- 代价具体化：至少要新增 `BeautyAppointment`（含状态机与 `arrivedAt`/`completedAt`）、`BeautyCustomerCard`、`BeautyCardTransaction`、`BeautyServiceRecord` 四个模型，外加一套定时扫描器承接 4 个复购触发器。ZhiFlow 侧的 `flows` 流程引擎（`flows` / `flow_nodes` / `flow_runs`）在 Growth OS 里**没有对应物**——Growth OS 的自动化是散在 6 条 cron 里的固定任务，不是可配置流程引擎。**这意味着复购触发器要么硬编码，要么先建一套流程引擎。**
- **风险最高的一点**：`BeautyLead` 的建模前提是"一条线索 = 一个待转化的人"，`dealAmount` 是单值。复购意味着**一个人多次成交**，这与现有模型冲突。真要做，正确形态是引入 `BeautyCustomer`（客户）与 `BeautyLead`（线索）分离，**这是对现有美业模型的根本性重构**，不是加表。
- **收益**：单一技术栈、单一数据库、前端体验统一。

**方向丙：明确分工 + 建一条单向数据桥（不合并）**

- 形态：Growth OS 只做「获客到派单」，成交及以后交给 ZhiFlow；两边通过一次**单向线索推送**（Growth OS → ZhiFlow 建 `Customer`）连起来，并把 ZhiFlow 的到店/成交结果**回流为 Growth OS 的只读指标**。
- **代价**：需要一个稳定的客户身份对齐键。**手机号是唯一候选，但企微回调建的线索 `phone` 恒为空串**（`msg-callback` 路径不写手机号，V2 计划文档第七节明确记录这是已决策不改的行为）。**这意味着企微活码来的线索目前无法与 ZhiFlow 客户对齐**——这是方向丙最硬的障碍，且它同时也是方向甲/乙迁移时的数据清洗难点。
- **风险**：两套系统长期并存意味着两份运维、两个调度器、两份企微凭据配置（V2 文档 9.2 已经因为"两套调度器并存"付出过代价）。分工边界一旦模糊就会重新长出重复建设。
- **收益**：不作废任何既有投入，是**最小不可逆**的选项。

### 4.3 判断

**如果目标是尽快让"到店率/成交率/复购率"可回答，方向丙的代价最低、可逆性最好；但它必须先解决身份对齐（手机号）问题，否则桥搭不起来。** 方向甲在长期形态上最干净，代价是作废刚完成的一轮工作。方向乙的真实成本被严重低估——它不是"加四张表"，而是要重构客户模型并补一套流程引擎。

**无论选哪个方向，有一件事都必须先做**：把「一个客户」在两套系统里的身份对齐口径定下来。这个决定影响上面三条路的全部实施细节。

---

## 五、C · 度量优先级（最小改动集）

原则：**先有度量、再谈优化。** 按"能不能靠加字段/加写入方解决"分层。

### 第 0 层：不用改代码就能修的错误认知

- ~~**停止把 `linkedLeadCount` 喂进 AI 建议 prompt**~~ **【2026-08-29 已解决，选的是"补写入方"】** `获客系统/src/lib/beauty/prompts.ts` 的 prompt 保持原样，但输入不再恒为 0——见第 1 层第 3 项。

### 第 1 层：加字段 + 加写入方即可（不改模型结构）—— ✅ 三项已全部完成（2026-08-29）

1. ✅ **`BeautyLead` 补状态流转时间戳** `contactedAt` / `bookedAt` / `visitedAt` / `dealAt`。
   - 迁移：`获客系统/prisma/migrations/20260829050000_beauty_lead_status_timestamps/migration.sql`（同一条迁移顺带给 `BeautyLead.contentId` 建了索引）
   - 盖戳：`获客系统/src/lib/beauty/deal-stats.ts` 的 `changeLeadStatus`（首次进入对应状态时盖戳，已有值不覆盖，状态回退不清空）
   - 回归：`获客系统/src/lib/beauty/deal-stats.test.ts`
   - **解锁**：首响时长、本月线索成交率、留资到到店的时长分布。
2. ✅ **落地页表单补 `source` / utm 透传**。
   - 解析：`获客系统/src/lib/beauty/attribution.ts`（白名单 + 截长，前后端共用）
   - 提交与落库：`获客系统/src/app/lp/beauty/[slug]/BeautyLandingForm.tsx` → `获客系统/src/app/api/lp/beauty/[slug]/route.ts`
   - 回归：`获客系统/src/lib/beauty/attribution.test.ts`
   - **解锁**：落地页线索的 `source` 从恒为 `OTHER` 变成真实渠道。
3. ✅ **`BeautyContent.linkedLeadCount` 补写入方 + 内容归因链路**。
   - 链接生成与落地页选择：`获客系统/src/lib/beauty/content-promotion.ts`、`获客系统/src/components/beauty/BeautyContentClient.tsx`、`获客系统/src/app/[locale]/(platform)/beauty/content/page.tsx`（多落地页可选，单张不出选择器）
   - 回填与递增：`获客系统/src/app/api/lp/beauty/[slug]/route.ts`（原子递增，他店内容标识不认）
   - 回归：`获客系统/src/lib/beauty/content-promotion.test.ts`
   - **解锁**：AI 每日建议的输入不再恒假；店主在内容卡上直接看到「带来 N 条线索」（为 0 时不显示该项，避免刚上线满屏 0 被读成功能坏了）。

**共同限定（做完后仍然成立）**：三项都只对**新产生的数据**生效，存量线索的时间戳与 utm 为 NULL；成交与状态流转**仍依赖人工改状态**。

### 第 2 层：需要新建实体（不是加字段能解决的）

4. **线索状态事件表**（如 `BeautyLeadEvent`）。第 1 层的时间戳（**已落地**）只保留"每种状态最后一次发生的时间"，**回退与重复流转仍不可回溯**。要做同期群（cohort）分析——"7 月进来的线索，30 天内到店多少、成交多少"——必须有事件流。Growth OS 非美业侧已有 `LeadEvent` / `LeadScoreHistory` 可作为形态参考（`schema.prisma:1236,1249`）。
5. **预约实体**。到店率的分母是"预约数"，不是"线索数"。没有预约实体，`arrival_rate` 在 Growth OS 里**定义都写不出来**。
6. **客户与复购实体**。复购率要求"同一人多次成交"，当前 `BeautyLead` 单值 `dealAmount` 的建模承载不了。这一层与 §4.2 方向乙是同一件事，属**架构决策**，不属度量补齐。

### 分层结论

**第 1 层的三项（时间戳、utm 透传、内容归因）已于 2026-08-29 全部落地**，Growth OS 能回答的问题因此从"我有多少线索"升级到"我的线索多久被跟进、成交率多少、哪个渠道/哪条内容来的"。 到店率与复购率**在第 2 层之前无解**，且第 2 层已经不是度量问题，而是要不要在 Growth OS 里重建 ZhiFlow 已有能力的收敛决策（§4）。

---

## 六、与现有文档矛盾或需要修正之处

> 只列本次代码盘点能证实的，且**未修改任何现有文档**。

1. **`docs/V2-Beauty-Upgrade-Plan.md:34` 称"规划内缺口已清零"——就它自己定义的规划范围而言这是准确的**，但该规划范围本身**不包含漏斗下半段**。读者容易把"缺口清零"误读为"美业能力完整"。本文的九环盘点显示：规划内确实清零，规划外（预约/到店/复购）**从未进入过规划**。这不是文档错误，是**范围边界没有被显式声明**。
2. **V2 文档未提及三个"字段存在但无写入方"的问题**：`BeautyContent.linkedLeadCount`（零写入且被喂进 LLM prompt）、`BeautyLead.contentId`（零写入）、`utmSource/Medium/Campaign`（API 支持但唯一前端调用方从不传）。V2 文档第八节逐条复盘了 20 个缺口，这三条不在其中。**【2026-08-29 更新】三条均已修复**（见 §五 第 1 层），此处保留为记录：V2 文档的缺口复盘范围本身漏掉了"死字段"这一类问题，后续复盘应把"字段有无写入方"列入检查项。
3. **V2 文档第五节把 `deal-stats.ts` 记为"员工成交业绩回写 · 唯一写入方"，表述准确但可能造成误读**：它保证的是"写入口径统一"，**不等于"成交数据可用"**。**【2026-08-29 更新】`dealAt` 已补上，带时间范围的成交口径现在算得出来**；仍然成立的限制只剩一条——写入 100% 依赖人工 PATCH，系统无从自动得知成交发生。建议在后续修订时把这一条显式写出。
4. **`docs/product/beauty-growth-roadmap-zh.md:67` 称"P0 已全部完成"，需附加两条限定**：① 复购扫描 cron **默认关闭**（`backend/src/config/env.js:199`），未设 `ENABLE_REPURCHASE_SCAN_CRON=1` 时 P0-3 的自动复购**实际不运行**（roadmap 第 70 行已提示需开启，但"已完成"与"需手动开启才生效"放在两处，容易漏读）；② 客户自助预约 H5 页未做（roadmap 自己标注为"待开始"），意味着 P0-1 的**客户侧入口缺失**，预约只能由员工代约。
5. **两份文档都默认自己是"这套系统"的全部**，都没有把对方那套代码作为约束纳入。`docs/V2-Beauty-Upgrade-Plan.md:380` 明确砍掉了"内部 HMAC API + `backend/` 复用架构"，理由是"企微能力已在 `获客系统/` 内原生实现"——**这个判断只考虑了企微能力，没有考虑预约/卡项/复购这些 `backend/` 独有的能力**。该决策的实际后果是：两套系统之间**目前不存在任何集成通道**（已验证零交叉引用）。

---

## 附：本次核查方法与未查证项

**核查手段**：`prisma migrate status`（`4 migrations found` + `Database schema is up to date!`，与 V2 文档一致）；`获客系统/prisma/schema.prisma` 全文读；对 `dealCount` / `dealAmount` / `linkedLeadCount` / `copiedCount` / `contentId` / `utmSource` / `viewCount` / `submitCount` / `addCount` / `leadCount` 逐个在 `获客系统/src` 全量搜索写入方；本地库 `BEGIN READ ONLY` 事务内 17 条 `count(*)`；`backend/src/{models,services,routes,jobs,constants}` 与 `frontend/src/pages` 目录清点 + 关键服务通读。

**未查证 / 未找到**：

- **未访问生产环境。** 所有行数均来自本地 `growth_os`，不能据此推断生产数据分布。
- **ZhiFlow 的 MySQL 库未连接**，其表的实际行数（尤其 `appointments` / `customer_cards` 是否真有生产数据）**未核实**。本文对 ZhiFlow 的所有"有数据"判断，依据是**代码里存在写入路径**，而非观测到真实数据。
- **未找到**任何两套系统之间的集成代码：在 `backend/src` 与 `frontend/src` 中搜索 `获客系统` / `growth_os` / `growth-os`，零命中。
- **未找到** ZhiFlow 裂变模块的美业专属参数化配置，因此环 9 只判定"能力存在"，不判定"美业可用"。
- **未查证** ZhiFlow 各模块在生产是否真的启用（除已确认默认关闭的复购扫描 cron 外）。
