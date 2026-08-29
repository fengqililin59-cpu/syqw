# AI美业获客增长系统 — MVP产品PRD

> 版本：v1.0 | 日期：2026-08-28 | 状态：待评审
>
> 核心原则：**2-3周可上线，先验证美容院老板是否愿意付费，再扩展功能。**

---

## 一、产品定位

**一句话定位：** 帮美容院/皮肤管理门店用AI持续获客的增长引擎。

**不是CRM，不是ERP，不是AI聊天机器人。** 唯一价值：让老板花更少的钱，获得更多的精准客户。

**目标用户：** 美容院、皮肤管理门店的老板或运营负责人。

**核心场景：** 老板不懂营销、不会写文案、不会投广告、不知道怎么做活动——系统每天告诉他"今天做什么"，并且直接帮他生成可以用的内容。

---

## 二、现有资产分析（为什么要重新造轮子 vs 复用）

### 2.1 Growth OS 已有能力（直接复用）

| 模块 | 已有模型/功能 | MVP复用方式 |
|---|---|---|
| 内容生成管道 | ContentProject → ContentDraft → ContentVersion（5阶段工作流） | 增加美业专用prompt模板，前端增加美业内容类型 |
| 线索管理 | Lead → LeadEvent → LeadScoreHistory（4维AI评分） | 扩展美业专属字段（感兴趣项目、预算范围） |
| 落地页 | LandingPage → LandingPageVersion（模板化） | 增加美业专属模板（预约表单、项目咨询） |
| AI适配器 | LLMAdapter（通义/DeepSeek/火山/百度/腾讯 5家） | 直接复用，增加美业专用system prompt |
| Agent基础设施 | AgentInvocation, WorkflowRun, MemoryItem(pgvector) | 直接复用，构建美业专用Agent |
| 用户认证 | NextAuth v5（手机号+验证码/邮箱+密码） | 直接复用 |
| 计费系统 | Subscription, Order（支付宝/微信支付） | 直接复用 |
| 发布基础设施 | PublishTask → PublishLog | MVP阶段先不做，后续迭代 |
| 分析报表 | AnalysisReport → ReportDimension | 扩展老板驾驶舱视图 |

### 2.2 中数云科CRM 已有能力（API对接）

| 模块 | 说明 | MVP对接方式 |
|---|---|---|
| 客户管理 | 完整CRM pipeline（新线索→成交） | MVP不集成，线索数据通过API推送 |
| 企微集成 | 完整的企微消息/联系人/回调 | MVP不集成，后续通过API对接 |
| AI意图评分 | 70%规则+30%AI混合评分 | 线索推送后由CRM侧评分 |
| 知识库/RAG | 文档分块+向量检索 | 后续用于美业知识问答 |

### 2.3 MVP需要新建的

只有三件事是真正需要"新建"的：

1. **BeautyStore 数据模型** — 门店信息+AI分析结果（约5个新表）
2. **美业AI Prompt库** — 门店分析、内容生成、线索评分的专用prompt（核心壁垒）
3. **老板驾驶舱页面** — 全新的首页视图，聚焦获客指标

其余全部复用Growth OS已有基础设施。

---

## 三、MVP功能范围（砍到骨头）

### 3.1 做（P0 — MVP必须）

| 功能 | 说明 | 复用/新建 |
|---|---|---|
| 门店入驻向导 | 3步完成门店信息录入+AI分析 | 新建（基于ProductProfile扩展） |
| AI门店分析 | 输入门店信息→输出定位、卖点、客户画像 | 新建prompt，复用Agent基础设施 |
| AI内容生成（美业版） | 小红书笔记/朋友圈/短视频脚本/活动文案 | 复用ContentProject，新建prompt |
| 线索收集落地页 | 美业专属模板，客户扫码填信息 | 复用LandingPage，新建模板 |
| AI线索评分 | 自动评分+跟进建议 | 复用Lead评分，增加美业维度 |
| 老板驾驶舱 | 今日指标+AI建议+趋势 | 新建页面 |
| 线索通知 | 新线索微信/短信通知老板 | 复用Notification |

### 3.2 不做（P1/P2 — 后续迭代）

| 功能 | 原因 | 计划阶段 |
|---|---|---|
| 多平台自动发布 | 依赖第三方API权限，开发周期长 | Phase 2 |
| AI投流 | 涉及资金风险，需要充分测试 | Phase 3 |
| AI短视频生成 | 调用已有短剧系统即可，不需要新引擎 | Phase 2 |
| 竞品分析 | 数据来源不稳定，MVP阶段价值有限 | Phase 2 |
| 行业分析报告 | 外部数据依赖重，先靠AI推断 | Phase 2 |
| CRM深度集成 | 先跑通独立价值，再对接 | Phase 2 |
| 企微集成 | 同上 | Phase 2 |
| 多门店/连锁 | MVP只做单店 | Phase 3 |
| 团队协作 | MVP老板单人使用 | Phase 2 |

---

## 四、用户流程

### 4.1 核心闭环

```
老板注册
  ↓
门店入驻向导（3步）
  ↓
AI分析门店 → 生成定位+客户画像+内容策略
  ↓
┌─────────────────────────────────────────┐
│            核心循环（每天）                │
│                                         │
│  AI生成内容 → 老板复制使用               │
│       ↓                                 │
│  客户扫码 → 线索进入系统                  │
│       ↓                                 │
│  AI评分 → 通知老板                       │
│       ↓                                 │
│  老板跟进 → 预约/到店/成交               │
│       ↓                                 │
│  数据回流 → AI优化建议                    │
│       ↓                                 │
│  AI调整策略 → 生成新内容                  │
└─────────────────────────────────────────┘
```

### 4.2 门店入驻向导流程

**Step 1 — 基本信息（60秒）**
- 门店名称
- 所在城市 + 商圈（下拉选择）
- 门店类型：美容院 / 皮肤管理 / 美容院+皮肤管理
- 门店面积：50㎡以下 / 50-100㎡ / 100-200㎡ / 200㎡以上
- 员工数量：1-3人 / 4-8人 / 9-15人 / 15人以上

**Step 2 — 项目与价格（2分钟）**
- 主营项目（多选+自定义）：
  - 基础护肤（面部清洁/补水/保湿）
  - 问题肌肤（祛痘/祛斑/敏感肌修复）
  - 抗衰紧致（热拉提/超声刀/射频）
  - 身体项目（减肥/塑形/养生）
  - 半永久（纹眉/美瞳线/漂唇）
  - 其他（自定义输入）
- 各项目价格区间（低-高）
- 客单价区间：100以下 / 100-300 / 300-500 / 500-1000 / 1000以上
- 上传门店环境照片（最多5张，可选）
- 上传项目案例照片（最多5张，可选）

**Step 3 — AI分析（等待30秒）**
- 系统自动分析，展示进度动画
- 分析完成后展示：
  - 门店定位建议（一句话）
  - 核心卖点（3-5个）
  - 目标客户画像（2-3个）
  - 推荐引流项目
  - 推荐高利润项目
  - 内容策略方向

### 4.3 内容生成流程

```
老板进入"AI内容中心"
  ↓
选择内容类型：
  ├── 小红书笔记（种草/测评/科普/案例）
  ├── 朋友圈文案（日常/活动/案例/促销）
  ├── 短视频脚本（口播/vlog/情景剧/对比）
  ├── 抖音文案（标题+描述+话题标签）
  └── 活动方案（节日/周年庆/引流/裂变）
  ↓
选择目标：
  ├── 引流获客（新客到店）
  ├── 项目推广（特定项目）
  ├── 品牌宣传（信任建设）
  └── 促活复购（老客回流）
  ↓
AI根据门店信息+客户画像+当前策略自动生成
  ↓
老板预览 → 微调 → 复制/保存
  ↓
系统记录：哪条内容被复制了 → 关联线索来源
```

### 4.4 线索收集流程

```
老板生成专属落地页/二维码
  ↓
选择落地页模板：
  ├── 项目预约型（选项目+选时间+留电话）
  ├── 免费咨询型（描述需求+留电话）
  ├── 活动报名型（选优惠+留电话）
  └── 空白自定义型
  ↓
生成链接+二维码
  ↓
老板把二维码放在：
  ├── 门店前台
  ├── 小红书评论区
  ├── 朋友圈
  ├── 短视频评论区
  └── 传单/海报
  ↓
客户扫码 → 填写信息 → 提交
  ↓
系统自动：
  ├── 记录线索信息
  ├── AI评分（意向度/消费力/匹配度/完整度）
  ├── 打标签（来源/项目/区域）
  ├── 通知老板（站内+短信/微信）
  └── 给出跟进建议
```

### 4.5 老板驾驶舱流程

```
老板登录 → 首页
  ↓
第一眼看到：
  ├── 今日新增线索数
  ├── 本周线索趋势（↑↓）
  ├── 待跟进线索数
  ├── 本月内容生成数
  ├── 累计获客成本（手动输入广告费时）
  └── AI今日建议（3条）
  ↓
点击"AI今日建议"：
  ├── "今天建议发2条朋友圈，主题：夏季补水"
  ├── "有3条高意向线索待跟进，建议优先联系"
  └── "本周小红书笔记效果最好，建议多产出"
  ↓
点击进入各模块操作
```

---

## 五、页面地图

```
AI美业获客系统（基于Growth OS路由结构）
│
├── /zh（已有，复用）
│   ├── /login（已有）
│   ├── /register（已有）
│   │
│   ├── /beauty（新建 — 美业专属路由组）
│   │   ├── /onboarding（门店入驻向导 — 3步）
│   │   │   ├── /step-1（基本信息）
│   │   │   ├── /step-2（项目与价格）
│   │   │   └── /step-3（AI分析结果）
│   │   │
│   │   ├── /dashboard（老板驾驶舱 — 首页）
│   │   │
│   │   ├── /content（AI内容中心）
│   │   │   ├── /new（生成新内容）
│   │   │   └── /[id]（内容详情/编辑）
│   │   │
│   │   ├── /leads（线索管理）
│   │   │   └── /[id]（线索详情+跟进记录）
│   │   │
│   │   ├── /landing（落地页/二维码管理）
│   │   │   ├── /new（创建新落地页）
│   │   │   └── /[id]（编辑/查看数据）
│   │   │
│   │   ├── /store（门店设置）
│   │   │   ├── /profile（门店信息编辑）
│   │   │   └── /analysis（AI分析报告查看）
│   │   │
│   │   └── /settings（系统设置）
│   │       ├── /notification（通知设置）
│   │       └── /billing（计费/套餐）
│   │
│   └── /lp/beauty（公开落地页 — 美业专属）
│       ├── /[storeId]（门店专属线索收集页）
│       └── /[storeId]/submit（提交成功页）
```

---

## 六、数据库设计（增量变更）

### 6.1 新增模型

```prisma
// ============================================
// 美业门店
// ============================================
model BeautyStore {
  id              String    @id @default(cuid())
  userId          String    // 关联Growth OS的User
  storeName       String    // 门店名称
  city            String    // 城市
  district        String    // 商圈
  storeType       String    // BEAUTY_SALON / SKIN_CARE / BOTH
  area            String    // 面积区间
  staffCount      String    // 员工数量
  avgPrice        String    // 客单价区间
  
  // 项目信息（JSON结构）
  services        Json      // [{name, category, priceLow, priceHigh}]
  // category: BASIC_SKIN / PROBLEM_SKIN / ANTI_AGING / BODY / SEMI_PERMANENT / OTHER
  
  // 品牌资料
  brandDesc       String?   @db.Text  // 品牌介绍
  photos          Json?     // 门店/项目照片URL数组
  
  // AI分析结果
  aiPositioning   String?   @db.Text  // AI定位建议
  aiSellingPoints Json?     // AI核心卖点
  aiPersonas      Json?     // AI客户画像
  aiStrategy      Json?     // AI内容策略
  aiRecommendations Json?   // AI推荐（引流项目、高利润项目等）
  
  // 分析状态
  analysisStatus  String    @default("PENDING")  // PENDING / ANALYZING / DONE / FAILED
  analysisError   String?   @db.Text
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 关联
  user            User      @relation(fields: [userId], references: [id])
  landingPages    BeautyLandingPage[]
  
  @@index([userId])
}

// ============================================
// 美业落地页（扩展LandingPage，增加美业专属字段）
// ============================================
model BeautyLandingPage {
  id              String    @id @default(cuid())
  storeId         String    // 关联BeautyStore
  slug            String    @unique  // URL友好标识
  
  // 页面配置
  templateType    String    // APPOINTMENT / CONSULTATION / PROMOTION / CUSTOM
  title           String    // 页面标题
  subtitle        String?   // 副标题
  heroImage       String?   // 头图URL
  services        Json?     // 可选项目列表（从门店继承或自定义）
  promotion       Json?     // 优惠信息（活动型模板）
  customContent   Json?     // 自定义内容块
  
  // 线索收集配置
  formFields      Json      // 表单字段配置
  // 默认：[{name: "姓名", required: true}, {name: "电话", required: true, type: "phone"}, {name: "感兴趣项目", type: "select"}, {name: "留言", type: "textarea"}]
  
  // 统计
  viewCount       Int       @default(0)
  submitCount     Int       @default(0)
  
  // 状态
  isActive        Boolean   @default(true)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 关联
  store           BeautyStore @relation(fields: [storeId], references: [id])
  leads           BeautyLead[]
  
  @@index([storeId])
  @@index([slug])
}

// ============================================
// 美业线索（扩展Lead，增加美业专属字段）
// ============================================
model BeautyLead {
  id              String    @id @default(cuid())
  storeId         String    // 关联BeautyStore
  landingPageId   String?   // 来源落地页
  
  // 客户信息
  name            String?   // 姓名
  phone           String    // 电话（必填）
  interestedService String? // 感兴趣的项目
  budget          String?   // 预算范围
  message         String?   @db.Text  // 留言
  
  // 来源追踪
  source          String    // QR_CODE / XIAOHONGSHU / DOUYIN / WECHAT / OTHER
  sourceDetail    String?   // 具体来源详情（哪篇笔记/哪个视频）
  utmSource       String?
  utmMedium       String?
  utmCampaign     String?
  
  // AI评分（复用Growth OS的评分逻辑，增加美业维度）
  aiScore         Int?      // 0-100总分
  aiGrade         String?   // S/A/B/C
  aiScoreDetail   Json?     // {completeness, intent, heat, value}
  aiFollowUp      String?   @db.Text  // AI跟进建议
  
  // 跟进状态
  status          String    @default("NEW")  // NEW / CONTACTED / INTERESTED / BOOKED / VISITED / DEAL / LOST
  followUpNotes   Json?     // [{date, note, nextAction}]
  
  // 关联内容
  contentId       String?   // 如果来自某条AI生成的内容
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  // 关联
  store           BeautyStore @relation(fields: [storeId], references: [id])
  landingPage     BeautyLandingPage? @relation(fields: [landingPageId], references: [id])
  
  @@index([storeId])
  @@index([status])
  @@index([aiGrade])
  @@index([createdAt])
}

// ============================================
// 美业内容（扩展ContentProject，增加美业专属字段）
// ============================================
model BeautyContent {
  id              String    @id @default(cuid())
  storeId         String    // 关联BeautyStore
  
  // 内容信息
  contentType     String    // XIAOHONGSHU / MOMENTS / SHORT_VIDEO / DOUYIN / CAMPAIGN
  contentGoal     String    // ACQUISITION / PROMOTION / BRANDING / RETENTION
  targetPersona   String?   // 目标客户画像标识
  
  // 生成参数
  topic           String?   // 主题
  style           String?   // 风格（种草/专业/轻松/促销）
  keywords        Json?     // 关键词列表
  
  // 生成结果
  title           String?   // 标题
  body            String?   @db.Text  // 正文
  hashtags        Json?     // 话题标签
  scriptScenes    Json?     // 分镜脚本（短视频用）
  campaignPlan    Json?     // 活动方案（活动型用）
  
  // 使用追踪
  copiedAt        DateTime? // 被复制时间
  copiedCount     Int       @default(0)
  linkedLeadCount Int       @default(0)  // 关联线索数
  
  // 质量评分
  qualityScore    Int?      // 0-100
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([storeId])
  @@index([contentType])
  @@index([createdAt])
}

// ============================================
// AI建议日志（老板驾驶舱的"今日建议"）
// ============================================
model BeautyDailyAdvice {
  id              String    @id @default(cuid())
  storeId         String
  
  adviceDate      DateTime  // 建议日期（按天生成）
  advices         Json      // [{type, title, description, priority, actionUrl?}]
  // type: CONTENT / FOLLOW_UP / OPTIMIZE / STRATEGY
  // priority: HIGH / MEDIUM / LOW
  
  // 数据快照（生成建议时的指标快照）
  metricsSnapshot Json      // {totalLeads, newLeads, pendingFollowUp, contentGenerated, ...}
  
  createdAt       DateTime  @default(now())
  
  @@unique([storeId, adviceDate])
  @@index([storeId, adviceDate])
}
```

### 6.2 对现有模型的修改

```prisma
// User模型增加字段（可选，MVP阶段可不做）
model User {
  // ... 已有字段 ...
  
  // 新增
  currentStoreId  String?   // 当前激活的美业门店ID
  onboardingDone  Boolean   @default(false)  // 是否完成入驻向导
}
```

### 6.3 数据关系图

```
User (已有)
  │
  ├── 1:1 ── BeautyStore (新建)
  │             │
  │             ├── 1:N ── BeautyLandingPage (新建)
  │             │             │
  │             │             └── 1:N ── BeautyLead (新建)
  │             │
  │             ├── 1:N ── BeautyContent (新建)
  │             │
  │             └── 1:N ── BeautyDailyAdvice (新建)
  │
  └── 复用 ── ContentProject (已有，可选关联)
  └── 复用 ── Lead (已有，可选关联)
```

---

## 七、API设计

### 7.1 门店管理

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/beauty/store` | 创建门店（入驻向导Step 1-2提交） |
| GET | `/api/beauty/store` | 获取当前用户的门店信息 |
| PUT | `/api/beauty/store` | 更新门店信息 |
| POST | `/api/beauty/store/analyze` | 触发AI分析（入驻向导Step 3） |
| GET | `/api/beauty/store/analysis` | 获取AI分析结果 |

### 7.2 内容生成

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/beauty/content/generate` | AI生成内容（流式返回） |
| GET | `/api/beauty/content` | 获取内容列表（分页+筛选） |
| GET | `/api/beauty/content/[id]` | 获取内容详情 |
| PUT | `/api/beauty/content/[id]` | 编辑内容 |
| POST | `/api/beauty/content/[id]/copy` | 记录复制动作 |
| GET | `/api/beauty/content/stats` | 内容效果统计 |

### 7.3 线索管理

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/lp/beauty/[slug]/submit` | 客户提交线索（公开接口） |
| GET | `/api/beauty/leads` | 获取线索列表（分页+筛选） |
| GET | `/api/beauty/leads/[id]` | 获取线索详情 |
| PUT | `/api/beauty/leads/[id]` | 更新线索状态/添加跟进记录 |
| POST | `/api/beauty/leads/[id]/score` | 重新AI评分 |
| GET | `/api/beauty/leads/stats` | 线索统计（新增数、跟进数等） |

### 7.4 落地页管理

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/beauty/landing` | 创建落地页 |
| GET | `/api/beauty/landing` | 获取落地页列表 |
| GET | `/api/beauty/landing/[id]` | 获取落地页详情 |
| PUT | `/api/beauty/landing/[id]` | 更新落地页 |
| GET | `/api/beauty/landing/[id]/stats` | 落地页数据（浏览/提交） |
| GET | `/lp/beauty/[slug]` | 公开：落地页渲染（SSR） |

### 7.5 老板驾驶舱

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/beauty/dashboard` | 驾驶舱数据（今日指标+趋势） |
| GET | `/api/beauty/dashboard/advice` | 今日AI建议 |
| POST | `/api/beauty/dashboard/advice/generate` | 生成今日AI建议 |

---

## 八、AI Agent设计（MVP精简版）

MVP不做11个Agent。只做3个，每个都复用Growth OS已有的Agent基础设施。

### 8.1 门店分析Agent

```
名称：beauty-store-analyst
输入：
  - 门店基本信息（城市、商圈、类型、项目、价格）
  - 门店照片（可选，调用多模态模型分析）
  
处理流程：
  1. 构建system prompt（美业市场专家角色）
  2. 注入门店信息
  3. 调用LLM生成分析结果
  4. 结构化输出（JSON Schema约束）
  
输出：
  - positioning: 门店定位建议（一句话）
  - sellingPoints: 核心卖点（3-5个）
  - personas: 客户画像（2-3个，每个含：年龄段、消费力、需求、痛点、偏好）
  - recommendedServices: 推荐引流项目+高利润项目+复购项目
  - contentStrategy: 内容策略方向（主题+风格+频率）
  - competitiveAdvantage: 竞争优势分析
  - risks: 潜在风险

调用模型：通义千问Max / DeepSeek（性价比最优）
上下文：无外部数据依赖，纯AI分析
异常处理：分析失败时返回预设的通用分析模板
```

### 8.2 内容生成Agent

```
名称：beauty-content-creator
输入：
  - 门店信息（从BeautyStore读取）
  - 客户画像（从AI分析结果读取）
  - 内容类型（小红书/朋友圈/短视频/抖音/活动）
  - 内容目标（引流/推广/品牌/复购）
  - 主题/关键词（可选，用户指定）
  - 风格（种草/专业/轻松/促销）

处理流程：
  1. 读取门店分析结果作为上下文
  2. 根据内容类型选择对应prompt模板
  3. 注入客户画像信息（让内容更精准）
  4. 调用LLM流式生成
  5. 后处理：提取标题、正文、标签（小红书/抖音）
  6. 质量评分（合规性+营销力+可读性）

输出：
  - 小红书：标题(20字内) + 正文(300-800字) + 标签(10-15个) + 封面建议
  - 朋友圈：正文(100-300字) + 配图建议
  - 短视频：脚本(分镜+台词+画面描述+时长) + 标题 + 话题标签
  - 抖音：标题(含钩子) + 描述 + 话题标签
  - 活动方案：主题+时间+内容+优惠+执行步骤

调用模型：通义千问Max（中文内容质量最好）
上下文：门店信息+客户画像（每次生成时注入，不需要持久化记忆）
异常处理：生成失败重试1次，仍失败则返回错误提示
```

### 8.3 线索评分Agent

```
名称：beauty-lead-scorer
输入：
  - 线索信息（姓名、电话、感兴趣项目、预算、留言）
  - 来源信息（从哪个平台/哪条内容来的）
  - 门店信息（项目列表、价格区间）

处理流程：
  1. 完整度评分（25分）：填写了多少字段
  2. 意向度评分（30分）：
     - 明确提到具体项目 → 高分
     - 提到预算 → 高分
     - 留言中有紧迫词汇（"马上"、"最近"、"急需"）→ 高分
  3. 消费力评分（25分）：
     - 预算与门店客单价匹配度
     - 感兴趣项目的价格区间
  4. 匹配度评分（20分）：
     - 需求与门店主营项目的匹配度
     - 地理位置（同城/同商圈）
  5. 汇总评分 → S(85+)/A(70-84)/B(50-69)/C(<50)
  6. 生成跟进建议

输出：
  - score: 0-100
  - grade: S/A/B/C
  - detail: {completeness, intent, heat, value}
  - followUpAdvice: "建议24小时内电话回访，重点介绍XX项目，强调XX卖点"
  - recommendedAction: CALL / WECHAT / SMS
  - urgency: HIGH / MEDIUM / LOW

调用模型：不需要LLM，纯规则引擎（MVP阶段）
异常处理：评分异常时默认给B级
```

### 8.4 每日建议Agent（轻量级）

```
名称：beauty-daily-advisor
输入：
  - 门店信息
  - 今日指标快照（新增线索、待跟进、内容生成数等）
  - 近7天趋势数据
  - 已生成的内容列表（哪些被复制了）

处理流程：
  1. 分析指标趋势（环比）
  2. 识别瓶颈（线索少？跟进慢？内容没效果？）
  3. 生成3条针对性建议
  4. 按优先级排序

输出：
  - advices: [{type, title, description, priority, actionUrl?}]
  - 例：
    - {type: "FOLLOW_UP", title: "3条高意向线索待跟进", description: "建议今天优先联系张女士（祛痘项目）...", priority: "HIGH"}
    - {type: "CONTENT", title: "今天建议发2条朋友圈", description: "主题：夏季补水项目，参考昨天的笔记风格...", priority: "MEDIUM"}
    - {type: "OPTIMIZE", title: "小红书笔记效果最好", description: "本周3条小红书带来了8条线索，建议加大产出...", priority: "MEDIUM"}

调用模型：通义千问Turbo（轻量快速，成本低）
```

---

## 九、美业AI Prompt策略（核心壁垒）

这是产品的核心壁垒——不是技术，是**美业领域的prompt工程积累**。

### 9.1 Prompt架构

```
System Prompt（固定）
  ├── 角色定义：你是美业营销专家，专注美容院/皮肤管理门店获客
  ├── 行业知识：美业常见项目、价格区间、客户心理、营销方法论
  ├── 输出规范：格式要求、字数限制、合规要求
  └── 禁止事项：不做医疗承诺、不用绝对化用语、不虚假宣传

Context（每次注入）
  ├── 门店信息：名称、定位、卖点、项目、价格
  ├── 客户画像：目标客户特征
  └── 当前策略：本月重点推广项目/活动

User Prompt（用户触发）
  ├── 内容类型 + 目标 + 主题 + 风格
  └── 特殊要求（可选）
```

### 9.2 内容类型Prompt模板（MVP需要5套）

**小红书笔记Prompt核心指令：**
- 标题：20字以内，含emoji，用数字+痛点+解决方案结构
- 正文：300-800字，分段清晰，口语化，适当emoji
- 标签：10-15个，含热门话题+长尾关键词
- 禁止：医疗效果承诺、绝对化用语、虚假案例

**朋友圈文案Prompt核心指令：**
- 100-300字，像朋友分享而非广告
- 场景化：描述客户体验过程/效果
- 配图建议：拍什么、怎么拍
- 评论区互动话术

**短视频脚本Prompt核心指令：**
- 分镜格式：画面描述 | 台词/旁白 | 时长 | 字幕
- 前3秒必须有钩子（痛点/悬念/反转）
- 总时长控制在30-60秒
- 结尾必须有行动号召（关注/评论/私信）

**抖音文案Prompt核心指令：**
- 标题：含钩子，引发好奇/共鸣
- 描述：简短有力，含关键词
- 话题标签：5-10个，混合大话题+精准话题

**活动方案Prompt核心指令：**
- 活动主题（节日/周年庆/季节/引流）
- 优惠设计（折扣/套餐/赠品/裂变）
- 执行时间表
- 宣传文案配套
- 预期效果估算

### 9.3 合规红线

所有AI生成内容必须遵守：
- 《广告法》：不用"最好"、"第一"、"100%有效"等绝对化用语
- 《医疗美容服务管理办法》：不暗示医疗效果（"根治"、"永久"）
- 《消费者权益保护法》：不虚假宣传
- 平台规则：小红书/抖音社区规范

实现方式：在system prompt中硬编码禁止词列表 + 生成后正则校验。

---

## 十、商业化设计

### 10.1 套餐定价

| 套餐 | 月价 | 年价（8折） | AI内容生成/月 | 线索收集 | 门店数 | 核心功能 |
|---|---|---|---|---|---|---|
| **免费体验** | ¥0 | - | 10条 | 20条/月 | 1 | 内容生成+线索收集 |
| **基础版** | ¥198 | ¥1,898 | 100条 | 200条/月 | 1 | +AI分析+数据看板 |
| **专业版** | ¥398 | ¥3,820 | 500条 | 1000条/月 | 1 | +高级分析+优先客服 |
| **连锁版** | ¥998 | ¥9,580 | 2000条 | 5000条/月 | 5 | +多门店+团队协作 |
| **企业版** | 联系销售 | 联系销售 | 不限 | 不限 | 不限 | +定制+API+专属服务 |

### 10.2 单位经济模型

| 指标 | 估算 | 说明 |
|---|---|---|
| AI成本/条内容 | ¥0.02-0.05 | 通义千问Max，约2000 token/条 |
| AI成本/次线索评分 | ¥0（规则引擎） | 不调用LLM |
| AI成本/次日建议 | ¥0.01 | 通义千问Turbo |
| 服务器成本/用户/月 | ¥5-10 | 阿里云ECS分摊 |
| 短信通知成本/条 | ¥0.04 | 阿里云短信 |
| **免费用户月成本** | **¥2-5** | 低用量 |
| **付费用户月成本** | **¥15-30** | 高用量 |
| **基础版毛利** | **85-92%** | ¥198 - ¥15-30 |
| **专业版毛利** | **92-96%** | ¥398 - ¥15-30 |
| 目标续费率 | 70%+ | 月付用户 |
| 盈亏平衡点 | ~50个付费用户 | 覆盖固定成本（服务器+域名+短信） |

### 10.3 获客策略（自用）

目标客户是美容院老板，获客渠道：
- **小红书种草**：发"美容院老板必备工具"类笔记（用自己的产品生成）
- **抖音短视频**：展示产品功能，演示AI生成内容
- **美业社群**：微信群/美博会/行业论坛
- **免费体验引流**：10条免费内容+20条线索收集
- **老带新裂变**：推荐1个老板注册，送10条AI额度

---

## 十一、开发排期（2-3周）

### Week 1：核心基础

| 天 | 任务 | 产出 |
|---|---|---|
| Day 1 | 数据库迁移：新建5个模型 | schema + migration文件 |
| Day 2 | 门店入驻向导（后端API + 前端页面） | 3步向导完成 |
| Day 3 | AI门店分析Agent + API | 分析结果输出 |
| Day 4 | AI内容生成（小红书+朋友圈prompt） | 内容可生成 |
| Day 5 | 内容中心前端页面 | 生成+预览+复制 |

### Week 2：线索闭环

| 天 | 任务 | 产出 |
|---|---|---|
| Day 6 | AI内容生成（短视频脚本+抖音+活动） | 5种内容类型全覆盖 |
| Day 7 | 落地页模板（预约型+咨询型） | 落地页可创建 |
| Day 8 | 线索收集公开页面 + API | 客户可提交线索 |
| Day 9 | 线索评分（规则引擎）+ 列表页 | 线索自动评分 |
| Day 10 | 线索详情页 + 跟进记录 | 老板可跟进 |

### Week 3：驾驶舱+打磨

| 天 | 任务 | 产出 |
|---|---|---|
| Day 11 | 老板驾驶舱页面 | 首页指标展示 |
| Day 12 | AI每日建议Agent | 今日建议功能 |
| Day 13 | 线索通知（站内通知+短信） | 新线索通知老板 |
| Day 14 | 计费套餐对接（复用已有billing） | 付费可开通 |
| Day 15 | 端到端测试 + Bug修复 + 上线 | MVP上线 |

---

## 十二、技术风险

| 风险 | 等级 | 应对 |
|---|---|---|
| AI生成内容质量不稳定 | 中 | 多模型fallback + prompt持续优化 + 用户反馈机制 |
| AI生成内容违规 | 高 | 硬编码禁止词 + 正则校验 + 人工审核提示 |
| 落地页被平台封禁 | 中 | 使用自有域名 + 遵守各平台规则 + 不做诱导分享 |
| 数据库迁移冲突 | 低 | Growth OS用Prisma，迁移管理成熟 |
| AI API调用成本超预期 | 低 | 设置每用户每日限额 + 使用性价比高的模型 |
| 美容院老板不会用 | 中 | 极简UI + 引导教程 + 微信客服 |

---

## 十三、合规风险

| 风险 | 说明 | 应对 |
|---|---|---|
| 广告法合规 | AI生成内容可能含违规用语 | 生成前prompt约束 + 生成后正则校验 |
| 个人信息保护 | 线索收集涉及手机号等个人信息 | 隐私政策 + 数据加密 + 最小收集原则 |
| 美容行业特殊规定 | 不得暗示医疗效果 | prompt中硬编码禁止 + 分类审查 |
| 平台规则 | 各内容平台有自己的社区规范 | 按平台差异化prompt + 定期更新规则库 |

---

## 十四、成功指标（MVP上线30天）

| 指标 | 目标 | 说明 |
|---|---|---|
| 注册用户数 | 50+ | 美容院老板 |
| 完成入驻向导 | 30+ | 60%转化率 |
| 生成内容条数 | 500+ | 平均每人15条以上 |
| 创建落地页数 | 20+ | 至少2/3活跃用户创建 |
| 收集线索数 | 100+ | 证明线索收集链路跑通 |
| 付费转化 | 5+ | 10%付费率 |
| 用户反馈NPS | 30+ | 用户愿意推荐 |

**核心验证问题：美容院老板是否愿意为"AI帮我写内容+帮我收线索"付费？**

如果30天内有5个以上付费用户 → 验证成功，继续迭代。
如果没有 → 调整方向或重新审视产品价值。

---

## 十五、未来扩展路径

### Phase 2（MVP验证后1-2个月）

- 多平台发布对接（小红书开放平台、抖音开放平台）
- AI短视频生成（调用已有短剧系统API）
- 竞品分析模块（基于公开数据+AI推断，明确标注）
- CRM/企微对接（与中数云科CRM API打通）
- 团队协作（多角色：老板+运营+美容师）
- 知识库（美业话术库、项目知识FAQ）

### Phase 3（3-6个月）

- AI投流（先做分析建议，人工确认后执行）
- 行业分析报告（接入第三方数据源）
- 多门店/连锁管理
- 高级数据分析（归因分析、ROI计算）
- 美业社区（老板交流、案例分享）

### Phase 4（6-12个月）

- 扩展到其他美业细分（医美、美发、美甲）
- 底层行业抽象（行业配置化，非硬编码）
- 代理商/代运营模式
- 开放API生态

### 行业扩展架构设计

```
当前（美业MVP）：
  BeautyStore → BeautyContent → BeautyLead
  美业专用prompt

未来（多行业）：
  Industry（行业配置）
    ├── ServiceCategory（行业服务类目）
    ├── ContentTemplate（行业内容模板）
    ├── PromptSet（行业prompt集）
    ├── LeadScoringRule（行业评分规则）
    └── LandingPageTemplate（行业落地页模板）
  
  Store（通用门店模型）
    ├── industryId → Industry
    ├── 通用字段（名称、城市、商圈...）
    └── industryFields（JSON，行业专属字段）
```

关键：MVP阶段不做这个抽象，先跑通美业。验证成功后再重构为通用架构。过早抽象是初创产品的常见死法。

---

## 十六、竞争壁垒

**为什么美容院不用ChatGPT/DeepSeek？**
- 需要写复杂的prompt → 我们预置了美业专用prompt
- 不了解自己的门店 → 我们自动注入门店信息+客户画像
- 生成内容不精准 → 我们的内容基于门店定位和目标客户
- 没有线索收集能力 → 我们提供落地页+二维码+线索管理
- 没有数据追踪 → 我们追踪哪条内容带来了多少线索

**为什么不用普通CRM？**
- CRM是管理已有客户的 → 我们帮老板获取新客户
- CRM需要手动录入 → 我们自动收集线索
- CRM不生成内容 → 我们每天生成可用的营销内容
- CRM不告诉你该做什么 → 我们每天给AI建议

**为什么不找代运营公司？**
- 代运营月费5000-20000 → 我们月费198-998
- 代运营不了解你的店 → 我们AI深度分析你的店
- 代运营响应慢 → 我们实时生成
- 代运营效果不透明 → 我们数据全透明

**核心壁垒：美业prompt工程积累 + 数据飞轮**
- 每个用户的使用数据反哺prompt优化
- 积累的美业内容模板库越来越丰富
- 线索评分规则越来越精准
- 这是ChatGPT/通用工具无法复制的垂直积累

---

## 附录A：与ChatGPT方案的对比

| 维度 | ChatGPT建议 | 本MVP方案 |
|---|---|---|
| 模块数量 | 15个 | 5个（核心闭环） |
| Agent数量 | 11个 | 3+1个（精简实用） |
| 开发周期 | 未明确 | 2-3周 |
| 技术栈 | 未指定 | 复用Growth OS（Next.js 16 + PostgreSQL + Prisma） |
| 数据来源 | 未解决 | MVP不依赖外部数据，纯AI分析 |
| 商业模式 | 6档定价 | 5档定价（更简洁） |
| 核心验证 | 未定义 | 明确：老板是否愿意付费 |
| 扩展性 | 过度设计 | 先跑通再抽象 |

---

*本文档为MVP阶段产品规划，待确认后立即进入开发阶段。*
