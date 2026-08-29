# 美业获客系统 V2 规划（第四次校准版）— 规划内缺口已清零，转入上线前验证

> 适用仓库：**`获客系统/`**（独立的嵌套 git 仓库，Next.js App Router + Prisma + **PostgreSQL** + NextAuth v5 beta）。
> 上一次基线：合并提交 `c12bcf4`。**本次基线：`c12bcf4` + 其上尚未提交的工作树改动**（`git log` 看不到本轮工作，全部在工作区：57 个已修改文件 + 20 余项新增文件/目录）。
> 本文所有"当前状态"结论均由本次代码盘点得出，不引用历史推测。

---

## 本次修订说明

**核心变化：第三次校准版列出的 8 个规划内缺口（G1–G4、G7–G10）已全部关闭，规划性质从「补齐缺口」转为「上线前验证 + 生产环境风险处置」。**

上一版列出剩余 6.25–7.75 天工时。此后 G10（分配开关与溯源字段迁移）、G2（回调建线索链路）、G9（前端角色可见性）、G4（能力探测与错误码语义化）、G1（OAuth 登录闭环）、G3（出站队列）、G7（活码归属校验）、G8（`specialties` / `assignedAt` 暴露）逐项落地，另外顺带修复了一个**超出美业范围的既有生产 bug**：`cron/refresh-tokens` 等 7 条定时任务的鉴权只认 `Authorization: Bearer`，而 ECS crontab 发的是 `x-cron-secret`，导致平台 OAuth token 刷新任务长期 401。该 bug 的修复反而暴露出「两套调度器并存」的重复执行风险，见新增的第九节。

**本次改写的章节**：本节（修订说明）、第一节完成度总览、2.1 / 2.4 / 2.5（已有能力探测与队列兜底，结论更新）、2.6 PostgreSQL 迁移约束（新增两条迁移的经验）、2.7 迁移历史（迁移条数更新为 4 条）、第三节企微实现盘点（按最新文件重列，`src/lib/wework/` 已从 8 个文件增至 11 个）、第四节阶段章节（G1–G10 逐条标注已完成与落地位置）、第五节"已实现请勿重做"（重列，新增 `src/lib/cron/authorize.ts`、`src/lib/beauty/` 与 `src/lib/wework/` 下的新模块）、第七节技术决策记录（新增 7 条本轮决策）、第八节上一版缺口逐条现状（20 条重判）。

**新增章节**：第九节「生产环境风险与待确认项」（7 条，全部超出美业范围但影响生产）、第十节「上线前检查清单」（可勾选）。

**未改动的结论**：2.2 `type` / `scene` 语义（注释已修正）、2.3 `state` 30 字符上限、第六节砍掉与延后条目。

**与实施描述不符、需要知晓的四处**（以代码为准）：

1. **迁移是 4 条不是 5 条**：`prisma/migrations/` 下为 `20260829010000_baseline`、`20260829020000_beauty_deal_amount_and_message_log`、`20260829030000_beauty_assign_switch_and_traceability`、`20260829040000_beauty_wework_outbox`。`prisma migrate status` 实测输出 `4 migrations found` + `Database schema is up to date!`。
2. **加 `canManage` prop 的是 4 个 client 组件不是 6 个**：`BeautyEmployeesClient` / `BeautyLandingClient` / `BeautyDashboardClient` / `BeautyChannelsClient`。`WeWorkSettingsForm` 与 `BeautyContentClient` 没有该 prop（前者整页已被 `canManageStore` 门禁挡住，后者内容页对全角色开放）。传 `canManage` 的 server component 页面是 5 个。
3. **导航收敛的只有 1 项：企微设置**。`nav-config.ts` 里带 `requireStoreScope: true` 的曾是「落地页 / 员工管理 / 活码管理 / 企微设置」四项，与服务端不一致——落地页 / 员工 / 活码三页服务端都允许低权角色只读（只有写操作有 `canManageStore` 门禁），导航比服务端更严会让 `SELF` 角色连只读入口都进不去。现已去掉这三项的标记，只保留企微设置（该页对低权角色直接 `redirect`，是唯一「整页仅店主/店长可用」的路由）。全角色可见：驾驶舱、内容、线索、落地页、员工管理、活码管理。
4. **出站队列限频维度是「门店」而非「agent」**：`drainOutbox` 按 `storeId` 分桶取配额。本项目一门店一自建应用，两者等价，但代码里的分组键是 `storeId`。

**本轮实测基线**：`tsc --noEmit` 零错误；`vitest run` **254 个用例全绿**（`Test Files 1 failed | 26 passed`，唯一失败 suite 是 macOS AppleDouble 垃圾文件 `src/lib/analytics/._service.test.ts` 的转译失败，属既有环境噪音）；`prisma validate` 通过；`prisma migrate status` up to date（4 条迁移）。

---

## 一、当前完成度总览（结论先行）

**规划内缺口已清零。** 阶段 0–4 与 G1–G10 全部落地，剩下的不是开发工作，而是上线前验证与生产环境风险处置（第九、十节）。

| 分类 | 内容 |
|---|---|
| **已实现（美业主链路）** | 员工 CRUD 与业绩回写；门店归属与角色解析（服务端 + 前端导航收敛 + 页面内写按钮收敛）；线索分配（手动 / 轮转 / **门店级自动分配开关**）；企微 token 缓存与带 token 的 API 封装；凭据加密落库；活码 CRUD 与**归属校验**；回调**建线索 + 归属 + 双层幂等 + 时间戳新鲜度 + CorpID 校验 + 真实昵称拉取 + 溯源回写**；**OAuth 登录闭环（建会话 + 失败指引页）**；**出站消息队列（退避 / 限频 / DEAD 告警）**；**企微能力探测与错误码语义化**；**cron 鉴权统一** |
| **已知不做（有明确理由）** | 回调 URL 仍是不带 `storeId` 的单一路径，POST 侧靠「遍历门店试签名 + CorpID 校验」定位门店。O(N) 结构保留，因为改 URL 需要所有存量门店去企微后台改配置，收益不抵迁移成本 |
| **未接线（等触发条件）** | JS-SDK 双签名与被动回复加密（`js-sdk-sign.ts`、`msg-crypto.ts` 的 `encryptMessage` / `signEncryptedReply`），等企微内 H5 场景，见 G6 |
| **待处置（非开发，见第九节）** | 平台 OAuth token 长期未续期的存量影响面；`NEXT_PUBLIC_APP_URL` 生产配置；企微凭据明文残留的逐店收敛（盘点脚本已就绪）；`optimization-expire` 时区注释；多实例下的进程内探测缓存。**调度器二选一已拍板并落地：Vercel `crons` 清空，ECS 为唯一调度器** |

---

## 二、能力边界与降级（必读）

### 2.1 客户联系（活码）的准入条件

`add_contact_way` 属于「外部联系人管理」能力，**同时**要求：

1. 企业已完成**微信认证**（未认证企业无客户联系功能）；
2. 自建应用已勾选「外部联系人管理」权限；
3. 活码里配置的每个成员**必须已开启客户联系并被分配客户联系额度**，否则该成员会被接口拒绝。

**当前状态：已有能力探测兜底。** `src/lib/wework/probe.ts` 的 `getWeWorkCapabilities` 把三层准入探成三个能力项（`credentials` / `externalContact` / `contactWay`），每项带语义 code、处置动作与可执行 hint。`api/beauty/wework/channels/route.ts` 的 POST 在调 `add_contact_way` **之前**先取探测结果：`contactWay` 不 ok 直接按语义动作返回对应 HTTP 状态（不再打企微），ok 时用 `probe.followUsers` 过滤 `employeeIds`，不合格成员被剔除并回传 `rejectedIds`。活码页（`BeautyChannelsClient`）在探测不可用或能力受阻时禁用写入口并展示原因。

### 2.2 `type` / `scene` 语义

- `scene`：**1 = 在小程序中联系，2 = 通过二维码联系**。要生成可扫、可下载的二维码，必须 `scene = 2`。
- `type`：1 = 单人，2 = 多人。

**当前状态：取值与注释均正确。** `contact-way.ts:58` 传 `scene: 2`，注释已改为「1 = 在小程序中联系，2 = 通过二维码联系；要可扫码必须是 2」。`type` 按 `employeeIds.length > 1` 自动推导。

### 2.3 `state` 长度上限 30 字符

**当前状态：已正确处理。** `generateChannelState()` 生成 `b{8hex}x{20hex}` = 30 字符，落库到 `BeautyWeWorkChannel.state`（`@unique`），回调时按 `state` 反查渠道，不做任何字符串解析。

### 2.4 回调接口的三件事

1. **echostr 握手**：已实现（GET：遍历门店试验签 → 解密 → 原样返回 `text/plain`）。**GET 不做时间戳新鲜度校验也不校验 CorpID**——握手阶段拿不到业务上下文，加了会让企微后台配置回调 URL 直接失败。
2. **签名验证**：已实现，`verifySignature` 使用 `crypto.timingSafeEqual`。POST 验签失败返回 403 且不处理业务。
3. **去重防重放**：**已实现，双层**。
   - 回调层：以 `CreateTime:ExternalUserID:ChangeType` 为幂等键（企微事件不带 `MsgId`），在 5 分钟窗内查 `BeautyWeWorkCallbackLog.rawPayload.dedupeKey`，命中即直接返回 `success` 不走业务。
   - 线索层：`BeautyLead` 的 `@@unique([storeId, weworkExternalUserId])` 复合唯一约束兜底，"删除再添加"不会产生第二条线索（建线索前先按 `weworkExternalUserId` 查，命中即复用既有线索 ID）。
   - 时间戳新鲜度：POST 侧 `isTimestampFresh` 要求与服务端偏差 ≤ 5 分钟，超窗 403。

**回调路由不挂 auth**：已满足（鉴权唯一依赖企微签名）。

**CorpID 校验已补上**：`msg-crypto.ts` 新增 `decryptMessageWithCorpId`，返回协议尾部的 CorpID；POST 遍历门店时要求解出的 CorpID 与 `store.weworkCorpId` 一致才算命中，杜绝跨企业错配。`decryptMessage` 保留为它的薄封装，供 GET 握手复用。

**遍历结构保留**：POST 侧仍是 O(N) 遍历所有配置了企微的门店。有 CorpID 校验兜底后正确性无虞，性能在门店量级可接受，因此不改回调 URL（改 URL 要求所有存量门店回企微后台改配置）。

### 2.5 消息推送的限频

企微应用消息与外部联系人消息均有频率限制，批量场景会触发 `45009`。

**当前状态：已有队列兜底。**

- 发送层：`sendTextMessage` / `sendTextCardMessage` 走 `callWeWorkApiWithToken`，token 由封装层注入并在 `40014 / 41001 / 42001` 时清缓存重试一次；成功与失败都落 `BeautyWeWorkMessageLog`（只记企微 UserID 与消息类型，PII 不入库）。
- 队列层（`src/lib/wework/outbox.ts`）：业务侧只调 `enqueueMessage` 入队，不同步打企微；`drainOutbox` 由 `api/cron/beauty-wework-outbox` 每分钟消费。
  - **限频**：按门店每分钟 10 条（`OUTBOX_RATE_LIMIT_PER_MINUTE`）。窗口内已用量直接 `count` 最近 60 秒的 `BeautyWeWorkMessageLog`，因此**直发路径消耗的是同一份配额**，多实例部署也不会各算各的。
  - **退避**：`1m → 5m → 30m → 2h → 6h`，最多 5 次（`OUTBOX_MAX_ATTEMPTS`），耗尽置 `DEAD`。
  - **可重试性**：按 `classifyWeWorkError` 的语义动作决定——`SETUP` 类（缺权限、凭据错、门店企微未配置）一次即 `DEAD`，`RETRY` / `WAIT` / 未知走退避。
  - **并发**：`claim()` 用 `updateMany({ id, attempts, status })` 条件更新占坑，命中 0 行说明被另一实例抢走，跳过。
  - **告警**：本轮出现 `DEAD` 时走既有 `raiseAlert` 发 WARNING。
  - **`retryCount` 真值**：`deliver` 把 `attempts` 传进日志上下文，`BeautyWeWorkMessageLog.retryCount` 不再恒 0。

**仍缺（不排期）**：助手页的推送记录展示区块。数据源（`BeautyWeWorkMessageLog` + `BeautyWeWorkOutbox`）已就绪，属纯 UI 增量。

### 2.6 PostgreSQL 特有的迁移约束

| 结论 | 说明 |
|---|---|
| Prisma scalar list（`String[]`）**可用** | 数据库是 PostgreSQL，`schema.prisma` 已有多处在用 |
| `@db.Text` 是显式同义写法 | PG 下 `String` 默认映射 `text`，仓库风格是显式标注，沿用 |
| `text` 列可直接建 btree 索引 | 无需前缀长度（那是 MySQL 限制） |
| **新增枚举值必须单独一个迁移文件** | PG 的 `ALTER TYPE ... ADD VALUE` 新增值不能在同一事务内被使用（`55P04`）。当前实现复用 `BeautyLeadSource.WECHAT`，未动枚举 |
| **新建枚举与使用它的表可以同一个迁移** | `20260829020000` 的 `BeautyWeWorkMessageStatus`、`20260829040000` 的 `BeautyWeWorkOutboxStatus` 都与引用它的 `CREATE TABLE` 同文件通过——限制只针对**给已有类型追加值** |
| 枚举值**不可删除** | PG 只支持新增，设计时留余量 |
| 复合唯一约束对 `NULL` 不生效 | `@@unique([storeId, weworkExternalUserId])` 对 `weworkExternalUserId IS NULL` 的多行不做约束——落地页/手工录入的线索该字段为 `NULL`，正好不受影响；企微来源的线索必有值，去重生效。同理 `@@unique([storeId, weworkUserId])` 的绑定去重仍需应用层判空，`employees/[id]` PATCH 与 `oauth-callback` 都做了显式重复检查 |
| 加非空列必须带默认值 | `BeautyStore.autoAssignEnabled BOOLEAN NOT NULL DEFAULT true`（`20260829030000`）——**默认 true 是为了不改变现网"自动分配恒开"的既有行为**，升级后行为零变化，门店要关才关 |
| 加 FK 列一律可空 + `ON DELETE SET NULL` | `BeautyLead.channelId`、`BeautyContent.createdByEmployeeId`、`BeautyWeWorkOutbox.employeeId` / `leadId` 都是可空 FK + SET NULL；删渠道/删员工不连带删业务数据。只有 `BeautyWeWorkOutbox.storeId` 是 CASCADE（门店没了队列条目无意义） |
| **baseline 重置的正确做法** | 旧迁移链因三方合并产生分叉、且含手工伪造记账，无法在全新库上自洽重放。处置：① 旧迁移目录整体归档为 `prisma/_archive-migrations-20260829/`（21 项，**保留不删**）；② 用 `migrate diff --from-empty --to-config-datasource --script` 生成单文件 baseline（2050 行）；③ 在全新验证库上 `migrate deploy` 跑通并反向 diff 确认无差异；④ 开发库先 `pg_dump` 备份 `_prisma_migrations`，再重置记账并 `resolve --applied` 到 baseline |
| **`vector` 扩展需 DBA 预装** | baseline 第 7 行是 `CREATE EXTENSION IF NOT EXISTS "vector";`。本地能跑通是因为连接用的是超级用户；**生产的应用角色通常没有建扩展权限，且不应该有**。上线前必须由 DBA 预先在目标库执行一次建扩展。若已装好，`IF NOT EXISTS` 让这行成为空操作，无需改文件 |
| 改唯一约束前先跑重复值检查 | `DO $$ ... RAISE EXCEPTION ... $$` 模板已在归档迁移里验证过。**注意 `20260829030000` 里的 `BeautyLead_storeId_weworkExternalUserId_key` 是给新列建唯一索引，新列全为 `NULL`，不存在重复值风险** |

### 2.7 迁移历史分叉 ✅ 已解决（保留成因与处置记录）

**状态：已解决。** 本次实测 `prisma migrate status` 输出：

```
4 migrations found in prisma/migrations
Database schema is up to date!
```

四条迁移依次是：

| 迁移 | 内容 |
|---|---|
| `20260829010000_baseline` | 全库结构单一来源，2050 行 |
| `20260829020000_beauty_deal_amount_and_message_log` | `BeautyLead.dealAmount` 可空 + `BeautyWeWorkMessageLog` 表与枚举 |
| `20260829030000_beauty_assign_switch_and_traceability` | `BeautyStore.autoAssignEnabled`（NOT NULL DEFAULT true）、`BeautyLead.channelId`（FK → `BeautyWeWorkChannel`，SET NULL）与索引、`BeautyLead.weworkExternalUserId` + `@@unique([storeId, weworkExternalUserId])`、`BeautyLead` 的 `assignedEmployeeId` 索引、`BeautyContent.createdByEmployeeId`（FK → `BeautyEmployee`，SET NULL）与索引 |
| `20260829040000_beauty_wework_outbox` | `BeautyWeWorkOutboxStatus` 枚举 + `BeautyWeWorkOutbox` 表 + 三索引三外键。**纯新增，不动任何已有对象** |

**成因记录（供后续复盘，不要删）**：

1. `20260828000000_add_beauty_employee` 在库里无记录，但它要建的 `BeautyEmployee` 表与枚举实际已存在（早期手工 DDL 建出），直接 `deploy` 会因对象已存在而失败。
2. 库里 `20260828000001_beauty_p2_wework` 是一条**手工伪造的记录**（`checksum` 字面值就是 `manual`）。对应的 4 张 `BeautyWeWork*` 表与枚举实际存在且正在被代码使用，问题是"记账不全"而非"结构缺失"。
3. 三方合并让仓库侧的迁移链与库侧记账进一步分叉，两边都无法作为权威。

**处置记录（已执行完毕）**：

| 步骤 | 操作 | 证据 |
|---|---|---|
| 1 | 21 项旧迁移归档到 `prisma/_archive-migrations-20260829/`；远端原件仍在 `prisma/_merge-backup/` | 目录存在，**禁止删除** |
| 2 | `migrate diff --from-empty --to-config-datasource` 生成单文件 baseline | 2050 行，第 7 行 `CREATE EXTENSION IF NOT EXISTS "vector"` |
| 3 | 在验证库 `growth_os_verify2` 上 `migrate deploy` 跑通，反向 diff 得 `No difference detected.` | 验证库**禁止删除**（`growth_os_verify` / `growth_os_verify2` 均保留备查） |
| 4 | 开发库 `_prisma_migrations` 先 `pg_dump` 留档（20 条）到 `/Volumes/My PSSD/软件开发/备份/growth_os_prisma_migrations-20260829-092217.sql`，再清空重置，`resolve --applied 20260829010000_baseline` | 备份文件存在（10 KB） |
| 5 | `20260829020000` / `20260829030000` / `20260829040000` 依次 deploy 成功，diff 无差异 | `migrate status` up to date |

**经验教训**：伪造 `_prisma_migrations` 记录换来的"眼前干净"会在下一次合并时变成不可判定状态。存量结构与迁移链失配时，正解是 baseline 重置（结构为准、历史归档），不是继续补记账。

**红线（任何环境，仍然有效）**：禁止 `migrate reset`、禁止 `DROP TABLE/COLUMN`、禁止手工改写 `_prisma_migrations` 数据行、禁止删除归档目录与验证库。

**预发/生产的处置**：见第十节上线前检查清单第 1 组。

---

## 三、企微实现盘点（`src/lib/wework/` 十一个文件）

| 文件 | 实现内容 | 完成度 |
|---|---|---|
| `api.ts` | `callWeWorkApi` 统一封装；`getWeWorkConfig(store)` 提取门店配置并经 `openCredential` 解密三个敏感字段 | **完整**。错误语义化已由 `errcode.ts` 承接 |
| `access-token.ts` | `getAccessToken` / `getJsapiTickets` / `clearTokenCache`，PG `pg_try_advisory_xact_lock` + 事务内同连接 + 双重检查 + 内联 `fetchAccessTokenDirect` 防嵌套死锁；`callWeWorkApiWithToken` 注入 token 并在 `40014 / 41001 / 42001` 时清缓存重试一次 | **完整且质量高，禁止重写**。小瑕疵仍在：锁等待轮询超时（5s）后不区分成功与超时就继续执行，极端并发下可能多刷一次 token（幂等） |
| `credentials.ts` | `sealCredential` / `openCredential`（`v1:` 前缀走解密，无前缀视为历史明文）/ `maskCredential` | **完整**，有 `credentials.test.ts` |
| `errcode.ts`（**新增**） | `WeWorkErrorCode` 九种语义 code、`WeWorkErrorAction` 四类动作（`RETRY` 可重试 / `SETUP` 需用户去企微后台开通 / `WAIT` 配额需等待 / `UNKNOWN`）、`classifyWeWorkError`、`weworkSemantic`、`httpStatusForAction`（SETUP→403、WAIT→429、RETRY→503、其他→500）、`httpStatusForWeWorkError` | **完整**。14 个 errcode 有映射，未列出的一律落 `unknown`，不猜语义 |
| `probe.ts`（**新增**） | `getWeWorkCapabilities`（三层能力探测）、`clearCapabilityCache`、`capabilityOf`。**进程内缓存**：成功 10 分钟 / 失败 1 分钟 TTL，`force` 重新检测受 30 秒下限保护，凭据变更由写入方调 `clearCapabilityCache` 作废。**不落库，本轮不引入 `BeautyWeworkProbe` 表** | **完整**，有 `probe.test.ts` |
| `outbox.ts`（**新增**） | `enqueueMessage` / `drainOutbox`，退避 / 限频 / `claim` 占坑 / `SETUP` 直判 `DEAD`，详见 2.5 | **完整**，有 `outbox.test.ts` |
| `external-contact.ts`（**新增**） | `getExternalContact` 调 `externalcontact/get` 拉客户真实昵称与头像 | **完整**。拉取失败不阻断建线索，回退占位名 `企微客户_xxxxxxxx` |
| `oauth.ts` | `signOAuthState` / `verifyOAuthState`（HMAC-SHA256，5 分钟 TTL，`purpose` 区分 login/bind，nonce 存 Redis 一次性消费）、`buildOAuthUrl`、`getUserIdByCode`；**新增 `signWeworkLoginTicket` / `verifyWeworkLoginTicket`**（同一把 `AUTH_SECRET` 做 HMAC-SHA256、TTL 120 秒、nonce 存 Redis 一次性消费） | **完整**，有 `oauth-login.test.ts` |
| `contact-way.ts` | `generateChannelState`、`createContactWay`、`updateContactWay`、`deleteContactWay`、`incrementChannelAddCount` | **完整**。本轮修完三处：update/delete 从 `findUnique({id})` 收敛为 `findFirst({id, storeId})`；删掉有害的 `if (name) updateBody.state = channel.state`；修正说反的 `scene` 注释 |
| `msg-crypto.ts` | `verifySignature`（timing-safe）、`decryptMessageWithCorpId`（返回协议尾部 CorpID）、`decryptMessage`（前者的薄封装）、`encryptMessage`、`signEncryptedReply`、`extractEncryptFromXml`、`extractFieldFromXml` | **完整**。本轮修了 `extractFieldFromXml` 只认 CDATA 导致 `CreateTime` 这类裸写数值字段取不到的 bug（正则改为 CDATA 与裸值二选一）。`encryptMessage` / `signEncryptedReply` 仍零调用方（G6） |
| `message.ts` | `sendTextMessage` / `sendTextCardMessage`（走 `callWeWorkApiWithToken`，成功失败都落日志，`retryCount` 由 outbox 传入真值）、`buildNewLeadCard`（文案唯一来源）、`notifyNewLead` | **完整** |
| `js-sdk-sign.ts` | `signJsSdkConfig` / `signAgentConfig` | **实现完整但零接线**，等企微内 H5（G6），**不要删** |

### 企微 / 美业 API 路由与 UI 完成度

| 路径 | 内容 | 完成度 |
|---|---|---|
| `api/beauty/settings/wework/route.ts` | GET 返回三个敏感字段的**掩码** + `hasXxx` 布尔 + `isConfigured`；PUT「留空或回传掩码 = 不修改」，新值经 `sealCredential` 加密落库，凭据变更后 `clearTokenCache` + `clearCapabilityCache` | **完整** |
| `beauty/settings/wework/page.tsx` | `canManageStore` 门禁（不满足重定向驾驶舱）；只下发掩码，明文不出服务端 | **完整** |
| `api/beauty/wework/probe/route.ts`（**新增**） | GET 取探测结果（吃缓存）、POST 强制重新检测；均要求 `canManageStore` | **完整** |
| `api/beauty/wework/channels/route.ts` | GET / POST / PUT / DELETE 全套；POST 在调企微前校验 `groupId` / `beautyEmployeeId` 属于当前门店（400 `group_not_in_store` / `employee_not_in_store`），再按探测结果过滤不合格成员 | **完整** |
| `api/beauty/wework/msg-callback/route.ts` | GET echostr 握手；POST 时间戳新鲜度 → 遍历门店验签 + CorpID 校验 → 回调层幂等 → 落 `CallbackLog` → 建线索（渠道计数、`weworkExternalUserId` 去重、`externalcontact/get` 拉昵称、`channelId` 溯源）→ `FollowUserID` 定位员工走 `assignLeadManual`，失败回退 `autoAssignNewLead` → 分配成功入队通知 → 回写 `CallbackLog.leadId` | **完整**，有 `msg-callback.test.ts` |
| `api/beauty/wework/oauth-callback/route.ts` | 验 state → code→userId → 绑定/登录两模式；登录模式签一次性票据后 `signIn("wework", { ticket, redirect: false })` 建会话 | **完整**，见 G1 |
| `api/beauty/wework/qr-login-url/route.ts` | 返回扫码登录 URL | **完整** |
| `api/beauty/wework/bind-employee/route.ts` | 生成绑定模式 OAuth URL，双路门禁 | **完整** |
| `api/beauty/store/route.ts` | PUT 新增 `autoAssignEnabled` 入参（非 boolean 返回 400 `invalid_auto_assign_enabled`），`canManageStore` 门禁 | **完整** |
| `api/beauty/employees/*` | 列表 / 详情 / 创建 select 已含 `dealCount` / `dealAmount` / `specialties` / `assignedAt`；POST / PATCH 支持 `specialties`（走 `parseSpecialties`，非法返回 400 `invalid_specialties`，清空写 `Prisma.DbNull`）；`assignedAt` 只读 | **完整** |
| `api/beauty/content/route.ts` | 创建时写 `createdByEmployeeId: access.employeeId` | **完整** |
| `api/lp/beauty/[slug]/route.ts` | 落地页提交建线索 → `autoAssignNewLead` → 分配成功入队通知（不同步调企微，C 端非阻塞） | **完整** |
| `api/cron/beauty-wework-outbox/route.ts`（**新增**） | `authorizeCron` → `drainOutbox` → 有 `DEAD` 则 `raiseAlert` | **完整** |
| `beauty/wework/bind-failed/page.tsx`（**新增**） | 公开指引页，放在 `(auth)` 分组并加入 `auth.config.ts` 的 `PUBLIC_ROUTES`；按 `reason` 展示四种失败指引 | **完整** |
| 四个美业 client 组件 | `BeautyEmployeesClient` / `BeautyLandingClient` / `BeautyDashboardClient` / `BeautyChannelsClient` 均加 `canManage` prop，按角色隐藏写按钮 | **完整** |

---

## 四、阶段章节（按当前现状）

### 阶段 0 — 校正规划 ✅ 已完成（本次第四次校准）

**关键交付**：`docs/V2-Beauty-Upgrade-Plan.md`（本文件）。
**验收标准**：每条"已实现"结论都能指到具体文件；上一版 8 个缺口逐条给出落地位置；不为填表编造新待办。
**当前状态**：已完成。

---

### 阶段 1 — 员工 CRUD ✅ 已完成（G8 已闭环）

1. Schema：`specialties Json?`、`dealCount Int @default(0)`、`dealAmount Decimal @default(0) @db.Decimal(12,2)`、`assignedAt DateTime?`；三个全局 `@unique` 已换为门店维度复合唯一。
2. API：列表 / 详情 / 创建的 select 已含四字段；`specialties` 可写、`assignedAt` 只读。归一逻辑集中在 `src/lib/beauty/specialties.ts`。
3. UI：员工卡片展示成交数据、擅长徽章与「最近分配」。
4. 命名统一为 `employees`；`User.beautyEmployees` 为一对多。

**当前状态**：已完成，无遗留缺口。

---

### 阶段 2 — 门店成员归属重构 ✅ 已完成（服务端 + 前端，G9 已闭环）

1. `src/lib/beauty/resolve-store.ts`：`resolveBeautyStore(session)` → `{ storeId, employeeId, role, scope, availableStores }`；`leadScopeWhere` / `canManageStore`。
2. 前端收敛（本轮）：`NavItem.requireStoreScope` 与 `tier` **正交**；`filterNavByTier` / `filterNavByBeautyScope` / `filterNav` 三个纯函数（`src/lib/nav-utils.ts`，有 `nav-utils.test.ts`）。**只有企微设置一项做导航收敛**——判定标准是「整页仅店主/店长可用（页面本身 redirect）」。其余美业子项（驾驶舱 / 内容 / 线索 / 落地页 / 员工管理 / 活码管理）全角色可见，页面内写按钮按 `canManage` 收敛。
3. **`scope === null` 时不过滤**：未开通门店的账号要能看到入口去 onboarding，收敛只对 `SELF` 生效。
4. 服务端门禁复核结论：**无缺失**，管理类 API 全部有 `canManageStore`。

**当前状态**：已完成，无遗留缺口。

---

### 阶段 3 — 线索分配 ✅ 已完成（G10 已闭环）

1. `src/lib/beauty/assign-lead.ts`：`commitAssignment`（事务内条件更新）、`assignLeadManual`、`assignLeadRoundRobin`、`autoAssignNewLead`。
2. **自动分配开关**：`autoAssignNewLead` 先查 `BeautyStore.autoAssignEnabled`，关闭时返回 `{ ok: false, error: "auto_assign_disabled" }`（新失败语义，两个 route 映射为 409）。**手动分配不受开关约束。**
3. `src/lib/beauty/deal-stats.ts` 仍是 `dealCount` / `dealAmount` 的唯一写入方。
4. 索引：`BeautyLead` 补 `assignedEmployeeId` / `channelId` 索引。

**当前状态**：已完成，无遗留缺口。

---

### 阶段 4 — 企微集成 ✅ 已完成（G1–G4、G7 全部闭环）

| 原子阶段 | 现状 |
|---|---|
| 4.0 数据模型 | ✅ 6 张 `BeautyWeWork*` 模型 + 3 个枚举（新增 `BeautyWeWorkOutbox` / `BeautyWeWorkOutboxStatus`） |
| 4.1 门店企微配置 | ✅ API + 页面双侧门禁，敏感字段掩码，凭据密文落库 |
| 4.2 企微内 OAuth 登录 | ✅ 建会话 + 四种失败路径均有明确落点（G1） |
| 4.3 线索推送 | ✅ 队列 + 退避 + 限频 + `DEAD` 告警（G3）。仅助手页展示区块未做 |
| 4.4 活码 + 回调建线索 | ✅ 归属校验（G7）+ 建线索全链路（G2） |
| 4.5 企微能力探测 | ✅ 探测 + 错误码语义化 + 活码页降级提示（G4） |

#### G1 — OAuth 登录闭环 ✅ 已完成

- **落地位置**：`src/lib/wework/oauth.ts`（票据签发/校验）、`src/lib/auth.ts`（第 5 个 credentials provider `wework`）、`src/app/api/beauty/wework/oauth-callback/route.ts`、`src/app/[locale]/(auth)/beauty/wework/bind-failed/page.tsx`、`src/lib/auth.config.ts`（`PUBLIC_ROUTES`）。
- **关键设计决策**：项目用 NextAuth v5 beta + JWT session，建会话只能走 provider。为防 provider 端点被外部直接打，登录不是把 `userId` 直接交给 provider，而是回调侧签一张**一次性会话票据**（同一把 `AUTH_SECRET` 做 HMAC-SHA256、TTL 120 秒、nonce 存 Redis 一次性消费），provider 兑换时**二次查库确认员工仍 ACTIVE**。
- **四处 redirect 按各自意图分别定向**：绑定成功/重复 → `/beauty/employees?bind=success|duplicate`；登录失败（`not_bound` / `inactive` / `no_account` / `session_failed`）→ 公开页 `/beauty/wework/bind-failed?reason=`；登录成功 → `/beauty/dashboard`。四种失败路径**均不建会话、不回显内部信息**。
- **测试**：`src/lib/wework/oauth-login.test.ts`。

#### G2 — 回调建线索链路 ✅ 已完成

- **落地位置**：`src/app/api/beauty/wework/msg-callback/route.ts`、`src/lib/wework/external-contact.ts`、`src/lib/wework/msg-crypto.ts`、`src/lib/beauty/notify-assignment.ts`。
- **归属**：`FollowUserID` 按 `(storeId, weworkUserId, ACTIVE)` 定位员工后走 `assignLeadManual`；定位不到或分配失败回退 `autoAssignNewLead`（尊重门店开关）。
- **幂等**：双层，见 2.4。
- **新鲜度**：POST 侧 5 分钟时间戳窗，GET echostr 握手不加。
- **客户信息**：`externalcontact/get` 拉真实昵称与头像，失败回退占位名。**`phone` 维持写空串未改可空**——去重职责已由 `weworkExternalUserId` 承担，改字段可空要动 baseline 结构与所有读取点，收益不抵成本，空串等员工跟进时补录。
- **溯源**：写 `BeautyWeWorkCallbackLog.leadId` 与 `BeautyLead.channelId`。
- **安全**：`decryptMessageWithCorpId` 校验协议尾部 CorpID 防跨企业错配。
- **顺带修复**：`extractFieldFromXml` 只认 CDATA，导致裸写的 `CreateTime` 取不到（幂等键会退化）。
- **测试**：`src/lib/wework/msg-callback.test.ts`。

#### G3 — 出站队列 ✅ 已完成

- **落地位置**：迁移 `20260829040000_beauty_wework_outbox`、`src/lib/wework/outbox.ts`、`src/app/api/cron/beauty-wework-outbox/route.ts`。
- **关键设计决策**：消费者沿用项目既有的 cron route 形态，**未引入 Redis/BullMQ 常驻 worker**——Next.js 侧没有常驻进程，加一套基础设施的运维成本不划算。策略细节见 2.5。
- **测试**：`src/lib/wework/outbox.test.ts`。

#### G4 — 能力探测与错误码语义化 ✅ 已完成

- **落地位置**：`src/lib/wework/errcode.ts`、`src/lib/wework/probe.ts`、`src/app/api/beauty/wework/probe/route.ts`、`channels/route.ts`、`BeautyChannelsClient.tsx`。
- **关键设计决策**：**探测结果不落库**，缓存在进程内（成功 10 分钟 / 失败 1 分钟 TTL，强制刷新 30 秒节流，凭据变更即作废），因此原计划的 `BeautyWeworkProbe` 表没有建。首屏探测在 server component 完成，页面拿到的是已探好的结果。多实例部署的代价见第九节第 7 条。
- **测试**：`probe.test.ts`、`channels-capability.test.ts`。

#### G7 — 活码归属校验 ✅ 已完成

- **落地位置**：`src/app/api/beauty/wework/channels/route.ts`、`src/lib/wework/contact-way.ts`。
- 详见第三节表格。**测试**：`channels-ownership.test.ts`。

#### G8 — 员工 `specialties` / `assignedAt` ✅ 已完成

- **落地位置**：`src/lib/beauty/specialties.ts`（读侧只取非空字符串项；写侧去空白、去重、单项截 20 字、最多 20 条，清空写 `Prisma.DbNull`）、employees 两个 route、`BeautyEmployeesClient.tsx`。
- **测试**：`employee-fields.test.ts`。

#### G9 / G10 ✅ 已完成

见阶段 2 与阶段 3。

#### G5 — 自动分配路径接通通知 ✅ 已完成（本轮新增）

- **落地位置**：`src/lib/beauty/notify-assignment.ts` 的 `enqueueLeadAssignedNotice`。
- 落地页提交（`api/lp/beauty/[slug]`）与企微回调分配成功后入队；**手动改派路径也收敛到同一 helper**，保证文案同源（`buildNewLeadCard`）。
- 各失败分支（自动分配开关关闭、无可用员工、员工未绑企微、线索查不到）**均不入队**；入队失败只记日志不向上抛，保持"通知失败不影响线索本身"。
- **测试**：`notify-assignment.test.ts`。

#### G11 — cron 鉴权统一 ✅ 已完成（本轮新增，既有生产 bug 的根因修复）

- **落地位置**：`src/lib/cron/authorize.ts`（`authorizeCron`）、7 条路由、`scripts/deploy/setup-cron.sh`、`vercel.json`。
- `authorizeCron` 同时接受 `Authorization: Bearer <secret>` 与 `x-cron-secret: <secret>`，用 `timingSafeEqual` 比较（先比长度、`try/catch` 防抛）；**`CRON_SECRET` 未配置或空串一律拒绝**——缺配置不能退化成无鉴权放行。
- 复用该函数的 7 条路由：`cron/refresh-tokens`、`cron/beauty-wework-outbox`、`cron/sync-leads`、`cron/publish-pending`、`cron/agent-daily-loop`、`cron/optimization-expire`、`billing/cron-check-expiry`。
- `setup-cron.sh` 改为同时发两个头、补上 `optimization-expire` 作业、修掉注释与条数瑕疵（现为 7 条，已逐一核对覆盖全部 7 条 cron 路由，无遗漏）；**`vercel.json` 的 `crons` 已清空（保留文件为 `{}`），ECS crontab 是唯一调度器**（见 9.2 决策）。JSON 不支持注释，说明写在 `setup-cron.sh` 头部与 `docs/deploy-update.md`「定时任务」一节。
- **测试**：`src/lib/cron/authorize.test.ts`。
- **这项修复带来的新暴露面见第九节第 2 条，上线前必须先做调度器二选一的决策。**

#### G6 — JS-SDK 签名接线（未接线，等企微内 H5）

`js-sdk-sign.ts` 与 `getJsapiTickets` 实现完整但零调用方；`msg-crypto.ts` 的 `encryptMessage` / `signEncryptedReply` 同理。做企微内 H5 / 侧边栏时补一个 `api/beauty/wework/jssdk-signature` 路由即可。**不要因为"看着没用"就删掉**——双 ticket 与防死锁设计重写成本很高。

#### 剩余工时

**规划内缺口已清零，无待排期开发项。** 真正剩下的是上线前验证与生产环境风险处置，见第九、十节——那些需要的是环境信息与决策，不是工时。

---

### 总体排期

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 校正规划（第四次校准） | ✅ 已完成 |
| 1 | 员工 CRUD + 四字段暴露 | ✅ 已完成 |
| 2 | 门店归属重构（服务端 + 前端收敛） | ✅ 已完成 |
| 3 | 线索分配 + 成交业绩回写 + 自动分配开关 | ✅ 已完成 |
| 4 | 企微集成全量（配置/活码/回调/OAuth/消息队列/能力探测） | ✅ 已完成 |
| — | 迁移 baseline 重置与三条后续迁移 | ✅ 已完成 |
| — | cron 鉴权统一（跨模块 bug 修复） | ✅ 已完成 |
| 5 | **上线前验证与生产风险处置** | ⬛ 待用户提供环境信息与决策（第九、十节） |

---

## 五、已实现、请勿重做（按当前现状重列）

| 项 | 位置 | 说明 |
|---|---|---|
| 企微 token / jsapi_ticket 缓存 | `src/lib/wework/access-token.ts` | PG advisory lock + 事务内同连接 + 双重检查 + 防嵌套锁死锁。**质量最高的一块，禁止重写** |
| 带 token 的 API 调用封装 | `access-token.ts` `callWeWorkApiWithToken` | 自动注入 `access_token` 并在 token 类 errcode 时清缓存重试一次。**新增需要 token 的调用一律用它，不要手工拼 `access_token`** |
| ticket 相关两处故意不走封装 | `access-token.ts` 内 `get_jsapi_ticket` / `ticket/get` | 在 advisory lock 事务内用内联 `fetchAccessTokenDirect` 取 token，改走封装会嵌套锁死锁。**这是有意为之，不要"统一"掉** |
| 企微 API 统一封装 | `src/lib/wework/api.ts` | `callWeWorkApi` + `getWeWorkConfig` |
| **企微 errcode 语义化** | `src/lib/wework/errcode.ts` | 三类处置动作 + HTTP 状态映射。**新增错误处理一律扩这张表，不要在 route 里散写 errcode 判断** |
| **企微能力探测** | `src/lib/wework/probe.ts` | 进程内缓存，不落库。要改 TTL 或换 Redis 见第九节第 7 条，**不要新建 `BeautyWeworkProbe` 表** |
| **企微出站队列** | `src/lib/wework/outbox.ts` + `api/cron/beauty-wework-outbox` | 入队 / 消费 / 退避 / 限频 / 占坑。**业务侧一律 `enqueueMessage`，不要直接调 send** |
| **线索分配后的通知文案与投递** | `src/lib/beauty/notify-assignment.ts` | 全部分配入口共用的唯一 helper，文案来自 `buildNewLeadCard`。**不要在 route 里另写一份通知** |
| **cron 鉴权** | `src/lib/cron/authorize.ts` | 双头兼容 + timing-safe + 缺配置即拒。**新增 cron route 一律复用，不要再手写 header 比较** |
| 企微凭据加解密 | `src/lib/wework/credentials.ts` | `v1:` 前缀密文，读时兼容历史明文 |
| 凭据掩码 | `src/lib/utils/mask-secret.ts` | 掩码前必须先解密 |
| 回调加解密 + 签名校验 + CorpID 校验 | `src/lib/wework/msg-crypto.ts` | `decryptMessageWithCorpId` 是带 CorpID 的权威版本，`decryptMessage` 只是薄封装 |
| **外部联系人详情** | `src/lib/wework/external-contact.ts` | `externalcontact/get`，失败不阻断建线索 |
| OAuth state + 一次性会话票据 | `src/lib/wework/oauth.ts` | state 与 ticket 是两套独立的一次性凭证，**不要合并** |
| 活码 CRUD（30 字符 state、`scene=2`、归属收敛到 `findFirst({id, storeId})`） | `src/lib/wework/contact-way.ts` + `channels/route.ts` | **不要再设计 `BeautyContactWay`** |
| 消息推送 + 出站日志 | `src/lib/wework/message.ts` | 发送层不要重写，要加能力就加在 outbox 层 |
| JS-SDK 双签名 | `src/lib/wework/js-sdk-sign.ts` | 暂无调用方，**不要删**（G6） |
| 企微配置读写 API + 设置页 | `api/beauty/settings/wework/route.ts`、`settings/wework/page.tsx` | 「留空或回传掩码 = 不修改」这套模式是其他敏感配置页的范本 |
| **导航过滤纯函数** | `src/lib/nav-utils.ts` + `nav-utils.test.ts` | `filterNavByTier` / `filterNavByBeautyScope` / `filterNav`。`tier` 与 `requireStoreScope` 正交，`scope === null` 不过滤 |
| **员工擅长项目归一** | `src/lib/beauty/specialties.ts` | 读写两侧唯一入口，清空一律 `Prisma.DbNull` |
| 门店归属与角色解析 | `src/lib/beauty/resolve-store.ts` | `resolveBeautyStore` / `leadScopeWhere` / `canManageStore` |
| 线索分配（事务 + 条件更新 + 轮转 + 开关） | `src/lib/beauty/assign-lead.ts` | **不要在 route 里另写一份分配逻辑** |
| 员工成交业绩回写 | `src/lib/beauty/deal-stats.ts` | `dealCount` / `dealAmount` 的**唯一写入方** |
| 6 张企微表 + 3 个枚举 | `prisma/schema.prisma` | `Token` / `ChannelGroup` / `Channel` / `CallbackLog` / `MessageLog` / **`Outbox`**。**禁止清理** |
| 迁移 baseline 与三条后续迁移 | `prisma/migrations/` | 历史 SQL 在 `_archive-migrations-20260829/` 与 `_merge-backup/`。**都不要删** |
| 美业玫瑰金主题 / 图标注册 / 手机号打码 / 确认弹窗 hook / token 加密工具 | `globals.css`、`icon-registry.ts`、`mask-phone.ts`、`use-confirm.tsx`、`token-crypto.ts` | 统一复用，不要另写一套 |

---

## 六、砍掉与延后条目（结论仍成立）

### 砍掉

| 条目 | 理由 |
|---|---|
| 内容一键发圈 | 企微朋友圈 API 有日发布硬上限，且发布结果回执不可靠，产品承诺无法兑现。改为纯文案复制 |
| 客户群运营 | 企微不支持 API 发起建群；群发受 1 条/群/天限制 |
| 平台统一企微应用（全局 env） | 一套自建应用只属于一个企业主体，保留门店级配置 |
| 内部 HMAC API + `backend/` 复用架构 | 企微能力已在 `获客系统/` 内原生实现，跨进程调用不再需要 |
| 已成交线索的事后改金额 | 需按差额调整员工业绩，属独立写入口。当前非法金额入参返回 400 `deal_amount_not_applicable` |
| **回调 URL 带 `storeId`** | 消除 O(N) 遍历要求所有存量门店回企微后台改配置，CorpID 校验已保证正确性，收益不抵迁移成本 |
| **`BeautyWeworkProbe` 表** | 探测结果是短时效的运行时状态，进程内缓存足够；落库会引入一份需要维护的过期数据 |

### 延后（有明确解锁条件）

| 条目 | 延后原因 | 解锁条件 |
|---|---|---|
| 智能线索分配（按成交率/负载加权、超时转派） | 成交数据刚开始积累 | ~~并新增状态流转时间戳（`contactedAt` / `dealAt`）~~ **时间戳已于 2026-08-29 落地**（迁移 `20260829050000`，盖戳在 `deal-stats.ts` 的 `changeLeadStatus`）。**剩余解锁条件只剩一条**：积累 ≥ 1 个月真实成交数据——且由于时间戳只对新流转生效，这一个月要从上线后重新起算。 |
| 企微聊天侧边栏（H5） | 需要 JS-SDK 签名接线与移动端页面 | 签名能力已就绪（G6 只需补路由），等产品排期 |
| 多门店切换器 | `resolveBeautyStore` 已返回 `availableStores` 但无 UI | 出现真实的多门店任职用户后再做；届时要同步改造 API 的门店参数与越权校验 |
| 助手页推送记录与能力状态区块 | 数据源（`MessageLog` + `Outbox` + 探测接口）已全部就绪，纯 UI 增量 | 产品给出展示口径 |
| 助手页「活跃客户 / 员工排行」统计 | 指标定义缺失 | 产品侧给出明确口径与数据来源字段 |
| ~~企微凭据明文残留的盘点脚本~~ | 已完成：`scripts/audit-wework-plaintext-credentials.mjs`（一次性只读） | 见第九节 9.5 |

---

## 七、技术决策记录

**Q: 企微配置全局还是每店独立？**
A: **每店独立**。凭据加密存储（`v1:` 前缀密文），读时兼容历史明文。

**Q: 企微能力放在 `获客系统/` 还是 `backend/`？**
A: **`获客系统/` 原生实现**，已定论。

**Q: 员工模块叫 `staff` 还是 `employees`？**
A: **`employees`**。

**Q: 分配逻辑用哪份实现？**
A: **`src/lib/beauty/assign-lead.ts`**。任何新的线索创建入口都必须调 `autoAssignNewLead`。

**Q: `dealCount` / `dealAmount` 谁能写？**
A: **只有 `src/lib/beauty/deal-stats.ts`**。口径是「业绩随线索走」。

**Q: `autoAssignEnabled` 默认值为什么是 `true`？**（本轮新增）
A: 现网行为就是自动分配恒开。默认 `false` 会让所有存量门店在升级瞬间"线索不再自动派单"，属静默行为变更。默认 `true` 让升级前后行为完全一致，要关是门店的显式动作。开关只约束 `autoAssignNewLead`，**手动分配不受约束**——管理者永远能派单。

**Q: 企微回调建的线索 `phone` 为什么还写空串？**（本轮新增）
A: 企微不提供手机号。上一版担心的"空串污染去重"已由 `@@unique([storeId, weworkExternalUserId])` 解决，去重职责不再落在 `phone` 上。把 `phone` 改可空要动 baseline 结构与所有读取点，收益不抵成本。空串的语义是"待员工跟进时补录"。

**Q: `weworkExternalUserId` 为什么是复合唯一而不是全局唯一？**（本轮新增）
A: 同一个微信用户完全可能同时是 A 店和 B 店的客户，全局唯一会让第二家店建不出线索。`@@unique([storeId, weworkExternalUserId])` 只在门店内去重，且对 `NULL`（非企微来源线索）不生效。

**Q: cron 为什么同时接受两个鉴权头？**（本轮新增）
A: Vercel Cron 只会发 `Authorization: Bearer`，ECS crontab 历史上发 `x-cron-secret`。只认前者正是本次发现的生产 bug 根因。双头兼容让两套调度器都能通过，且不需要改动任何一侧的既有习惯。`CRON_SECRET` 未配置时**一律拒绝**——缺配置绝不能退化成无鉴权放行。

**Q: 能力探测缓存为什么放进程内而不是 Redis？**（本轮新增）
A: 探测结果是短时效运行时状态，进程内 Map 零依赖零运维。代价是多实例部署时各实例独立缓存（最坏探测量 × 实例数），当前 TTL 下量级可接受。要收紧见第九节第 7 条，属独立改造。

**Q: `BeautyContentClient` 为什么不加 `canManage` prop？**（本轮新增）
A: 内容生成对全角色开放，美容师本来就该能生成自己的种草文案，没有需要按角色隐藏的写入口。**不为了整齐而预留一个恒 `true` 的 prop**，那只会误导后续维护者以为这里有权限差异。

**Q: 回调里 `FollowUserID` 命中直接分配后，还要不要发通知？**（本轮新增）
A: **要发。** 员工确实是自己加的人，但加人动作发生在企微客户端，系统里多了一条待跟进线索这件事他不知道。通知卡片带的是线索详情链接与 AI 评级，价值不在"告诉他加了谁"，而在"把人引回系统跟进"。

**Q: 企微凭据加密为什么不做停机迁移？**
A: `openCredential` 以 `v1:` 前缀区分密文与历史明文。存量数据在下一次保存时自然升级，不需要停机回填。代价是明文残留要靠运营侧逐店重新保存一次收敛，见第九节第 5 条。

**Q: 迁移为什么做 baseline 重置而不是继续补记账？**
A: 旧链已有手工伪造记账 + 三方合并分叉，补记账只是让不可判定状态延后爆炸。详见 2.7。

**Q: 员工必须绑定企微才能用系统吗？**
A: 不必须。企微绑定是增强能力：线索推送、企微内免密登录、活码归属。

**Q: 需要企微服务商资质吗？**
A: 自建应用不需要，但要求企业**已完成微信认证**才能使用客户联系（活码）能力。

---

## 八、上一版 20 条缺口的逐条现状

| # | 上一版缺口 | 现状 | 证据 / 去向 |
|---|---|---|---|
| 1 | 企微设置页明文下发凭据且无角色门禁 | ✅ 已修 | `settings/wework/page.tsx` 门禁 + 掩码下发 |
| 2 | 消息推送缺 `access_token`，真实环境 100% 失败 | ✅ 已修 | `message.ts` 走 `callWeWorkApiWithToken` |
| 3 | 企微凭据明文落库 | ✅ 已修 | `credentials.ts` 全读写点覆盖 |
| 4 | 回调建线索不分配员工 | ✅ **已修** | `msg-callback` 的 `assignByFollowUser`：`FollowUserID` → `assignLeadManual`，回退 `autoAssignNewLead` |
| 5 | 回调无幂等去重与时间戳新鲜度校验 | ✅ **已修** | 双层幂等 + POST 侧 5 分钟时间戳窗 |
| 6 | 回调线索信息残缺（`externalcontact/get` 是 TODO） | ✅ **已修** | `external-contact.ts` 拉真实昵称；`phone` 维持空串属已决策 |
| 7 | `CallbackLog.leadId` 从不写入 | ✅ **已修** | 事件处理后 `update({ processed: true, leadId })` |
| 8 | OAuth 登录不建会话，重定向目标页面不存在 | ✅ **已修** | `wework` provider + 一次性票据；`bind-failed` 页已建并公开 |
| 9 | 前端角色可见性完全未收敛 | ✅ **已修** | `NavItem.requireStoreScope`（只标企微设置一项）+ `nav-utils.ts` 三个纯函数 + 四个 client 的 `canManage` |
| 10 | 员工业绩四字段接口不暴露 | ✅ **已修** | 四字段全链路暴露；`specialties` 可写、`assignedAt` 只读 |
| 11 | 无企微能力探测，原始错误串直穿前端 | ✅ **已修** | `probe.ts` + `errcode.ts` + 活码页降级提示 |
| 12 | 回调按门店遍历试解密，且不校验 CorpID | 🟡 **CorpID 已校验，遍历结构保留** | `decryptMessageWithCorpId`；遍历属已决策不改（第六节砍掉项） |
| 13 | 活码写入不校验 `groupId` / `beautyEmployeeId` 归属 | ✅ **已修** | 400 `group_not_in_store` / `employee_not_in_store` |
| 14 | `updateContactWay` 改名时给企微传 `state`；`scene` 注释与语义相反 | ✅ **已修** | 有害赋值已删；注释已修正 |
| 15 | `BeautyStore.autoAssignEnabled` 不存在，轮转恒开 | ✅ **已修** | 迁移 `20260829030000` + `store` PUT 入口 + `autoAssignNewLead` 尊重开关 |
| 16 | `BeautyLead` 缺 `@@index([assignedEmployeeId])` | ✅ **已修** | 同上迁移，另加 `channelId` 索引 |
| 17 | JS-SDK 签名与被动回复加密零接线 | ⬛ 仍未接线（属未接线而非缺陷） | → G6 |
| 18 | advisory lock 等待超时后不区分结果继续执行 | ⬛ 仍存，记录备查 | 幂等，后果仅多一次企微调用，不排期 |
| 19 | 无多门店切换器 | ⬛ 仍存，属功能边界 | 见第六节延后项 |
| 20 | macOS AppleDouble 垃圾文件导致 1 个失败 suite | ⬛ 环境噪音，勿当回归 | `vitest run` 本次：`254 passed`，`1 failed` suite（`._service.test.ts` 转译失败） |

**统计**：20 条中 **15 条已修**、1 条部分修（#12，剩余部分已决策不改）、4 条不排期（#17 随 H5、#18 记录备查、#19 属边界、#20 属环境噪音）。**规划内无仍需排期的缺口。**

**【2026-08-29 补记：本节复盘范围漏掉了一整类缺口】** `docs/product/beauty-growth-funnel-audit.md` 的漏斗盘点发现三个"字段存在但全代码库零写入方"的问题，均不在上面 20 条内：`BeautyContent.linkedLeadCount`（零写入且被原样喂进每日建议的 LLM prompt，等于让模型在恒假前提上推理）、`BeautyLead.contentId`（零写入）、`utmSource/Medium/Campaign`（API 支持但唯一前端调用方从不传，导致落地页线索的 `source` 恒为 `OTHER`）。**三条已于 2026-08-29 修复并提交**（`attribution.ts` + 落地页表单/API + 内容中心推广链接与线索计数展示），同时给 `BeautyLead` 补上 `contactedAt` / `bookedAt` / `visitedAt` / `dealAt` 四个状态节点时间戳（迁移 `20260829050000`）。

**方法层面的教训**：本节按"上一版列出的缺口"逐条复盘，因此**只能覆盖已经被看见的问题**。"字段有没有写入方"这类问题不会出现在功能验收里，应作为独立检查项列入后续复盘。

### 已知小问题（不排期，记录备查）

1. `settings/wework/route.ts` 的 `hasCredentialChange` 只在 `secret` 或 `corpId` 变更时清 token 缓存。`token` / `encodingAesKey` 变更不影响 `access_token`，行为正确，但字段名容易误读为"任一凭据变更"。
2. `BeautyWeWorkMessageLog` 的失败记录没有 `payload`，故障复现要靠时间戳对齐。这是刻意的 PII 取舍，`payload` 落在 `BeautyWeWorkOutbox` 侧。
3. 出站队列的限频窗口是「最近 60 秒的 `MessageLog` 条数」，属滑动窗口近似而非严格令牌桶。上限 10 条对企微实际配额留了足够余量。

---

## 九、生产环境风险与待确认项（本轮新增，超出美业范围但影响生产）

> 这一节的每一条都**不是开发工作**，而是需要环境信息或用户决策。按紧急程度排序。

### 9.1 `cron/refresh-tokens` 长期 401，平台 OAuth token 从未续期 🔴 最高

- **现象**：修复前该路由只接受 `Authorization: Bearer`，而 ECS crontab 发的是 `x-cron-secret`，请求一律 401。刷新任务从未真正执行过。
- **影响**：因为任务本身没跑，`PlatformAccount.status` 还停在 `ACTIVE`、`SYSTEM_ALERT` 也没落，**故障完全不可见**。级联影响：`sync-leads` 线索回流、广告投放操作、指标快照全部静默失败。refresh token 有绝对有效期，超过后无法程序化续期，**存量账号可能必须让客户到设置页重新走一遍 OAuth 授权**。
- **需要谁做什么**：请在 ECS 上抓 `/var/log/growth-os-cron.log`（确认历史 401 与起始时间）与 `PlatformAccount.tokenExpiresAt` 的分布（确认已过绝对有效期的账号数）。据此判断是"重新部署后自动恢复"还是"需要通知客户重新授权"，后者要准备话术与引导入口。
- **紧急程度**：最高。影响面在部署前必须摸清。

### 9.2 两套调度器并存的重复执行风险 ✅ 已决策并落地（清空 Vercel crons）

- **结论（已拍板）**：以 **ECS crontab 为唯一调度器**，`vercel.json` 的 `crons` 已清空（文件保留为 `{}`）。防重复不再依赖「Vercel 侧恰好 401」这种巧合。
- **现象**：修复前 Vercel 侧 `agent-daily-loop` 是 401、`publish-pending` 未配置，**事实上起到了防重复的作用**；`authorizeCron` 统一后两边都能通过，同一作业会被 ECS 与 Vercel 各触发一次。
- **影响**（按代价排序）：
  - `agent-daily-loop` — 给每个 RUNNING campaign 重复起完整闭环，**含真实广告投放，代价最高**；
  - `publish-pending` — 重复发布内容；
  - `billing/cron-check-expiry` — 重复发续费提醒并重复写审计日志；
  - `refresh-tokens` — 并发刷新可能让先返回的 refresh_token 被作废，账号被误标 `EXPIRED`；
  - `beauty-wework-outbox` — 每分钟频率并发窗口最大（有 `claim` 占坑兜底，重复执行不会重发同一条，但会双倍消耗限频配额）。
- **代码证据**：`deploy.sh`、pm2、`ecosystem.config.cjs`、部署文档里的 `172.18.79.99:3000` 都指向 **ECS 是生产主体**，但尚未最终确认。
- **已做的事**：清空 `vercel.json` 的 `crons`（保留文件），并在 `setup-cron.sh` 头部与 `docs/deploy-update.md` 写明「不要加回来」及原因。
- **剩余动作**：部署后在 ECS 上重跑 `bash scripts/deploy/setup-cron.sh`，确认 7 条作业就位。

### 9.3 Vercel 计划等级未确认 ✅ 已失去影响（crons 已清空）

- **现象**：Hobby 计划只允许 2 条 cron 且每天最多执行一次，分钟级需要 Pro。仓库里已有 `* * * * *` 的作业。
- **影响**：要么当前在 Pro（那 9.2 的重复执行是真实的），要么 Vercel 侧根本没实际承载这些作业（那 `vercel.json` 是摆设，也说明生产就是 ECS）。两种情况的处置不同。
- **处置**：`crons` 已清空，Vercel 侧不再承载任何定时任务，计划等级不再是本项目的输入。ECS 的 1 分钟频率保持不变——出站队列限频窗口就是 1 分钟，放大间隔会让通知延迟。
- **紧急程度**：已解除。

### 9.4 `NEXT_PUBLIC_APP_URL` 生产未配置的风险 🟡 中

- **现象**：`notify-assignment.ts` 与 `oauth-callback/route.ts` 都用 `process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8787"` 兜底。
- **影响**：若生产未配置，发给员工的企微通知卡片链接会指向 `localhost:8787`，员工点开是死链；企微 OAuth 的四处 redirect 同样会跳到 localhost，登录闭环直接断掉。
- **需要谁做什么**：在 ECS 的 `.env.production` 里确认该变量存在且是对外可访问的正式域名（不是内网 IP，员工手机在企微里点开要能访问）。
- **紧急程度**：中，属配置检查，几分钟能确认。

### 9.5 企微凭据明文残留 🟢 低

- **现象**：`openCredential` 兼容明文（无 `v1:` 前缀即视为明文原样返回），存量门店要等下一次保存配置才升级为密文。
- **影响**：数据库里仍有明文凭据，泄露面未完全收敛。功能不受影响。
- **需要谁做什么**：跑 `node scripts/audit-wework-plaintext-credentials.mjs`（**已编写**），列出 `weworkSecret` / `weworkToken` / `weworkEncodingAesKey` 仍是明文（不以 `v1:` 开头）的门店，推动运营侧逐店重新保存一次。脚本是一次性只读的：单条 SELECT + 显式只读事务，且不取凭据本体、只取「是否带 `v1:` 前缀」的布尔判定，输出不含凭据或其片段。
- **紧急程度**：低，可在上线后跟进。

### 9.6 `optimization-expire` 的时区注释与行为不符 🟢 低

- **现象**：`src/app/api/cron/optimization-expire/route.ts` 的文档注释写 `Triggered daily at UTC 00:00 (Beijing 08:00)`，但 crontab 跑在服务器本地时区（通常 CST），`setup-cron.sh` 里的 `0 0 * * *` 实际是**北京时间 00:00**。
- **影响**：行为本身无害（过期清理什么时候跑都对），但注释误导后续维护者。
- **需要谁做什么**：确认服务器时区后修正注释（属代码注释修改，本轮未动）。
- **紧急程度**：低。

### 9.7 进程内探测缓存在多实例部署下的放大 🟢 低

- **现象**：`probe.ts` 的缓存是进程内 `Map`，多实例部署时各实例独立缓存。
- **影响**：最坏情况探测调用量 = 单实例量 × 实例数。当前 TTL（成功 10 分钟 / 失败 1 分钟 / 强制刷新 30 秒下限）下量级可接受。
- **需要谁做什么**：确认生产是单副本还是多副本。若为多副本且探测量需要收紧，把缓存挪到 Redis（属独立改造，不影响本轮上线）。
- **紧急程度**：低。

---

## 十、上线前检查清单

> 全部勾完才能把本轮改动部署到生产。分四组，组内有先后顺序。

### 第 1 组：数据库迁移落地

- [ ] **DBA 在目标库预装 `vector` 扩展**（`CREATE EXTENSION IF NOT EXISTS "vector";`）。应用角色不负责建扩展，也不应有该权限。
- [ ] 用 `prisma migrate diff` **证明线上现有结构与 `20260829010000_baseline` 一致**（两个方向都跑）。线上大概率已有这批表，**不能直接 deploy baseline**。
- [ ] diff 若有差异：**先补一条差异迁移，不要动 baseline 文件**，补完重新回到上一步。
- [ ] diff 无差异后，`prisma migrate resolve --applied 20260829010000_baseline` 记账。
- [ ] `prisma migrate deploy` 依次应用 `20260829020000` / `20260829030000` / `20260829040000`。三条都是纯新增（加列 / 加索引 / 加表），无破坏性操作。
- [ ] deploy 后再跑一次 `migrate status`，期望 `4 migrations found` + `Database schema is up to date!`。
- [ ] 全程禁止 `migrate reset`、禁止 `DROP`、禁止手改 `_prisma_migrations` 数据行、禁止删除 `_archive-migrations-20260829/` 与 `_merge-backup/` 与两个验证库。

### 第 2 组：调度器二选一（部署前的硬门槛）

- [x] 确认 Vercel 账号计划等级（第九节 9.3）——`crons` 已清空，该项不再是输入。
- [x] 确认生产主体是 ECS（`deploy.sh` / pm2 / `ecosystem.config.cjs` / `172.18.79.99:3000` 均指向 ECS）。
- [x] **已拍板并落地：清空 `vercel.json` 的 `crons`，以 ECS 为唯一调度器**。`authorizeCron` 的改动可以随本轮一起部署，不会双触发。
- [ ] ECS 侧重跑 `bash scripts/deploy/setup-cron.sh`，确认 7 条作业就位（`crontab -l | grep growth-os-cron`）。

### 第 3 组：环境变量

- [ ] `CRON_SECRET` 在 ECS 的 `.env.production` 里已配置且非空。**未配置时 `authorizeCron` 一律拒绝**，所有定时任务会全部 401。
- [ ] `NEXT_PUBLIC_APP_URL` 已配置为对外可访问的正式域名（第九节 9.4）。用企微通知卡片的链接与 OAuth redirect 各验证一次。
- [ ] `AUTH_SECRET` 已配置（企微登录票据与 NextAuth session 共用这把密钥）。
- [ ] Redis 可用（OAuth state nonce 与登录票据 nonce 都存 Redis，不可用会让一次性消费保护退化）。

### 第 4 组：功能与安全验证

- [ ] 抓 `/var/log/growth-os-cron.log` 与 `PlatformAccount.tokenExpiresAt` 分布，判定平台 OAuth token 的存量影响面（第九节 9.1）。若有账号已过绝对有效期，准备客户重新授权的通知与引导。
- [ ] 部署后手动冒烟 7 条 cron，确认全部 200 而非 401。
- [ ] 企微回调 URL 在企微后台重新验证一次（GET echostr 握手要通过）。**注意 POST 侧新增了 5 分钟时间戳窗，服务器时间必须准**——确认 NTP 同步正常。
- [ ] 用一个真实门店走一遍：保存企微配置 → 能力探测三项全绿 → 建活码 → 手机扫码添加员工 → 30 秒内出现归属正确的线索 → 员工企微收到通知卡片 → 点开链接落在线索详情。
- [ ] 用 `BEAUTICIAN` 账号登录，确认侧边栏看不到「企微设置」（唯一收敛项），落地页 / 员工 / 活码可进但只读、写按钮不渲染，直接访问 `/beauty/settings/wework` 被重定向到驾驶舱。
- [ ] 企微凭据明文盘点：跑 `node scripts/audit-wework-plaintext-credentials.mjs`（只读）列出仍是明文的门店，推动运营侧逐店重新保存收敛。

---

## 十一、经营指标的实现边界与归属决策（已采纳）

> 本节记录「哪些经营指标由 Growth OS 负责、哪些划归 ZhiFlow、哪些暂不做」，以及已落地口径的精确定义。
> 代码侧的唯一口径来源是 `获客系统/src/lib/beauty/funnel.ts` 的头部注释，两边必须一致。

### 11.1 Growth OS 负责并已实现

数据来源全部是 `BeautyLead` 上的状态流转节点时间戳（`contactedAt / bookedAt / visitedAt / dealAt`，
首次进入对应状态时盖戳、回退不清空）与 `dealAmount`，**零新增迁移**。

- 接口：`GET /api/beauty/dashboard/funnel?range=today|last7|month`（只读）。
- 聚合实现：`src/lib/beauty/funnel.ts`；界面：驾驶舱的「经营漏斗」卡片。
- 权限与门店隔离沿用 `resolveBeautyStore` + `leadScopeWhere`：店主 / 店长看全店，美容师等只看自己名下线索。

**同期群（cohort）口径（硬要求）**：所有比率的分母恒为「`createdAt` 落在所选时间窗内的线索数」，
分子只在**同一批线索**里数节点时间戳非空的条数。不采用「窗内盖戳数 ÷ 窗内新增数」，
那样分子分母不是同一批人，月初月末会出现比率 > 100% 的荒谬结果。

| 指标 | 口径定义 |
| --- | --- |
| 新增线索数 | 时间窗内 `createdAt` 落在窗内的线索条数（所有比率的分母） |
| 有效线索率 | `contactedAt IS NOT NULL AND status != 'LOST'` ÷ 同窗新增数 |
| 预约率 | `bookedAt IS NOT NULL` ÷ 同窗新增数 |
| 到店率 | `visitedAt IS NOT NULL` ÷ 同窗新增数（**分母是线索数，不是预约数**，见 11.3） |
| 成交率 | `dealAt IS NOT NULL` ÷ 同窗新增数 |
| 客单价 | 窗内成交线索中 `dealAmount` 非空的金额之和 ÷ 这些线索的条数 |

- **有效线索率为什么选这个口径**：另两个候选都被否掉——`aiGrade ∈ {S,A}` 的实际含义只是「表单填得全」，
  与「线索是否有效」无关；单纯 `status != 'LOST'` 会稳定在接近 100%，没有区分度。
- **客单价对 NULL 金额的处理**：`dealAmount` 为 NULL 的成交线索**从分子分母同时排除**（否则均价被摊薄成假数字），
  同时以 `dealsMissingAmount` 单独返回「缺金额的成交条数」，界面提示「另有 N 条成交线索未填金额，客单价被低估」。
- **时区**：`Asia/Shanghai`，按 +08:00 固定偏移实现（中国大陆 1991 年后无夏令时），未引入任何日期库。
  时间窗粒度为「今日 / 近 7 天（含当天共 7 个自然日）/ 本自然月」。
- **界面必须标注的两条限定**（写在卡片上，不是代码注释）：
  ① 上线前的存量线索没有留下状态流转时间，不计入分子，上线初期各项比率会偏低；
  ② 所有比率依赖员工及时维护线索状态，没人改状态时比率显示为 0——这是录入问题而非经营问题。
- **配套录入**：成交金额此前后端已就绪但前端从不提交，导致 `dealAmount` 生产环境恒为 NULL。
  现已在线索管理页补上：状态改为「已成交」时弹出金额输入框（可留空，不阻塞状态流转），
  已成交线索也可事后补填 / 修改；负责人业绩按「新值 - 旧值」的差额调整，不会重复累加。

### 11.2 明确划归 ZhiFlow，Growth OS 不做

- **CAC、成交成本、ROI**：ZhiFlow 侧已有 `ad_spend_daily` 表 + 手工批量导入界面 + 腾讯广告 API 同步；
  Growth OS 侧**零成本数据**，没有广告花费就算不出任何带「成本」的指标。硬做只能让老板手填花费，是重复建设。
- **复购率、LTV**：不做的技术原因必须记清楚——`BeautyLead.dealAmount` 是**单值字段**，
  一个客户的第二笔成交**物理上无处存放**。要支持复购必须把 `BeautyCustomer` 与 `BeautyLead` 拆开、重构客户模型
  （线索是一次转化过程，客户是长期实体），这是本清单里**最贵且最不可逆**的一档改造。
  另注明：**LTV 目前在两套代码里都未实现**，不存在「ZhiFlow 已经有了」的情况。

### 11.3 暂不做（有明确技术前置条件）

- **咨询率**：系统里没有「客户主动咨询」这个概念。`CONTACTED` 的语义是「员工去联系了」，方向相反，
  拿它当咨询数会把指标算反。要做需要接企微会话存档（拿到客户首次主动发言），或新建咨询实体并改录入流程。
- **行业口径的到店率**：行业惯用「预约数 → 到店数」，而 Growth OS **没有预约实体**（`BOOKED` 只是线索状态，
  不是一条可数的预约记录）。因此只提供「线索 → 到店率」，并在文档与界面标注口径与 ZhiFlow 不同，不可直接比对。

### 11.4 已知口径差异与本轮处置

- 新漏斗看板用 `Asia/Shanghai` 自然月；原驾驶舱概览（`api/beauty/dashboard/route.ts` 与
  `beauty/dashboard/page.tsx`）是**滚动 7 / 30 天**，两者数字天然不会一致，这是口径差异而非 bug。
- 旧接口原先用 `new Date()` + `setHours(0,0,0,0)`，部署到 UTC 时区的服务器会错 8 小时（「今日新增」跨日错位、
  7 天趋势的日期标签整体偏移一天）。**本轮顺手修掉了**：改为复用 `shanghaiDayStart` / `shanghaiDateKey`，
  影响面仅限这两个文件里的时间窗计算与趋势日期标签，滚动 7 / 30 天的语义未变（仍是滚动窗，不是自然月）。
