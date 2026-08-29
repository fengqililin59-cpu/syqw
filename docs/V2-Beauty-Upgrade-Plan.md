# 美业获客系统 V2 规划（第三次校准版）— 员工管理 + 门店归属 + 企微集成

> 适用仓库：**`获客系统/`**（独立的嵌套 git 仓库，Next.js App Router + Prisma + **PostgreSQL** + NextAuth）。
> 上一次基线：合并提交 `c12bcf4`。**本次基线：`c12bcf4` + 其上尚未提交的工作树改动**（`git log --oneline c12bcf4..HEAD` 为空，全部新工作都在工作区，未生成新提交）。
> 本文所有"当前状态"结论均由本次代码盘点得出，不引用历史推测。

---

## 本次修订说明

**起因：上一版（合并刚完成时的校准版）已落后于代码。** 上一版列出 20 条缺口、10 个待办共 8–9.5 天。此后完成了两条 P0 安全/功能修复、成交业绩回写、企微凭据加密、迁移 baseline 重置与一条新迁移。本次修订按代码实况逐条重核，把已修项转为"已实现"，把仍存项保留并重排工时。

**本次改写的章节**：本节（修订说明）、第一节完成度总览、2.5 消息推送限频（现状改写）、2.6 PostgreSQL 迁移约束（新增 baseline 重置经验）、2.7 迁移历史（**问题已解决，保留成因与处置记录**）、第三节企微实现盘点（逐文件重核）、阶段 1–4 的"当前状态"与缺口表、阶段 4 工时汇总（重算）、第五节"已实现请勿重做"（重列）、第七节技术决策记录（新增两条已决策事项）、第八节缺口清单（20 条逐条标注已修/仍存）。

**未改动的结论**：第二节 2.1–2.4 的能力边界（企微 API 权限准入、`type`/`scene` 语义、`state` 30 字符上限、回调三件事）、第六节砍掉与延后条目（朋友圈日发布硬上限、客户群 1 条/群/天、平台统一企微应用、内部 HMAC API 架构作废）。

**与上轮描述不符、需要你知晓的一处**：员工业绩四字段的暴露只完成了一半。`dealCount` / `dealAmount` 已在 `api/beauty/employees/route.ts`（列表 select 与创建返回）、`[id]/route.ts`、`beauty/employees/page.tsx` 与 `BeautyEmployeesClient.tsx` 全链路打通并有单测；但 **`specialties` 与 `assignedAt` 仍未出现在任何接口 select 或 UI 中**，PATCH 也不支持编辑 `specialties`。详见 G8。

---

## 一、当前完成度总览（结论先行）

| 分类 | 内容 |
|---|---|
| **已实现** | 阶段 0–3 全部；企微 token/ticket 缓存（advisory lock）、**带 token 自动注入与失效重试的 API 封装**、回调加解密与签名校验、OAuth state 签发验证与 code→userId、活码 CRUD、员工绑定发起、**应用消息与 textcard 推送（已修复必然失败的缺参 bug）**、新线索通知与**出站消息日志**；企微设置 API 与设置页（**已加角色门禁 + 敏感字段不出服务端 + 凭据加密落库**）；活码管理页与分组、员工管理页与 API；**员工成交业绩回写（唯一写入方 + 幂等 + 改派迁移）**；服务端归属与角色收敛；**迁移 baseline 重置与记账修复** |
| **部分实现需补齐** | 企微回调建线索（不分配员工、无手机号、无幂等去重、无 `externalcontact/get` 拉详情、不回写 `CallbackLog.leadId`、不校验 CorpID）；OAuth 登录（换到 userId 后不建会话，且重定向目标页面不存在）；消息推送（已可送达并有日志，但仍是同步直发，无队列/退避/门店级限频，助手页无展示）；员工模块（`specialties` / `assignedAt` 仍不暴露） |
| **完全缺失** | 前端角色可见性收敛（`nav-config.ts` 仍只有 `tier` 维度）；企微能力探测与降级提示（`BeautyWeworkProbe` 语义）；JS-SDK 签名的路由与消费方（lib 已写但零调用）；自动分配开关（`autoAssignEnabled` 字段不存在）；`BeautyLead.assignedEmployeeId` 索引与企微溯源字段（`channelId` / `weworkExternalUserId`） |

**基线验证（本次实测）**：`prisma validate` 通过；`prisma migrate status` 输出 `2 migrations found` + `Database schema is up to date!`；`tsc --noEmit` 零错误；`vitest run` **146 个用例全绿**（`Test Files 1 failed | 15 passed`，唯一失败 suite 是本盘 macOS AppleDouble 垃圾文件 `src/lib/analytics/._service.test.ts`，属既有环境噪音）。

---

## 二、能力边界与降级（必读，结论仍成立）

### 2.1 客户联系（活码）的准入条件

`add_contact_way` 属于「外部联系人管理」能力，**同时**要求：

1. 企业已完成**微信认证**（未认证企业无客户联系功能）；
2. 自建应用已勾选「外部联系人管理」权限；
3. 活码里配置的每个成员**必须已开启客户联系并被分配客户联系额度**，否则该成员会被接口拒绝。

**当前状态：仍未实现探测，属缺口。** `api/beauty/wework/channels/route.ts` 的 POST 直接调 `createContactWay`，失败时把企微原始错误字符串以 500 返回前端。全库 `get_follow_user_list` 零命中，没有任何前置能力探测。补齐要求见 G4。

### 2.2 `type` / `scene` 语义

- `scene`：**1 = 在小程序中联系，2 = 通过二维码联系**。要生成可扫、可下载的二维码，必须 `scene = 2`。
- `type`：1 = 单人，2 = 多人。

**当前状态：取值正确，注释仍然错误。** `src/lib/wework/contact-way.ts:58` 传 `scene: 2`（正确），同行注释仍写着 `// 2 = 在小程序中联系 me`（语义说反）。`type` 按 `employeeIds.length > 1` 自动推导，正确。注释需修正，否则后续维护者会照注释改坏取值（G7）。

### 2.3 `state` 长度上限 30 字符

**当前状态：已正确处理。** `generateChannelState()` 生成 `b{8hex}x{20hex}` = 30 字符，落库到 `BeautyWeWorkChannel.state`（`@unique`），回调时按 `state` 反查渠道，不做任何字符串解析。

### 2.4 回调接口的三件事

1. **echostr 握手**：已实现（`msg-callback/route.ts` GET：验签 → 解密 → 原样返回 `text/plain`）。
2. **签名验证**：已实现，`verifySignature` 使用 `crypto.timingSafeEqual`。POST 验签失败返回 403 且不处理业务。
3. **去重防重放**：**仍未实现，属缺口。** 回调无 `MsgId` 幂等键、无 `timestamp` 新鲜度校验（`timestamp` 只参与签名计算，不做时间窗判断），同一事件重复投递会重复建线索。见 G2。

**回调路由不挂 auth**：已满足（鉴权唯一依赖企微签名）。

**结构性问题仍存**：回调无门店标识，实现方式是**遍历所有配置了企微的门店逐个试签名/试解密**（GET 与 POST 各一处）。本次凭据加密改造已覆盖这两处遍历（`openCredential` 解密后再验签），但 O(N) 结构与"解密后不校验尾部 CorpID"两点未变，列为 G2 的一部分。

### 2.5 消息推送的限频

企微应用消息与外部联系人消息均有频率限制，批量场景会触发 `45009`。

**当前状态：已能送达且失败可见，但仍是同步直发、无限频。**

- 已修复：`sendTextMessage` / `sendTextCardMessage` 改走 `callWeWorkApiWithToken`（`access-token.ts:227`），token 由封装层注入，并在 `40014 / 41001 / 42001` 时 `clearTokenCache` 后重试一次。上一版记录的"缺 `access_token` 导致真实环境 100% 失败"已消除。
- 已修复：不再静默。成功与失败都落 `BeautyWeWorkMessageLog`（`message.ts:27` 的 `recordMessageLog`），只记企微 UserID 与消息类型，手机号等 PII 不入库；失败向上抛出，由调用方决定是否阻塞主流程。
- **仍缺**：门店级限频、指数退避、重试队列、`DEAD` 终态，以及助手页的推送记录展示。批量分配场景仍会撞 `45009` 且撞了就丢。见 G3。

### 2.6 PostgreSQL 特有的迁移约束（含本次新增经验）

| 结论 | 说明 |
|---|---|
| Prisma scalar list（`String[]`）**可用** | 数据库是 PostgreSQL，`schema.prisma` 已有多处在用 |
| `@db.Text` 是显式同义写法 | PG 下 `String` 默认映射 `text`，仓库风格是显式标注，沿用 |
| `text` 列可直接建 btree 索引 | 无需前缀长度（那是 MySQL 限制） |
| **新增枚举值必须单独一个迁移文件** | PG 的 `ALTER TYPE ... ADD VALUE` 新增值不能在同一事务内被使用（`55P04`）。若后续要给 `BeautyLeadSource` 增加企微专属来源值，必须拆两个迁移；当前实现复用 `WECHAT`，可以不动枚举 |
| **新建枚举与使用它的表可以同一个迁移** | 本次 `20260829020000` 里 `CREATE TYPE "BeautyWeWorkMessageStatus"` 与引用它的 `CREATE TABLE` 同文件通过——限制只针对**给已有类型追加值**，不针对新建类型 |
| 枚举值**不可删除** | PG 只支持新增，设计时留余量 |
| 复合唯一约束对 `NULL` 不生效 | `@@unique([storeId, weworkUserId])` 对 `weworkUserId IS NULL` 的多行不做约束——这正是我们要的，但**绑定去重仍需应用层判空**，现有 `employees/[id]` PATCH 与 `oauth-callback` 都做了显式重复检查 |
| 加非空列必须带默认值 | `dealCount` / `dealAmount`（员工）按 `NOT NULL DEFAULT 0` 写；**`BeautyLead.dealAmount` 本次故意建成可空** `DECIMAL(12,2)`，用 `NULL` 表达"未登记金额"，与"成交金额为 0"区分开 |
| **baseline 重置的正确做法（本次新增）** | 旧迁移链因三方合并产生分叉、且含手工伪造记账，无法在全新库上自洽重放。处置：① 旧迁移目录整体归档为 `prisma/_archive-migrations-20260829/`（21 项，**保留不删**，作为历史 SQL 的唯一出处）；② 用 `prisma migrate diff --from-empty --to-config-datasource --script` 生成单文件 baseline 到 `prisma/migrations/20260829010000_baseline/migration.sql`（2050 行）；③ 在全新验证库上 `migrate deploy` 跑通，并用 `migrate diff` 反向确认 `No difference detected.`；④ 开发库先 `pg_dump` 备份 `_prisma_migrations`，再重置记账并 `resolve --applied` 到 baseline |
| **`vector` 扩展需 DBA 预装（本次新增）** | baseline 顶部第 7 行是 `CREATE EXTENSION IF NOT EXISTS "vector";`。这行能在本地跑通是因为本地连接用的是超级用户；**生产的应用角色通常没有建扩展权限，且不应该有**。预发/生产上线前必须由 DBA 预先在目标库执行一次建扩展，应用角色不负责建扩展。若 DBA 已装好，`IF NOT EXISTS` 会让这行成为空操作，无需改文件 |
| 改唯一约束前先跑重复值检查 | `DO $$ ... RAISE EXCEPTION ... $$` 模式已在归档的 `20260829000000` 里验证过，后续迁移沿用该模板（该逻辑已被 baseline 吸收为最终结构） |

### 2.7 迁移历史分叉 ✅ 已解决（保留成因与处置记录）

**状态：已解决。** 本次实测 `prisma migrate status` 输出：

```
2 migrations found in prisma/migrations
Database schema is up to date!
```

**成因记录（供后续复盘，不要删）**：

1. `20260828000000_add_beauty_employee` 在库里无记录，但它要建的 `BeautyEmployee` 表与枚举实际已存在（早期手工 DDL 建出），直接 `deploy` 会因对象已存在而失败。
2. 库里 `20260828000001_beauty_p2_wework` 是一条**手工伪造的记录**（`checksum` 字面值就是 `manual`）。对应的 4 张 `BeautyWeWork*` 表与枚举实际存在且正在被代码使用，问题是"记账不全"而非"结构缺失"。
3. 三方合并让仓库侧的迁移链与库侧记账进一步分叉，两边都无法作为权威。

**处置记录（已执行完毕）**：

| 步骤 | 操作 | 证据 |
|---|---|---|
| 1 | 21 项旧迁移归档到 `prisma/_archive-migrations-20260829/`（含 `migration_lock.toml`）；远端原件仍在 `prisma/_merge-backup/` | 目录存在，**禁止删除** |
| 2 | `migrate diff --from-empty --to-config-datasource` 生成单文件 baseline `prisma/migrations/20260829010000_baseline/migration.sql` | 2050 行，第 7 行 `CREATE EXTENSION IF NOT EXISTS "vector"` |
| 3 | 在验证库 `growth_os_verify2` 上 `migrate deploy` 跑通，反向 `migrate diff` 得 `No difference detected.` | 验证库**禁止删除**（`growth_os_verify` / `growth_os_verify2` 均保留备查） |
| 4 | 开发库 `_prisma_migrations` 先 `pg_dump` 留档（20 条记录）到 `/Volumes/My PSSD/软件开发/备份/growth_os_prisma_migrations-20260829-092217.sql`，再清空重置，`resolve --applied 20260829010000_baseline` | 备份文件存在（10 KB） |
| 5 | 新迁移 `20260829020000_beauty_deal_amount_and_message_log` 在验证库与开发库先后 deploy 成功，diff 无差异 | `migrate status` up to date |

**经验教训**：伪造 `_prisma_migrations` 记录换来的"眼前干净"会在下一次合并时变成不可判定状态。存量结构与迁移链失配时，正解是 baseline 重置（结构为准、历史归档），不是继续补记账。

**红线（任何环境，仍然有效）**：禁止 `migrate reset`、禁止 `DROP TABLE/COLUMN`、禁止手工改写 `_prisma_migrations` 数据行、禁止删除归档目录与验证库。

**预发/生产的处置**：① 由 DBA 预装 `vector` 扩展；② 跑只读核对（`migrate status` + 两个方向的 `migrate diff`）确认线上现有结构与 baseline 的差异；③ 线上若已有这批表（大概率有），**不能直接 deploy baseline**，需按方案「结构已在 → `resolve --applied 20260829010000_baseline` 记账 → 再 deploy `20260829020000`」执行，且 `resolve` 前必须先用 `migrate diff` 证明线上结构与 baseline 一致；④ 若 diff 有差异，先补一条差异迁移，不要动 baseline 文件。

---

## 三、企微实现盘点（`src/lib/wework/` 八个文件逐一）

| 文件 | 实现内容 | 完成度 |
|---|---|---|
| `api.ts` | `callWeWorkApi` 统一封装（URL 拼参、POST JSON、HTTP 非 2xx 抛错、`errcode != 0` 抛带 `errcode` 的 Error）；`getWeWorkConfig(store)` 提取门店配置，**已接入 `openCredential`**（`secret` / `token` / `encodingAesKey` 三处解密，兼容历史明文） | **完整**。缺口：无超时/熔断，无 `errcode` → 语义化 code 映射（G4） |
| `access-token.ts` | `getAccessToken` / `getJsapiTickets` / `clearTokenCache`，PG `pg_try_advisory_xact_lock` + 事务内同连接 + 双重检查 + 内联 `fetchAccessTokenDirect` 防嵌套死锁；**本次新增 `callWeWorkApiWithToken`**（注入 `access_token`，`40014 / 41001 / 42001` 时清缓存重试一次） | **完整且质量高，禁止重写**。小瑕疵仍在：锁等待轮询超时（5s）后不区分成功与超时就继续执行，极端并发下可能出现两次 token 刷新（幂等，仅多一次企微调用） |
| `credentials.ts`（**新增**） | `sealCredential`（`encryptToken` 加密，空值原样返回保持"未配置"语义）、`openCredential`（`v1:` 前缀走解密，无前缀视为历史明文原样返回；解密失败抛 `wework_credential_decrypt_failed` 而非返回空串）、`maskCredential`（先解密再掩码，失败回退 `CREDENTIAL_UNREADABLE` 文案不打挂页面） | **完整**，有 `credentials.test.ts` 覆盖。设计上不做停机迁移，读时兼容明文 |
| `oauth.ts` | `signOAuthState` / `verifyOAuthState`（HMAC-SHA256，5 分钟 TTL，`purpose` 区分 login/bind，nonce 存 Redis 做一次性重放保护）、`buildOAuthUrl`、`getUserIdByCode`（**已改走 `callWeWorkApiWithToken`**） | **完整**。缺的只是会话建立（G1） |
| `contact-way.ts` | `generateChannelState`（30 字符）、`createContactWay`、`updateContactWay`、`deleteContactWay`、`incrementChannelAddCount`；**三处企微调用已改走 `callWeWorkApiWithToken`** | **基本完整**。三个问题未修：① `contact-way.ts:122` 的 `if (name) updateBody.state = channel.state` 仍是无意义赋值且有触发企微报错风险；② `name` 变更只落本地库；③ `createContactWay` 不校验 `groupId` / `beautyEmployeeId` 归属（G7） |
| `msg-crypto.ts` | `verifySignature`（timing-safe）、`decryptMessage`（AES-256-CBC + 手工 PKCS#7 + 协议结构解析）、`encryptMessage`、`signEncryptedReply`、XML 字段正则提取 | **完整**。缺口未变：`decryptMessage` **不校验尾部 CorpID**；`encryptMessage` / `signEncryptedReply` 零调用方 |
| `message.ts` | `sendTextMessage` / `sendTextCardMessage`（均走 `callWeWorkApiWithToken`，成功与失败都落 `BeautyWeWorkMessageLog`，失败向上抛）、`notifyNewLead`（手机号经 `maskPhone` 打码，卡片跳线索详情） | **已修复到可用**。上一版的"缺 `access_token` 必然失败"与"失败静默"两条均已消除。仍缺队列/限频/退避（G3） |
| `js-sdk-sign.ts` | `signJsSdkConfig` / `signAgentConfig` | **实现完整但零接线**，等企微内 H5 时兑现（G6），**不要删** |

### 企微 / 美业 API 路由与 UI 完成度

| 路径 | 内容 | 完成度 |
|---|---|---|
| `api/beauty/settings/wework/route.ts` | GET 返回三个敏感字段的**掩码** + `hasSecret` / `hasToken` / `hasEncodingAesKey` 布尔 + `isConfigured`；PUT 实现「留空或回传含 `•` 的掩码值 = 不修改」，实质新值经 `sealCredential` 加密落库，凭据变更后 `clearTokenCache` | **完整，安全缺陷已修** |
| `beauty/settings/wework/page.tsx` | 页面已加 `canManageStore` 门禁（不满足重定向 `/beauty/dashboard`）；只下发 `secretMasked` / `tokenMasked` / `encodingAesKeyMasked`，明文不出服务端 | **完整，安全缺陷已修** |
| `api/beauty/wework/channels/route.ts` | GET / POST / PUT / DELETE 全套，归属按 `storeId` 过滤，写操作 `canManageStore` + CSRF | **完整**，缺口见 2.1 与 G7 |
| `api/beauty/wework/channels/groups/route.ts` | GET 列表 / POST 创建，写操作 `canManageStore` | **完整**（无更新/删除分组，属功能边界） |
| `api/beauty/wework/msg-callback/route.ts` | GET echostr 握手 / POST 事件推送；遍历门店试解密（已接 `openCredential`）、落 `BeautyWeWorkCallbackLog`、`add_external_contact` 时渠道 `addCount` +1 并建线索 | **部分实现**，见 G2（不分配、无手机号、无去重、`externalcontact/get` 仍是 TODO（`route.ts:233`）、线索名仍是 `企微客户_xxxxxxxx`（`:241`）、`phone` 仍写 `""`（`:242`）、不回写 `leadId`、不校验 CorpID） |
| `api/beauty/wework/oauth-callback/route.ts` | 验 state → code→userId → 绑定/登录两模式 | **部分实现**，见 G1（不建会话；四处 `redirect` 指向 `login-success` / `bind-failed`，而 `beauty/wework/` 目录下**只有 `channels` 一个子目录**，员工扫码实际得 404） |
| `api/beauty/wework/qr-login-url/route.ts` | 返回扫码登录 URL | **完整但零调用方** |
| `api/beauty/wework/bind-employee/route.ts` | 生成绑定模式 OAuth URL，双路门禁 | **完整** |
| `api/beauty/leads/[id]/route.ts` | PATCH 支持状态流转（走 `changeLeadStatus`）、`dealAmount` 入参校验、改派（走 `transferDealStats`）；DELETE 回退 `leadCount` 并冲销业绩 | **完整** |
| `api/beauty/employees/*` | 列表 / 详情 / 创建返回已含 `dealCount` / `dealAmount` | **部分实现**，`specialties` / `assignedAt` 仍未暴露（G8） |
| `beauty/employees/page.tsx` + `BeautyEmployeesClient.tsx` | 员工卡片展示「成交 N 单 · ¥金额」 | **部分实现**，同上 |
| `beauty/wework/channels/page.tsx` + `BeautyChannelsClient.tsx` | 活码列表、增删改、分组、二维码 | **完整** |
| `beauty/wework/login-success` / `bind-failed` | — | **仍不存在**，见 G1 |

---

## 四、阶段章节（按当前现状重写）

### 阶段 0 — 校正规划 ✅ 已完成（本次第三次校准）

**目标**：文档与代码事实一致，团队对"哪些已实现、哪些是真缺口"达成一致。

**关键交付**：`docs/V2-Beauty-Upgrade-Plan.md`（本文件，第三次修订）。

**验收标准**：文档中每条"已实现"结论都能指到具体文件；上一版 20 条缺口逐条给出"已修/仍存"判定；剩余工时只对真正未完成项给出。

**依赖**：无。

**当前状态**：已完成。

---

### 阶段 1 — 员工 CRUD ✅ 已完成

**目标**：`BeautyEmployee` 可用——增删改查员工、列表可筛可搜。

**关键交付（已落地）**

1. Schema：`specialties Json?`、`dealCount Int @default(0)`、`dealAmount Decimal @default(0) @db.Decimal(12,2)`、`assignedAt DateTime?`；三个全局 `@unique` 已换为门店维度 `@@unique([storeId, phone])` / `([storeId, weworkUserId])` / `([storeId, userId])` + `@@index([userId])`。结构已被 `20260829010000_baseline` 吸收。
2. API：`api/beauty/employees/route.ts`（GET 列表分页/筛选/搜索/`groupBy` 计数 / POST 创建）、`[id]/route.ts`（GET / PATCH 含企微绑定与角色变更 / DELETE）。写操作 `canManageStore` + CSRF。
3. 页面 + 导航：`beauty/employees/page.tsx`、`components/beauty/BeautyEmployeesClient.tsx`、`nav-config.ts` 的 `beauty-employees` 项。
4. 命名统一为 `employees`（本地 `staff` 版本已删除）；`User.beautyEmployees` 为一对多（一个账号可在多家门店任职）。

**验收标准**：`prisma validate` 通过 ✅；同一手机号可在两家门店各建员工 ✅；非 OWNER/MANAGER 调写接口 403 ✅；侧边栏中英文标签就位 ✅。

**依赖**：阶段 0。

**当前状态**：已完成。**遗留缺口**：`specialties` / `assignedAt` 两字段仍不暴露（G8，已从上一版的四字段收窄到两字段）。

---

### 阶段 2 — 门店成员归属重构 ✅ 已完成（服务端）

**目标**：员工账号也能访问所属门店数据，并按角色限定可见范围。

**关键交付（已落地）**

1. `src/lib/beauty/resolve-store.ts`：`resolveBeautyStore(session)` → `{ storeId, employeeId, role, scope, availableStores }`；角色映射 `OWNER`/`MANAGER` → `STORE`，`BEAUTICIAN`/`RECEPTIONIST` → `SELF`；`leadScopeWhere(access)` 在 `SELF` 时附加 `assignedEmployeeId`；`canManageStore(access)` 等价 `scope === "STORE"`。
2. 全量替换调用点，美业目录下 `beautyStore.findUnique({ where: { userId } })` 零残留；企微设置、活码、员工、绑定、扫码登录 URL 全部接入。
3. 单测：`resolve-store.test.ts`、`beauty-access.test.ts` + `beauty-access.fixtures.ts`。

**能力边界**：`resolveBeautyStore` 是**单门店解析器**，不接受请求方传入的 `storeId`——所有 API 以解析出的 `access.storeId` 为唯一权威来源，这是当前越权防护的基础。`availableStores` 已返回但无门店切换 UI。

**验收标准**：员工账号访问 `/beauty/dashboard`、`/beauty/leads` 均 200 ✅；`SELF` 角色线索列表只含自己名下记录 ✅；`PATCH` 别人的线索返回 403 `lead_not_in_scope` ✅；五种身份单测全绿 ✅。

**依赖**：阶段 1。

**当前状态**：**服务端已完成，前端仍未收敛**——见 G9（本次复核：`nav-config.ts` 的 `NavItem` 仍只有 `tier` 一个维度，`beauty.children` 对所有角色一视同仁）。

---

### 阶段 3 — 线索分配 ✅ 已完成，并已补齐成交业绩回写

**目标**：线索落到具体员工头上，为企微推送提供收件人；员工业绩可统计。

**关键交付（已落地）**

1. `src/lib/beauty/assign-lead.ts`：`commitAssignment` 事务内条件更新（`updateMany` 命中 0 行返回 `assign_conflict`），旧员工 `leadCount -1`、新员工 `leadCount +1` 且 `assignedAt = now()`；`assignLeadManual`（跨店返回 `employee_not_in_store`）；`assignLeadRoundRobin`（候选为同门店 `ACTIVE` 且 `role in (MANAGER, BEAUTICIAN)`，排序 `assignedAt asc nulls first` → `leadCount asc` → `createdAt asc`）；`autoAssignNewLead`。
2. **`src/lib/beauty/deal-stats.ts`（新增，`dealCount` / `dealAmount` 的唯一写入方）**：
   - `changeLeadStatus(leadId, storeId, fromStatus, toStatus, dealAmount?)`：事务内先条件更新线索状态（`updateMany` + `count !== 1` 判冲突），命中后按方向给负责人原子 `increment` / `decrement`。**天然幂等**——反复 PATCH 成 `DEAL` 只会累加一次，因为第二次的 `fromStatus` 条件已不匹配。
   - `transferDealStats(tx, status, from, to, dealAmount)`：改派/取消分配时的业绩迁移，只在 `status === DEAL` 时动手。
   - 金额策略：`dealAmount` 为空视为 0，计数照常增减、金额不动。
3. 接入点：`api/beauty/leads/[id]/route.ts` 的 PATCH（状态流转 + 改派）与 DELETE、`assign-lead.ts` 的 `commitAssignment`。
4. 口径决策：**业绩随线索走**——改派时旧负责人减、新负责人加，与 `leadCount` 口径一致。
5. 单测：`assign-lead.test.ts`、**`deal-stats.test.ts`（新增，覆盖成交计数、幂等、冲销、改派迁移、金额为空、接口暴露）**。

**验收标准**：连续提交 3 条线索由 3 名在职员工各得 1 条 ✅；停用员工不再获得新线索 ✅；跨门店手动分配 403 ✅；并发条件更新不重复计数 ✅；线索置 `DEAL` 后负责人 `dealCount` +1、`dealAmount` 加上成交金额 ✅；重复 PATCH 不重复累加 ✅；`DEAL` 退回其他状态对称冲销 ✅；已成交线索改派后业绩转移 ✅（均有单测）。

**依赖**：阶段 2。

**当前状态**：已完成。**遗留缺口**：`BeautyStore.autoAssignEnabled` 仍不存在，轮转自动分配**恒开**（G10）；企微活码建线索这第二个创建入口**仍未调分配**（G2）。

---

### 阶段 4 — 企微集成 ⬛ 主体已实现，三条 P0 已清，剩余缺口见下

**目标（不变）**：打通"线索进来 → 推送给负责员工的企微 → 员工在企微内点开系统跟进"，以及"客户扫活码 → 自动建线索并归属到人"。

| 原子阶段 | 现状 |
|---|---|
| 4.0 数据模型 | ✅ 完成。4 张 `BeautyWeWork*` 模型 + `BeautyWeWorkChannelType`，**本次新增 `BeautyWeWorkMessageLog` + `BeautyWeWorkMessageStatus`**。原计划的 `BeautyContactWay` 不再新建 |
| 4.1 门店企微配置 | ✅ **完成**。API + 页面均有 `canManageStore` 门禁，敏感字段掩码下发，凭据 `v1:` 密文落库并兼容历史明文 |
| 4.2 企微内 OAuth 登录 | ⬛ 部分实现：state 签发/验证、code→userId、员工绑定可用；**会话建立与落地页仍缺失**（G1） |
| 4.3 线索推送 | ⬛ 部分实现：**已可真实送达且成功/失败均落库**；缺队列/退避/门店级限频/助手页展示（G3） |
| 4.4 活码 + 回调建线索 | ⬛ 部分实现：活码 CRUD 与 UI 完整、回调验签解密与日志完整；**建线索环节仍残缺**（G2） |
| 4.5 企微助手页 | ⬛ 部分实现：活码管理页已有；推送记录区块（数据源 `BeautyWeWorkMessageLog` 已就绪）与能力状态卡缺失（G3 / G4） |

#### 阶段 4 剩余缺口

**G2 — 补齐回调建线索链路（P0，1.5–2 天）**

- **目标**：客户扫活码后 30 秒内产生一条归属明确、信息完整、不会重复的线索。
- **关键交付**：
  - `api/beauty/wework/msg-callback/route.ts`：以 `MsgId`（或 `CreateTime + FromUserName + ChangeType` 组合）为幂等键去重，重复投递直接返回 `success` 不走业务；`timestamp` 与服务端偏差超 5 分钟拒绝。
  - 归属：优先按事件里的 `FollowUserID` 反查 `BeautyEmployee`（`storeId_weworkUserId`）直接归属，查不到再退到 `autoAssignNewLead`。
  - 客户信息：实现 `route.ts:233` 的 `// TODO: 调用 /externalcontact/get`，填真实昵称/头像/来源，替换 `企微客户_xxxxxxxx`（`:241`）；`BeautyLead.phone` 是必填 `String` 而企微不提供手机号，需明确空值策略（当前写 `""`，会污染评分与去重）。
  - 溯源：写入 `BeautyWeWorkCallbackLog.leadId`；给 `BeautyLead` 加 `channelId` / `weworkExternalUserId`（迁移与 G10 合并一次做），`weworkExternalUserId` 与渠道组唯一约束防"删除再添加"产生重复线索。
  - 门店定位：回调 URL 改为 `/api/beauty/wework/msg-callback/[storeId]`，消除遍历所有门店试解密的 O(N) 结构；`decryptMessage` 后校验尾部 CorpID 与门店配置一致。
- **验收标准**：手机扫码添加员工后 30 秒内出现线索、归属该员工、名称为真实企微昵称；同一客户重复添加/删除再添加不产生第二条线索；同一 `MsgId` 重放不产生第二条线索；偏移 6 分钟的请求被拒；伪造签名 403；CorpID 不匹配的密文被拒；`CallbackLog.leadId` 与线索双向可查。
- **依赖**：`BeautyLead` 字段补充（与 G10 同一迁移）。
- **当前状态**：未开始，全部子项均已复核仍然成立。

**G3 — 推送可靠性：队列 / 退避 / 门店级限频（P1，1–1.5 天）**

- **目标**：批量分配场景不丢消息、不撞 `45009`，失败可见可重试。
- **关键交付**：
  - 新增 `BeautyWeworkOutbox` 模型（`storeId` / `leadId` / `employeeId` / `messageType` / `payload` / `status: PENDING|SENT|FAILED|DEAD` / `attempts` / `nextRetryAt` / `weworkMsgId` / `errorCode` / `errorMsg`，索引 `[status, nextRetryAt]`、`[storeId, createdAt]`、`[leadId]`）。分配成功后在事务内只入队，不同步调企微。
  - 消费者 `api/cron/beauty-wework-outbox/route.ts`：按 `storeId` 分组，门店级限频（每门店每分钟 ≤ 10 条），指数退避 1m/5m/30m/2h/6h，5 次后置 `DEAD`；仅 `45009`/超时/未知上游错误重试，凭据错与权限错直接 `DEAD`。
  - 助手页推送记录区块：数据源用已就绪的 `BeautyWeWorkMessageLog`（成功率、失败明细、`errcode`），`DEAD` 记录可见。
  - `BeautyWeWorkMessageLog.retryCount` 在本阶段接上真实重试次数（当前恒 0，见第七节决策）。
- **验收标准**：同门店 1 分钟内提交 30 条线索无 `45009`，全部在几轮内发完；改错 `corpId` 时线索仍正常创建、outbox 记 `FAILED` 并按退避重试、5 次后 `DEAD`；助手页能看到成功率与失败原因。
- **依赖**：无（`message.ts` 的发送层与日志表已就绪，本项只加队列外壳）。
- **当前状态**：未开始。原 P0 的必修 bug 部分已完成，剩余部分降为 P1。

**G1 — OAuth 登录闭环（P1，1 天）**

- **目标**：员工在企微工作台点开应用能直接落在驾驶舱，未绑定成员看到明确指引而非 404。
- **关键交付**：`oauth-callback` 登录模式下若员工已关联 `userId` 则建立 NextAuth 会话并跳 `/beauty/dashboard`；补建 `beauty/wework/login-success` 与 `bind-failed` 两个页面（或改跳现有页面 + query 提示）；`qr-login-url` 已可用，需在登录页或员工页给出扫码入口 UI。
- **验收标准**：员工在企微工作台点开应用静默落在驾驶舱；未绑定成员看到绑定指引页而非 404；state 过期/被篡改返回 400 且不建会话；同一 `code` 第二次使用失败（nonce 已消费）。
- **依赖**：无。
- **当前状态**：未开始（四处 `redirect` 目标页面本次复核仍不存在）。

**G4 — 企微能力探测与错误码语义化（P1，1 天）**

- **目标**：配置有问题时给出可执行的提示，而不是把企微原始错误字符串直穿给用户。
- **关键交付**：新增 `BeautyWeworkProbe` 模型（`storeId @unique` / `tokenOk` / `followUsers Json` / `missingPerms Json` / `lastError` / `probedAt`）；保存配置后调一次 `externalcontact/get_follow_user_list` 探测落库；活码创建前按 `followUsers` 过滤可用成员，为 0 时返回 `member_not_allowed` 并列出原因；`callWeWorkApi` 的 `errcode` 映射为语义化 code（`credentials_invalid` 40001/40013、`permission_denied` 60011/48002、`not_verified`、`member_not_allowed`、`rate_limited` 45009），前端按 code 显示文案。
- **验收标准**：未认证企业保存配置后页面显示"需完成微信认证"；缺权限时提示去企微后台勾选「外部联系人管理」；能力状态卡显示 token 有效性、可用成员数、缺失权限清单；前端不再出现 `企微 API 错误 [60011]` 这类原始串。
- **依赖**：无。
- **当前状态**：未开始（全库 `get_follow_user_list` 零命中）。

**G9 — 前端角色可见性收敛（P1，0.5–1 天）**

- **本次复核结论：仍未做。** `src/lib/nav-config.ts` 的 `NavItem` 类型只有 `key` / `tier` / `children` 等字段，**唯一的过滤维度是 `tier`（订阅档位）**，没有任何角色维度；`beauty.children` 的子项（含 `beauty-employees`）对所有角色一视同仁地渲染。
- **目标**：低权角色看不到越权入口，而不是"给了按钮又不让按"。
- **关键交付**：给 `NavItem` 加角色维度（如 `requireStoreScope?: boolean`），Server Component 侧按 `resolveBeautyStore` 的 `scope` 过滤后再传给客户端；管理类页面统一加 `canManageStore` 门禁重定向（企微设置页已是范本）；列表页写操作按钮按角色隐藏。
- **验收标准**：`BEAUTICIAN` 登录后侧边栏只见「驾驶舱 / 内容 / 线索」；直接访问管理页 URL 被重定向而非 403 白屏；`OWNER` / `MANAGER` 可见性不变。
- **依赖**：无。
- **当前状态**：未开始。

**G10 — 自动分配开关与线索索引/溯源字段（P2，0.5 天）**

- **目标**：门店能关闭自动分配；员工首屏查询走索引；回调溯源字段就位。
- **关键交付**：`BeautyStore.autoAssignEnabled Boolean @default(true)`（本次复核：全库零命中，字段确实不存在）+ 员工页顶部开关 UI；`BeautyLead` 补 `@@index([assignedEmployeeId])`（本次复核：现有索引只有 `storeId` / `status` / `aiGrade` / `createdAt`）；同批补 `BeautyLead.channelId` / `weworkExternalUserId`（G2 需要）与 `BeautyContent.createdByEmployeeId`。一个迁移文件搞定。
- **验收标准**：关闭开关后落地页提交的线索 `assignedEmployeeId` 为 `null`；`EXPLAIN` 显示线索按员工查询走索引；迁移在验证库 deploy 成功且反向 diff 无差异。
- **依赖**：应排在 G2 之前（G2 要用这批字段）。
- **当前状态**：未开始。

**G7 — 活码写入的归属校验与小修（P2，0.5 天）**

- **目标**：消除跨店脏引用与两处已知代码瑕疵。
- **关键交付**：`channels` POST 校验 `groupId` / `beautyEmployeeId` 属于本门店（本次复核：`route.ts:134` / `:138` 仍直接透传 `body` 值，无归属校验）；删除 `contact-way.ts:122` 的 `if (name) updateBody.state = channel.state`；`name` 变更同步企微 `remark` 或明确只改本地；修正 `contact-way.ts:58` 的 `scene` 注释。
- **验收标准**：跨店 `groupId` / `beautyEmployeeId` 返回 400/403；改名不再传 `state` 给企微；注释与取值一致。
- **依赖**：无。
- **当前状态**：未开始。

**G8 — 员工 `specialties` / `assignedAt` 暴露（P2，0.25 天）**

- **本次复核结论：四字段中已完成两个。** `dealCount` / `dealAmount` 已在 `api/beauty/employees/route.ts:81-82`（列表）与 `:203-204`（创建返回）、`[id]/route.ts`、`beauty/employees/page.tsx:49-50,75-76`、`BeautyEmployeesClient.tsx:542,607-609` 全链路打通，且 `deal-stats.test.ts` 有"列表/详情返回 `dealCount`/`dealAmount`"的用例。**`specialties` 与 `assignedAt` 仍未出现在任何接口 select 或 UI 中。**
- **关键交付**：列表与详情 `select` 补 `specialties` / `assignedAt`；PATCH 支持编辑 `specialties`；员工卡片展示擅长项目与最近分配时间。
- **验收标准**：员工卡片显示擅长项目与最近分配时间且与 DB 一致；编辑擅长项目后持久化并在列表回显。
- **依赖**：无。
- **当前状态**：未开始。

**G6 — JS-SDK 签名接线（P3，随企微内 H5 一并做，本轮不计工时）**

- `js-sdk-sign.ts` 与 `getJsapiTickets` 实现完整但零调用方；`msg-crypto.ts` 的 `encryptMessage` / `signEncryptedReply` 同理（被动回复加密路径未接线）。做企微内 H5 / 侧边栏时补一个 `api/beauty/wework/jssdk-signature` 路由即可。**不要因为"看着没用"就删掉**——双 ticket 与防死锁设计重写成本很高。

#### 阶段 4 剩余工时汇总（重算）

| 缺口 | 优先级 | 工时 | 依赖 |
|---|---|---|---|
| G2 回调建线索链路补齐 | P0 | 1.5–2 天 | G10 的字段 |
| G3 推送队列 / 退避 / 限频 / 助手页记录 | P1 | 1–1.5 天 | 无 |
| G1 OAuth 登录闭环 | P1 | 1 天 | 无 |
| G4 能力探测 + 错误码语义化 | P1 | 1 天 | 无 |
| G9 前端角色可见性收敛 | P1 | 0.5–1 天 | 无 |
| G10 分配开关 + 线索索引与溯源字段 | P2 | 0.5 天 | 无（应排最前） |
| G7 活码归属校验与小修 | P2 | 0.5 天 | 无 |
| G8 `specialties` / `assignedAt` 暴露 | P2 | 0.25 天 | 无 |
| G6 JS-SDK 接线 | P3 | 随企微内 H5，本轮不计 | — |

**剩余合计 6.25–7.75 天**（上一版为 8–9.5 天；G5 已完成、G3 缩减、G8 缩减）。

**建议顺序**：G10（迁移先行，一次改完所有字段） → G2 → G9 与 G4 并行 → G1 → G3 → G7 / G8 收尾。**迁移记账已不再是阻塞项**，新迁移可以直接在 baseline 之后追加。

---

### 总体排期

| 阶段 | 内容 | 工时 | 依赖 | 状态 |
|---|---|---|---|---|
| 0 | 校正规划（第三次校准） | — | — | ✅ 已完成 |
| 1 | 员工 CRUD（命名 `employees`） | — | 0 | ✅ 已完成（遗留 G8） |
| 2 | 门店归属重构（服务端） | — | 1 | ✅ 已完成（遗留 G9） |
| 3 | 线索分配 + 成交业绩回写 | — | 2 | ✅ 已完成（遗留 G10） |
| 4 | 企微集成主体（模型/配置/活码/回调/OAuth/消息/凭据加密） | — | 2、3 | ✅ 已实现主体，三条 P0 已清 |
| — | 迁移 baseline 重置与记账修复 | — | — | ✅ 已完成（2.7） |
| 4′ | 企微缺口补齐（G1–G4、G7–G10） | 6.25–7.75 天 | 无阻塞项 | 待开始 |

---

## 五、已实现、请勿重做（按当前现状重列）

| 项 | 位置 | 说明 |
|---|---|---|
| 企微 token / jsapi_ticket 缓存 | `src/lib/wework/access-token.ts` | PG advisory lock + 事务内同连接 + 双重检查 + 防嵌套锁死锁。**质量最高的一块，禁止重写** |
| **带 token 的 API 调用封装** | `access-token.ts:227` `callWeWorkApiWithToken` | 自动注入 `access_token`，`40014/41001/42001` 时清缓存重试一次。`message.ts`、`contact-way.ts` 三处、`oauth.ts` 的 `getUserIdByCode` 均已改走它。**新增需要 token 的调用一律用这个，不要手工拼 `access_token`** |
| **ticket 相关两处故意不走封装** | `access-token.ts` 内 `get_jsapi_ticket` / `ticket/get` | 它们在 advisory lock 事务内、用内联 `fetchAccessTokenDirect` 取 token。改走 `callWeWorkApiWithToken` 会导致嵌套锁死锁，**这是有意为之，不要"统一"掉** |
| 企微 API 统一封装 | `src/lib/wework/api.ts` | `callWeWorkApi` + `getWeWorkConfig`（已接 `openCredential`）。要加的是错误码语义化（G4），不是重写 |
| **企微凭据加解密** | `src/lib/wework/credentials.ts` + `credentials.test.ts` | `sealCredential` / `openCredential` / `maskCredential`，密文格式 `v1:nonce:ciphertext:tag`，**读时兼容历史明文**（无前缀视为明文），不做停机迁移。已覆盖全部读取点：`getWeWorkConfig`、`msg-callback` 的 GET+POST 遍历、settings 的 GET/PUT、设置页 |
| **凭据掩码** | `src/lib/utils/mask-secret.ts` | 前 4 位 + 20 圆点，空值返回 `null` 供"是否已配置"判断。掩码是展示层，掩码前必须先解密 |
| 回调加解密 + 签名校验（timing-safe） | `src/lib/wework/msg-crypto.ts` | AES-256-CBC + 手工 PKCS#7 + 协议结构解析 + XML 字段提取 |
| OAuth state（HMAC + Redis 一次性 nonce）与 code→userId | `src/lib/wework/oauth.ts` | login / bind 双 purpose 已实现，缺的只是会话建立（G1） |
| 活码 CRUD（30 字符 state、`scene=2`、`type` 自动推导） | `src/lib/wework/contact-way.ts` + `api/beauty/wework/channels/route.ts` | **不要再设计 `BeautyContactWay`**，活码建模就是 `BeautyWeWorkChannel` |
| 活码管理 UI + 分组 | `components/beauty/BeautyChannelsClient.tsx`、`channels/groups/route.ts` | |
| **消息推送 + 出站日志** | `src/lib/wework/message.ts` | 两个 send 函数走 `callWeWorkApiWithToken`，成功与失败都落 `BeautyWeWorkMessageLog`（不记 PII），失败向上抛。**要加的是队列外壳（G3），发送层本身不要重写** |
| JS-SDK 双签名（corp + agentConfig） | `src/lib/wework/js-sdk-sign.ts` | 实现完整、暂无调用方，**不要因为没用就删**（G6） |
| 企微配置读写 API + 设置页 | `api/beauty/settings/wework/route.ts`、`beauty/settings/wework/page.tsx` | 双侧 `canManageStore` 门禁；GET 三个敏感字段统一掩码 + `hasXxx` 布尔；PUT「留空或回传掩码 = 不修改」。**这套模式是其他敏感配置页的范本** |
| 企微员工绑定发起 | `api/beauty/wework/bind-employee/route.ts` | 双路门禁（管理者可绑任意人 / 员工只能绑自己） |
| 5 张企微表 + 2 个枚举 | `prisma/schema.prisma` | `BeautyWeWorkToken` / `ChannelGroup` / `Channel` / `CallbackLog` / **`MessageLog`** + `BeautyWeWorkChannelType` / **`BeautyWeWorkMessageStatus`**。**"建议清理"的旧结论已推翻，禁止清理** |
| 门店归属与角色解析 | `src/lib/beauty/resolve-store.ts` + 两个测试文件 | `resolveBeautyStore` / `leadScopeWhere` / `canManageStore` |
| 线索分配（事务 + 条件更新 + 轮转） | `src/lib/beauty/assign-lead.ts` + `assign-lead.test.ts` | **不要在 route 里另写一份分配逻辑** |
| **员工成交业绩回写** | `src/lib/beauty/deal-stats.ts` + `deal-stats.test.ts` | `dealCount` / `dealAmount` 的**唯一写入方**。`changeLeadStatus`（状态流转，幂等）+ `transferDealStats`（改派迁移）。**任何新的成交口径改动都必须走这个文件，不要在 route 里直接 `increment`** |
| 员工模块（分页/筛选/搜索/计数 + 成交数据展示） | `api/beauty/employees/*`、`BeautyEmployeesClient.tsx` | 命名是 `employees`，不是 `staff` |
| 线索归属与成交金额字段 | `prisma/schema.prisma` `BeautyLead` | `assignedEmployeeId` + 关系、`dealAmount Decimal? @db.Decimal(12,2)`（**可空**，`NULL` 表示未登记）。**不要再加 `staffId`** |
| **迁移 baseline** | `prisma/migrations/20260829010000_baseline/`（2050 行） | 全库结构的单一来源。历史 SQL 在 `prisma/_archive-migrations-20260829/`（21 项）与 `prisma/_merge-backup/`。**三者都不要删** |
| 美业玫瑰金主题 / 模块主题注入 / 图标注册 | `globals.css`、`ShellLayout.tsx`、`icon-registry.ts` | 均已完整，**不需要** `ModuleThemeContext` |
| 手机号打码 / 确认弹窗 hook | `src/lib/utils/mask-phone.ts`、`src/components/ui/use-confirm.tsx` | 统一复用 |
| token 加密工具（AES-256-GCM） | `src/lib/platforms/token-crypto.ts` | `encryptToken` / `decryptToken`，企微凭据已通过 `credentials.ts` 复用它，**不要另写一套** |

---

## 六、砍掉与延后条目（结论仍成立）

### 砍掉

| 条目 | 理由 |
|---|---|
| 内容一键发圈 | 企微朋友圈 API 有**日发布硬上限**（每成员每天可发布条数受限），且发布结果回执不可靠——无法准确判断"哪些员工发了"，产品承诺无法兑现。改为纯文案复制（内容页已支持） |
| 客户群运营 | 企微**不支持 API 发起建群**，群只能由成员在客户端手动创建；群发受**1 条/群/天**限制。"自动建新客群/VIP 群 + AI 群发"在 API 层面做不到 |
| 平台统一企微应用（全局 env） | 一套自建应用只属于一个企业主体，无法服务多个门店客户各自的企微。保留门店级配置 |
| 「客户统计 / 员工排行」看板区块 | 指标定义缺失，见延后项 |
| 内部 HMAC API + `backend/` 复用架构 | 企微能力已在 `获客系统/` 内原生实现，跨进程调用不再需要。`wework_external_scopes` 映射表、`internalHmac.js` 中间件、10 个内部端点全部作废 |
| **已成交线索的事后改金额** | 需要按差额调整员工业绩，属独立写入口，与"状态流转触发"的模型不同构。当前非法金额入参返回 400 `deal_amount_not_applicable`，是明确行为而非缺陷。要做就单独设计一个"业绩校正"入口，不要塞进现有 PATCH |

### 延后（有明确解锁条件）

| 条目 | 延后原因 | 解锁条件 |
|---|---|---|
| 智能线索分配（按成交率/负载加权、超时转派） | 成交数据刚开始积累（`dealCount` / `dealAmount` 的写入方本轮才就位） | 积累 ≥ 1 个月真实成交数据，并新增线索状态流转时间戳（`contactedAt` / `dealAt`） |
| 企微聊天侧边栏（H5） | 需要 JS-SDK 签名接线与移动端页面 | G1 完成后开工，签名能力已就绪（G6 只需补路由） |
| 多门店切换器 | `resolveBeautyStore` 已返回 `availableStores`，但无 UI，且所有 API 以解析出的单一 `storeId` 为权威 | 出现真实的多门店任职用户后再做；届时要同步改造 API 的门店参数与越权校验 |
| 助手页「活跃客户 / 员工排行」统计 | 指标定义缺失：「本周活跃」按什么算，排行按线索数还是成交额 | 产品侧给出明确口径与数据来源字段 |
| **`BeautyWeWorkMessageLog.retryCount` 的真实值** | 该字段当前**恒为 0**。重试次数目前埋在 `access-token.ts` 的 `callWeWorkApiWithToken` 内部（token 失效重试一次），为记一个数把它透出来会污染该层接口 | G3 建 outbox 后由队列层写入真实重试次数 |

---

## 七、技术决策记录

**Q: 企微配置全局还是每店独立？**
A: **每店独立**（`BeautyStore` 上 5 个 `wework*` 字段）。凭据**已加密存储**（`v1:` 前缀密文，`credentials.ts`），读时兼容历史明文。

**Q: 企微能力放在 `获客系统/` 还是 `backend/`？**
A: **已定论：`获客系统/` 原生实现**。引入跨进程调用只会增加一致性与运维成本。

**Q: 员工模块叫 `staff` 还是 `employees`？**
A: **`employees`**。后续不要再引入 `staff` 命名。

**Q: 分配逻辑用哪份实现？**
A: **`src/lib/beauty/assign-lead.ts`**。任何新的线索创建入口（尤其企微回调）都必须调 `autoAssignNewLead`。

**Q: `dealCount` / `dealAmount` 谁能写？**
A: **只有 `src/lib/beauty/deal-stats.ts`**。口径是「业绩随线索走」——改派时旧负责人减、新负责人加，与 `leadCount` 一致。幂等靠"状态条件更新命中 0 行即不计数"实现，不靠额外去重表。

**Q: 已成交线索能事后改金额吗？**
A: **不支持，已决策。** 改金额需要按差额调整员工业绩，属独立写入口。当前非法金额入参返回 400 `deal_amount_not_applicable`。

**Q: 企微凭据加密为什么不做停机迁移？**
A: `openCredential` 以 `v1:` 前缀区分密文与历史明文，无前缀原样返回。存量数据在下一次保存时自然升级为密文，不需要停机回填。代价是"明文残留"要靠运营侧逐店重新保存一次收敛，比一次性迁移脚本的风险低。

**Q: 迁移为什么做 baseline 重置而不是继续补记账？**
A: 旧链已有手工伪造记账 + 三方合并分叉，任何补记账都只是让"不可判定状态"延后爆炸。baseline 重置以**数据库实际结构**为权威、把历史 SQL 归档留证，是唯一能让全新库自洽重放的做法。详见 2.7。

**Q: 推送为什么还要走队列（G3）？**
A: `access_token` 缺参 bug 已修、失败已落库可见，但两个理由仍然成立：① 企微有频率限制，批量线索场景同步调用必然 `45009`；② 企微 API 超时会拖垮转化关键路径。

**Q: 员工必须绑定企微才能用系统吗？**
A: 不必须。员工可用平台账号登录网页版。企微绑定是增强能力：线索推送、企微内免密登录（待 G1）、活码归属。

**Q: 需要企微服务商资质吗？**
A: 自建应用不需要，但要求企业**已完成微信认证**才能使用客户联系（活码）能力。免配置接入需要第三方 ISV 资质，不在本规划范围。

---

## 八、上一版 20 条缺口的逐条现状

| # | 上一版缺口 | 现状 | 证据 / 去向 |
|---|---|---|---|
| 1 | 企微设置页明文下发凭据且无角色门禁 | ✅ **已修** | `beauty/settings/wework/page.tsx:22` 加 `canManageStore` 门禁；只下发 `maskCredential` 结果 |
| 2 | 消息推送缺 `access_token` 参数，真实环境 100% 失败 | ✅ **已修** | `message.ts` 两个 send 函数改走 `callWeWorkApiWithToken`（`access-token.ts:227`），并在 `40014/41001/42001` 时清缓存重试 |
| 3 | 企微凭据明文落库 | ✅ **已修** | `credentials.ts` 的 `sealCredential`；`settings/wework/route.ts:124-126`；读侧 `api.ts`、`msg-callback`、settings、设置页全覆盖 |
| 4 | 回调建线索不分配员工 | ⬛ **仍存** | `msg-callback/route.ts` 无 `autoAssignNewLead` / `assignedEmployeeId` 写入 → G2 |
| 5 | 回调无幂等去重与时间戳新鲜度校验 | ⬛ **仍存** | `timestamp` 只参与签名，无时间窗判断；无 `MsgId` 键 → G2 |
| 6 | 回调线索信息残缺（`externalcontact/get` 是 TODO） | ⬛ **仍存** | `route.ts:233` TODO、`:241` `企微客户_${...}`、`:242` `phone: ""` → G2 |
| 7 | `CallbackLog.leadId` 从不写入 | ⬛ **仍存** | 回调路由无该字段写入 → G2 |
| 8 | OAuth 登录不建会话，重定向目标页面不存在 | ⬛ **仍存** | `oauth-callback/route.ts:80,96,105,114` 四处 redirect；`beauty/wework/` 下只有 `channels` → G1 |
| 9 | 前端角色可见性完全未收敛 | ⬛ **仍存** | `nav-config.ts` 的 `NavItem` 仍只有 `tier` 维度（`:35-43`），`beauty.children` 无角色过滤 → G9 |
| 10 | 员工业绩四字段接口不暴露、且无写入方 | 🟡 **部分已修** | `dealCount` / `dealAmount` 已全链路暴露且有写入方（`deal-stats.ts`）；**`specialties` / `assignedAt` 仍未暴露** → G8 |
| 11 | 无企微能力探测，原始错误串直穿前端 | ⬛ **仍存** | 全库 `get_follow_user_list` 零命中 → G4 |
| 12 | 回调按门店遍历试解密，且不校验 CorpID | ⬛ **仍存**（已接入解密但结构未变） | GET/POST 各一处遍历，`openCredential` 只是替换了取值方式 → G2 |
| 13 | 活码写入不校验 `groupId` / `beautyEmployeeId` 归属 | ⬛ **仍存** | `channels/route.ts:134,138` 直接透传 → G7 |
| 14 | `updateContactWay` 改名时给企微传 `state`；`scene` 注释与语义相反 | ⬛ **仍存** | `contact-way.ts:122`、`:58` → G7 |
| 15 | `BeautyStore.autoAssignEnabled` 不存在，轮转恒开 | ⬛ **仍存** | 全库零命中 → G10 |
| 16 | `BeautyLead` 缺 `@@index([assignedEmployeeId])` | ⬛ **仍存** | 现有索引只有 `storeId` / `status` / `aiGrade` / `createdAt` → G10 |
| 17 | JS-SDK 签名与被动回复加密零接线 | ⬛ **仍存**（属未接线而非缺陷） | → G6 / G1 |
| 18 | advisory lock 等待超时后不区分结果继续执行 | ⬛ **仍存**，记录备查 | 幂等，后果仅多一次企微调用，不排期 |
| 19 | 无多门店切换器 | ⬛ **仍存**，属功能边界 | 见第六节延后项 |
| 20 | macOS AppleDouble 垃圾文件导致 1 个失败 suite | ⬛ **环境噪音，勿当回归** | `vitest run` 本次：`146 passed`，`1 failed`（`._service.test.ts` 转译失败）。同类噪音还有 `._layout.tsx` 的 lint error |

**统计**：20 条中 **3 条已修**（全部是 P0）、**1 条部分已修**、13 条仍存（其中 4 条不排期：#17 随 H5、#18 记录备查、#19 属边界、#20 属环境噪音）、另有上一版 2.7 的「迁移历史分叉」阻塞项**已解决**。

### 本轮新增的已知小问题（不排期，记录备查）

1. `settings/wework/route.ts:129` 的 `hasCredentialChange` 只在 `secret` 或 `corpId` 变更时清 token 缓存。`token` / `encodingAesKey` 变更不影响 `access_token`，因此行为正确，但字段名容易让人误读为"任一凭据变更"。
2. `BeautyWeWorkMessageLog` 的失败记录只在 `msgType` / `toUser` / `errcode` / `errmsg` 维度可查，没有 `payload`。故障复现要靠日志时间戳对齐业务记录。这是刻意的 PII 取舍，G3 建 outbox 时 `payload` 落在 outbox 侧而非日志侧。
