# liangmuMedicine Server

良木药谷后端使用 Node.js、Express、TypeScript、PostgreSQL 和 Prisma 7。目前已完成 V2 模型、migration、seed、数据库健康检查、登录/JWT 身份校验、RBAC 角色守卫、按角色和组织过滤的批次读取，以及建档、审核、种植日志、采收、加工认领、加工完成、质检摘要、确认出库和确认收货写接口；React 已接入这些能力。

## 当前能力

- Express API 骨架
- `GET /api/health` 服务与 PostgreSQL 健康检查
- Prisma V2 多组织核心模型
- `@prisma/adapter-pg` + `pg` PostgreSQL Driver Adapter
- 共享 Prisma Client 与进程退出时的连接释放
- 两条 PostgreSQL migration
- 可重复执行的开发 seed
- 登录、当前用户查询、角色守卫、账号和组织状态检查
- 一小时 Access Token、登录限流及统一错误响应
- 批次分页、搜索、阶段/审核/风险筛选和 ID/溯源码详情查询
- 管理员、种植商、加工商和采购商的批次行级读取范围及详情字段过滤
- 未分配批次共享待认领、认领后组织隔离与版本并发保护
- 管理员确认出库、采购商确认收货，并原子记录阶段事件
- DeepSeek 风险分析与只读工具调用、人工复核审计、过期建议保护
- 风险分析 SSE 阶段事件与客户端断线取消，保留非流式接口
- 单轮 RAG 资料问答接口与 BM25 检索（多入口页面、本地真实问答 HTTP 链路与 Mock 模型浏览器交互已验收）
- 管理员本人通知分页/筛选/未读计数、幂等已读接口与 JWT Socket.IO 通知提示；前端消息中心/铃铛本地浏览器验收完成
- 不修改真实数据库、不消耗模型费用的 70 项鉴权/批次/风险分析/资料问答/通知自动化测试

## 本地准备

安装依赖：

```powershell
cd server
npm install
```

复制环境变量模板：

```powershell
Copy-Item .env.example .env
```

在 `.env` 中填写本机连接串：

```env
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/liangmu_medicine?schema=public
```

`.env` 包含密码和 API Key，不得提交到 Git。后端启动和 Prisma 数据库命令都要求存在有效的 `DATABASE_URL`。

开发环境可以不设置 `JWT_SECRET`：服务启动时生成随机密钥，重启后需要重新登录。部署时必须设置 `NODE_ENV=production` 和至少 32 字符的随机 `JWT_SECRET`，缺少密钥会启动失败。可在本地生成密钥后复制到 `.env`，不要提交或发送给前端：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 初始化数据库

校验 Schema 并生成 Prisma Client：

```powershell
npm run prisma:validate
npm run prisma:generate
```

在新环境应用仓库中已有的 migration：

```powershell
npx prisma migrate deploy
```

导入开发演示数据：

```powershell
npm run prisma:seed
```

Prisma 7 只会在显式执行 `prisma db seed` 时运行 seed。当前 seed 从仓库的 `public/data/herb-batches.json` 读取并校验 15 条前端样例，使用固定主键和 `upsert` 写入：

- 12 个组织
- 8 个测试账号
- 15 个药材批次
- 50 条批次事件
- 14 条审核记录
- 7 条附件元数据
- 4 条业务通知

重复执行不会增加重复记录。测试账号密码会先通过 bcryptjs 哈希，再写入 `passwordHash`。

## 启动与检查

开发启动：

```powershell
npm run dev
```

默认地址：<http://localhost:4000>

健康检查：<http://localhost:4000/api/health>

数据库可用时返回：

```json
{
  "status": "ok",
  "service": "liangmuMedicine API",
  "database": "connected",
  "timestamp": "..."
}
```

数据库不可用时返回 HTTP 503，并将状态标记为 `degraded`。

## 常用命令

```powershell
npm run typecheck
npm test
npm run build
npm run prisma:validate
npm run prisma:generate
npm run prisma:seed
npm run prisma:studio
```

修改 Schema 后，在交互式本地终端创建开发 migration：

```powershell
npm run prisma:migrate:dev -- --name 迁移名称
```

不要改写已经应用过的 migration。新环境或部署环境只应用仓库已有 migration，应使用 `prisma migrate deploy`。

## 鉴权接口

`POST /api/auth/login`，JSON 请求体：

```json
{ "account": "lijialin", "password": "lijialin123", "role": "admin" }
```

- `account` 支持用户名或邮箱，邮箱匹配不区分大小写。
- `role` 是登录页所选角色，后端会与数据库角色比较，不会据此授予权限。
- 不接受客户端传入 `organizationId` 等额外字段。
- 密码不做 trim；超过 bcrypt 的 72 字节限制直接拒绝。

成功返回 `{ accessToken, tokenType: "Bearer", expiresIn: 3600, user }`。
`user` 包含 `id / username / email / displayName / role / organizationId / organization`，不会返回 `passwordHash`。`organization` 为 `{ id, name, type }` 或 `null`。

`GET /api/auth/me`，请求头使用 `Authorization: Bearer <accessToken>`，成功返回 `{ user }`。Token 只携带用户 ID 等标准声明；每次请求重新读取用户角色、组织和禁用状态，禁用或改角色后旧 Token 也立即遵循新权限。

统一错误格式：`{ error: { code, message, details? } }`。前端以 HTTP 状态和 `error.code` 分支处理，不依赖中文消息内容。

| HTTP | 主要错误码 | 前端处理方向 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR / INVALID_JSON | 展示输入错误 |
| 401 | INVALID_CREDENTIALS / UNAUTHENTICATED / INVALID_TOKEN | 登录失败或清理失效登录态 |
| 403 | FORBIDDEN / ACCOUNT_DISABLED / ORGANIZATION_DISABLED / INVALID_ORGANIZATION | 提示无权限或账号状态异常 |
| 404 | NOT_FOUND | 请求地址不存在 |
| 413 | PAYLOAD_TOO_LARGE | 提示请求体过大 |
| 429 | TOO_MANY_ATTEMPTS | 按 Retry-After 提示稍后重试 |
| 500 | INTERNAL_ERROR | 通用错误提示，不向客户端暴露内部异常 |

登录限流按 IP 计数：15 分钟内最多 20 次失败尝试，成功请求不持续计数。当前内存计数器仅适合单进程 MVP；反向代理部署时需按实际拓扑配置可信代理，不能盲设 `trust proxy = true`。

受保护的业务路由应先调用 `authenticate(service)`，再调用 `requireRoles(...)`；身份上下文在 `req.auth`。后续查询必须根据它的 `organizationId` 增加组织过滤，角色守卫不等于业务行级数据隔离。

测试位于 `tests/auth.test.ts`，使用 Node.js 内置测试器、真实 JWT/bcrypt 和内存用户模拟 HTTP 请求，无需数据库在线。`npm run typecheck` 同时覆盖运行代码、seed 和测试。

MVP 暂不实现 Refresh Token 和服务端登出撤销：客户端退出时删除本地凭证，不会撤销已泄漏的 Token；它仍可能在过期前使用。部署必须使用 HTTPS，JWT 密钥不得传入前端。

## 批次接口

全部接口均要求 `Authorization: Bearer <accessToken>`，并设置 `Cache-Control: no-store`。

读取接口：

- `GET /api/batches`：支持 `page`、`pageSize`、`search`、`stage`、`auditStatus`、`riskLevel`
- `GET /api/batches/:identifier`：`identifier` 可为数据库 ID 或溯源码

列表响应为 `{ items, pagination: { page, pageSize, total, totalPages } }`，详情响应为 `{ batch }`。数据范围由服务端认证身份决定，不接受客户端传入组织 ID：

- admin：全部批次
- grower：本种植组织批次
- processor：本加工组织已认领的批次，以及审核通过、已采收且未分配的共享待认领批次
- buyer：审核通过的批次

详情继续按 `visibleRoles` 过滤事件，完整审核历史暂只向管理员返回。不可见批次与不存在批次统一返回 404，避免通过接口枚举其他组织的数据。

写入接口：

- `POST /api/batches`：仅种植商可调用；服务端从认证身份派生种植组织与创建人，固定生成 `planting + pending + normal` 初始状态，并原子写入建档事件
- `PATCH /api/batches/:identifier/audit`：仅管理员可调用；接收 `approved/rejected`、可选原因与风险等级，原子更新状态、审核记录、审核事件和版本号
- `POST /api/batches/:identifier/events`：仅所属种植组织可追加种植日志，操作人由登录身份生成
- `POST /api/batches/:identifier/harvest`：仅所属种植组织可登记采收，原子写入采收事件、阶段变更事件，并将 `planting` 推进为 `harvested`
- `POST /api/batches/:identifier/processing/receive`：加工商认领未分配批次，绑定当前加工组织并推进为 `processing`
- `POST /api/batches/:identifier/processing/complete`：本加工组织写入加工记录与阶段事件，推进为 `warehousing`
- `POST /api/batches/:identifier/processing/quality-report`：本加工组织为加工中或仓储批次保存质检文字摘要
- `POST /api/batches/:identifier/shipping/dispatch`：仅管理员可将审核通过的仓储批次推进为 `shipped`，不接收客户端操作人字段
- `POST /api/batches/:identifier/receipt/confirm`：仅采购商可将审核通过的已出库批次推进为 `sold`，不接收客户端操作人字段

请求体使用 Zod 严格校验，不接受客户端提交组织、创建人、事件操作人和初始审核状态等可信字段。加工操作通过登录身份绑定组织；出库和收货接口使用数据库事务及 `version + 当前阶段 + 审核状态` 条件更新，避免重复请求或并发操作覆盖结果。业务日期按 `Asia/Shanghai` 判断，避免 UTC 服务器在中国时区凌晨误判“今天”。

当前数据模型没有订单、合同、物流单、采购商组织归属或指定收货人关系。因此收货接口的 MVP 权限只是“已登录且角色为采购商”，任一采购商都能确认任一审核通过的已出库批次；这只能演示阶段闭环，不能视为生产级订单所有权校验。

## AI 风险审核接口

前端审核抽屉已接入，真实 DeepSeek + PostgreSQL + HTTP 烟测通过（建议保存、人工复核、审计关联、权限过滤和过期保护）。在 `server/.env` 设置 `DEEPSEEK_API_KEY` 后重启后端，`DEEPSEEK_MODEL` 默认 `deepseek-flash`，模型名称可以按账户支持情况调整。Key 只保存在服务端；模板中的 Key 必须保持为空。本地浏览器已使用 Mock 模型 + 真实 PostgreSQL 验证停止、失败、手动重试与人工审核；该轮不消耗模型费用，临时数据已清理。

- `GET /api/batches/:identifier/risk-analysis`：查询最新建议，没有记录时返回 `{ analysis: null }`；批次版本变化或已审核时标记 `stale`
- `POST /api/batches/:identifier/risk-analysis`：管理员发起分析，返回 201 `{ analysis }`；仅允许待审核批次，请求体为空
- `POST /api/batches/:identifier/risk-analysis/stream`：同样要求管理员和待审核状态，请求体为空；成功响应为 `text/event-stream`，与非流式分析共用每用户限流
- `POST /api/batches/:identifier/risk-analysis/:analysisId/review`：管理员提交 `{ decision, riskLevel, reason }`，事务内更新审核状态并关联建议记录

Agent 使用 `get_batch_snapshot`、`inspect_trace_records` 两个只读工具。工具参数不接受其他批次 ID；最多三轮取数、六次工具执行和一次最终 JSON 输出。服务端使用 Zod 校验结果并检查引用 ID 来自本轮资料；资料缺失或已有风险不能被模型降低为“正常”。引用 ID 有效不等于模型结论绝对正确，人工仍需核对依据。没有药典或外部医学规则接入。

建议存放在 `BatchEvent.payload`（`kind=auditRiskAnalysis`），只对管理员可见；人工结论存放在 `BatchAudit`（`source=aiAssisted`），保存模型名与分析快照。无需新增 migration。分析不会改动 `auditStatus/riskLevel`，只记录建议并递增版本；人工复核通过版本条件更新拒绝旧建议和重复提交。

分析整体超时为 55 秒，每用户每分钟最多 5 次，单进程内同批次不能同时分析。上游 401 转为本系统 502，避免前端把 AI Key 配置错误当作登录失效。主要错误码包括 `AI_NOT_CONFIGURED`（503）、`AI_TIMEOUT`（504）、`AI_UPSTREAM_ERROR/AI_INVALID_RESULT`（502）、`AI_ANALYSIS_STALE/AI_ANALYSIS_RUNNING`（409）、`AI_RATE_LIMITED`（429）。

协议参考：[DeepSeek API](https://api-docs.deepseek.com/api/create-chat-completion)。模型仍以完整 JSON 返回；SSE 是服务端业务阶段事件，不是模型逐 token 输出或思维链。

### SSE 阶段与取消

第十二刀已完成前端 Hook/抽屉 SSE 接入，真实前端数据源/HTTP/DeepSeek/PostgreSQL 烟测与本地 Mock 模型浏览器交互验收均已通过；不等同于生产反向代理验收。前端使用 TanStack Query 管理请求与已保存建议，React state 保存本次临时进度，AbortController 保存在 ref 中；停止/失败后查询最近保存结果，不自动重跑分析。

- `progress`：`{ seq, stage, status, message, toolName?, at }`；stage 为 snapshot/model/tool/validate/save，status 为 running/completed，seq 在本次连接中连续递增
- `result`：`{ analysis }`，只在完整校验和保存后发送；建议仍待管理员人工审核
- `error`：`{ status, code, message }`，终态错误，不泄露上游或数据库内部诊断；开始 SSE 前的权限、入参、阶段等错误仍返回标准 HTTP JSON
- 采用 UTF-8 和空行分帧，每 10 秒发送注释心跳；使用 `no-transform` 与 `X-Accel-Buffering: no`，部署时仍需实际确认反向代理不会缓冲
- 不自动重连；单条 POST 代表一次付费分析。断流后先 GET 查询最新建议，必要时由用户手动重新分析
- 响应连接关闭会通过 AbortSignal 中断后续模型调用，服务在模型/工具/保存边界检查取消；事务内提交前观察到取消则回滚。客户端取消记为 `AI_CANCELLED`，整体超时仍为 `AI_TIMEOUT`
- 如果取消与数据库提交竞态，已经保存的建议不会自动删除；取消也不保证退还上游已产生的费用。MVP 没有后台任务队列、持久化运行进度或断点续传

格式参考：[MDN SSE](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)。

## 单轮 RAG 资料问答（第十三刀）

`POST /api/batches/:identifier/questions`：需要登录，请求体严格为 `{ "question": "2～500 字符的问题" }`，返回 `{ reply }`。四角色均使用现有 `BatchService.detail` 的组织/批次范围与事件裁剪，不接收前端批次快照、资料来源或角色。未知或无权访问均返回 404。

- `reply` 含问题、纯文本答案、answered/insufficient 状态、服务端映射的 citations、批次 ID、模型名、知识版本和时间；不修改批次、保存会话或自动审核
- 在 `src/knowledge/herbs.ts` 人工整理四味药材的 8 个非临床背景摘要，链接到香港浸会大学中药材图像数据库的公开记录；核对日期不是原文发布时间，不是完整药典或全量爬虫
- 中文双字片段/英文词 + BM25 词法检索与小量扩展，最多 6 个相关片段；没有依据则直接资料不足。Embedding/pgvector 后置，无新 Key、依赖、表或 migration。评分参数参考 [Elasticsearch BM25](https://www.elastic.co/docs/reference/elasticsearch/index-settings/similarity)
- 批次事实来自权限裁剪后的 detail，排除 AI 审核建议、操作人和完整 payload；当前只查看基础字段及最近 20 条可见事件的有限文字摘要
- 模型仍使用既有 DeepSeek 原生 fetch 代理，一次 JSON 生成；Zod 校验结构，引用 ID 必须来自本轮召回且与正文对应，URL 由服务端映射，不由模型提供。检查引用存在不能证明内容完全受来源支持
- 55 秒超时、断线取消、每用户 10 次/分钟、单进程内每用户一次运行保护；返回前重新检查批次访问/版本与账号角色/组织变化。不是多实例共享队列或持久化任务
- 医疗关键词拒答和提示词隔离仅为 MVP 防护，不宣称完全解决医学安全、提示词注入或幻觉；不提供诊断、剂量、处方或治疗建议
- 62 项后端自动化使用内存批次/Mock 模型；另完成真实 DeepSeek + PostgreSQL + HTTP 验收，使用现有已审核黄芪批次，不创建测试用户/批次，不执行 migration/seed。登记产地与通用背景回答各调用一次模型，医疗及无依据问题不调用模型，批次/事件/审核记录前后指纹一致
- 前端 Hook/共用组件已接入详情与快速预览；本地浏览器采用 Mock 模型 + 真实 PostgreSQL 验收停止、失败、手动重试、来源展示与弹窗卸载，后端观察到两次取消。临时服务、脚本和标签已关闭/清理；不是生产环境或摄像头/微信真机扫码验收

新增错误码：`AI_QUESTION_RUNNING`（409）、`AI_QUESTION_STALE`（409）；AI 代理和取消错误沿用既有约定。问答与风险分析使用独立限流计数，两者不自动重试。

## 持久化通知与 Socket.IO（第十四刀）

- `GET /api/notifications?page=1&pageSize=10&status=all` 返回 `{ items, total, unreadCount, page, pageSize }`；status 可为 all/unread/read，未读计数始终针对本人全部通知。用户 ID 来自登录身份，不接受 recipientId。未知查询字段返回 400
- `PATCH /api/notifications/:id/read` 接受空对象，返回 `{ item }`；只标记本人消息，未知或其他收件人的 ID 都返回 404，非管理员返回 403。条件更新确保并发/重复点击不覆盖首次 readAt；通知内部 metadata/recipientId 不进入 DTO。通知路由响应设置 `Cache-Control: no-store`，避免私人数据被 HTTP 缓存保存
- 建档、首条事件与有效管理员的 batchSubmitted 通知在同一事务中写入。仅 role=admin、active 且平台组织有效（或无组织）的账号收通知；事务完成后才发布提示，没有有效管理员时不创建空消息
- Express 与 Socket.IO 共用 HTTP Server；客户端使用 `/socket.io`，handshake.auth 仅接受 `{ token }`，JWT 验证与数据库 currentUser 检查独立于前端路由。服务端决定用户房间，不开放任意 join 指令；Origin 限定 CLIENT_ORIGIN，无 Origin 的 CLI 也必须有合法 JWT
- `notifications:changed` 只提醒前端缓存失效，不携带通知正文。JWT 到期主动断开；长连接每 30 秒检查账号、组织与角色变化，变化时发送 session:invalid 并断开（不是每帧实时检查）。每个 REST 请求仍独立认证
- 服务为单实例内存广播，没有 Redis adapter、outbox、持久化事件重放或必达保证。提示失败不撤销已提交业务；前端必须在连接/重连时查询 PostgreSQL 补齐，消息表是唯一持久化来源。参考 [Socket.IO 交付保证](https://socket.io/docs/v4/delivery-guarantees/)
- 8 项新增自动化覆盖收件人范围、参数与角色、幂等、提交后推送、真实 Socket 握手/Origin/房间、断线后 REST 补查、JWT 过期与账号停用；总计 70 项。数据库烟测生成一条随机标记批次和两名管理员的通知，验证推送与已读恢复后全部精确清理，没有执行 seed/migration
- 前端数据源、Query Hook、App 全局订阅、消息中心与铃铛已接入。真实 PostgreSQL 的本地浏览器验收覆盖双账号建档即时通知、已读/计数/筛选、刷新持久化、链接与角色拦截；临时数据已精确清理，没有调用 AI 或改动 seed。本次浏览器未模拟网络断线，不将集成测试结论冒充浏览器结论
- 当前只有建档生成新持久化通知。聊天室、其他阶段通知、生产代理/部署均未实现或未验证。pg 弃用提示仍为工程化待办，不影响本轮通过结果

## 下一阶段

前端开发模式通过 Vite 将 `/api` 和 `/socket.io`（启用实时连接代理）转发到本服务；生产构建默认使用独立的 demo 认证，不要求静态托管平台运行本服务。环境切换与请求层说明见根目录 README。

1. 第十四刀本地验收完成；下一阶段实现最小一对一聊天的权限、持久化历史与实时收发
2. 匿名脱敏溯源、真实附件存储、其他阶段通知和前端页面测试
3. 后端部署时验证 SSE 代理缓冲、超时与断线取消
