# LiangmuTrace Server

良木药谷后端使用 Node.js、Express、TypeScript、PostgreSQL 和 Prisma 7。目前已完成 V2 模型、migration、seed、数据库健康检查、登录/JWT 身份校验、RBAC 角色守卫、按角色和组织过滤的批次读取，以及建档、审核、种植日志、采收、加工认领、加工完成、质检摘要、确认出库和确认收货写接口；React 已接入这些能力。

## 当前能力

- Express API 骨架
- `GET /api/health` 服务与 PostgreSQL 健康检查
- Prisma V2 多组织核心模型
- `@prisma/adapter-pg` + `pg` PostgreSQL Driver Adapter
- 共享 Prisma Client 与进程退出时的连接释放
- 五条 PostgreSQL migration 均已应用：初始模型、V2 核心模型（含通知）、AI 专用会话表、独立人工聊天三表、批次收货采购组织
- 可重复执行的开发 seed
- 登录、当前用户查询、角色守卫、账号和组织状态检查
- 一小时 Access Token、登录限流及统一错误响应
- 批次分页、搜索、阶段/审核/风险筛选和 ID/溯源码/批次号详情查询（相同权限范围）
- 管理员、种植商、加工商和采购商的批次行级读取范围及详情字段过滤
- 未分配批次共享待认领、认领后组织隔离与版本并发保护
- 管理员确认出库、采购商确认收货，并原子记录阶段事件
- DeepSeek 风险分析与只读工具调用、人工复核审计、过期建议保护
- 风险分析 SSE 阶段事件与客户端断线取消，保留非流式接口
- 单轮 RAG 资料问答接口与 BM25 检索（多入口页面、本地真实问答 HTTP 链路与 Mock 模型浏览器交互已验收）
- 四角色本人通知分页/筛选/未读计数、幂等已读接口与 JWT Socket.IO 通知提示；建档、审核、采收和加工入库通知及多角色消息中心已本地验收
- 无批次普通聊天接口，认证后仅接收本轮问题；全局前端已本地接入，不是多轮会话或 RAG
- 第十六刀本人持久化会话、受限多轮、编号定位与规则分流（迁移、前端与真实数据库/DeepSeek/浏览器本地验收完成）
- 第十七刀管理员全量统计只读接口（前后端与本地浏览器验收完成）
- `/auth/me` 已有 username、姓名、邮箱、角色与组织字段直接供第十八刀只读个人资料页使用；本刀没有增加资料编辑或改密接口
- 第二十刀独立人工聊天 REST、联系人/成员授权、UUID 幂等、顺序/已读游标与 Socket.IO 双方提示，采购商仅平台客服
- 第二十二刀匿名白名单溯源只读接口及前端公开页面/分享入口（本地验收完成，公网/微信真机待验证）
- 不修改真实数据库、不消耗模型费用的 130 项鉴权/批次/风险分析/资料问答/通知/AI与人工聊天/看板/公开溯源/收货归属/生产配置自动化测试

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

开发环境可以不设置 `JWT_SECRET`：服务启动时生成随机密钥，重启后需要重新登录。生产必须设置 `NODE_ENV=production`、显式 HTTPS `CLIENT_ORIGIN` 和至少 32 字符的随机 `JWT_SECRET`，非法配置会启动失败。可在本地生成密钥后复制到 `.env`，不要提交或发送给前端：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 生产配置（第二十五刀本地验证，未部署）

- 设置 `NODE_ENV=production`、显式 HTTPS `CLIENT_ORIGIN` 与至少 32 字符的随机 `JWT_SECRET`。来源只能是一个 origin，不带凭证、业务路径、查询或片段；允许尾斜杠并正规化。PostgreSQL URL 必须有主机/数据库名，端口范围为 1～65535
- `.env.example` 新增 `TRUST_PROXY=off`；实际 `.env` 与 `.env.*` 忽略，模板保留跟踪。dotenv 从当前工作目录读 `.env`，不会自动读 `.env.production`；生产推荐平台环境变量。AI Key 只在后端，数据库 TLS 按提供商要求核对
- Express 应用显式读取可信代理设置，仅支持 off、loopback 或已核对的 IP/CIDR 列表，拒绝 true/纯跳数/全网 /0。必须另行阻止绕过网关、核对转发头；loopback 不会自动改变服务监听地址。内存限流与广播仍是单实例 MVP，不是全局限流
- HTTP 仅向配置的前端源给出 CORS 许可；Bearer 不使用跨站 Cookie，预检允许 Authorization/Content-Type、向浏览器暴露 Retry-After。无 Origin 或其他来源仍由 JWT/角色/组织独立鉴权，CORS 不能阻止 CLI 请求。[CORS 原理](https://expressjs.com/en/resources/middleware/cors/)
- `tests/config.test.ts` 新增 6 项配置/真实本地 HTTP 回归（包含 IP 限流探针），既有 JWT 生产测试补 HTTPS 来源；完整 130 项、typecheck/build 通过，无真实数据库或模型请求
- Pages 只托管前端；独立 Node HTTPS 后端须支持 `/api`、SSE 无缓冲/不缓存/足够超时以及 `/socket.io` polling/Upgrade，平台/费用/数据库方案与实际上线另确认。外层 `Cloudflare部署指南.md` 已更新；本刀不宣称生产代理、数据库 TLS 或微信已验收

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
  "service": "LiangmuTrace API",
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
npm run prisma:studio
```

`prisma:seed` 仅用于明确需要的开发数据初始化，不是常规校验；会按固定主键 upsert，可能覆盖现有开发记录。`migrate reset` 会清空数据库并重建结构，不能当作修复普通错误的命令。本次 AI 表接入只部署安全增量迁移，未执行 seed/reset。

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

## 匿名公开溯源接口（第二十二刀本地完成）

`GET /api/public/trace/:traceCode` 不要求 JWT，也不因无效 JWT 拒绝公开查询。只接受完整溯源码，无额外查询参数；返回 `{ batch }`。后端与前端类型/数据源/Query、独立 `/public/trace/:traceCode` 页面及二维码分享链接已本地接入；公开页绕开登录恢复/私有 AI/实时订阅，既有完整详情/AI 仍要求登录并按权限检查。第二组只修前端与测试/记录，后端重新通过 typecheck/120 项测试/build，没有数据库写入。

- 批次必须审核通过、种植组织启用且为种植机构；未知、未审、驳回、种植组织停用统一 404，不泄露具体拒绝原因
- 白名单：药材/批次号/溯源码、类别、省市区县、机构名称、种植日期、阶段/风险标记和登记/更新时间。没有地块地址、内部 ID、账号/姓名、自由文本、附件、审核意见或 AI 记录；白名单中的名称仍需人工审核，非自动个人信息检测或质量认证
- 节点仅建档/阶段变更/质检/仓储/运输，且 visibleRoles 为空。仅返回类型/时间/受控阶段，最多最近 100 条，`eventsTruncated` 表示截断；不返回原始标题/备注/操作人/payload
- 查询使用最小 select、同一只读数据库快照，service 再次核验公开资格；所有响应 no-store。每连接 IP 每分钟 60 次内存限流，429 带 Retry-After；多实例共享限流与可信代理部署另行配置，不能信任任意 X-Forwarded-For
- 没有匿名列表、AI 或写接口；已发送的公开内容不可撤回，客户端缓存策略不能代替服务器审核状态检查。静态 demo 原始 JSON 可下载，本地筛选不是服务端安全隔离
- 本机真实只读查询 `YM-TRACE-2026-0001` 返回 200/no-store/3 个公开节点；浏览器进一步验证输码/旧链接、统一 404/非法输入、登录回跳与 375px 窄屏。后端 120 项测试、typecheck/build 通过；没有数据库结构/数据写入或 AI 调用，公网/微信/摄像头真机未验收

## 批次接口

本节 `/api/batches` 接口均要求 `Authorization: Bearer <accessToken>`，并设置 `Cache-Control: no-store`；上面的独立公开接口不是完整详情的免鉴权版本。

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
- `GET /api/batches/dispatch-recipients`：仅管理员读取启用且至少有一名有效采购账号的采购组织 ID/名称，不接受额外 query；固定路径在 `/:identifier` 前注册
- `POST /api/batches/:identifier/shipping/dispatch`：仅管理员提交 `{ buyerOrganizationId }`，事务内重新校验目标组织，把未分配、审核通过的仓储批次推进为 `shipped` 并保存收货组织/事件；拒绝额外身份/阶段字段
- `POST /api/batches/:identifier/receipt/confirm`：请求体为空；仅指定采购组织可将审核通过的已出库批次推进为 `sold`，组织与操作人均由登录身份生成。不存在/非所属/历史未分配统一 404，重复或版本竞争 409

请求体使用 Zod 严格校验，不接受客户端伪造当前账号组织、创建人、事件操作人和初始审核状态等可信字段。出库的目标采购组织属于业务选择，并非当前账号身份，仍须服务端核验；加工与收货使用登录身份绑定组织。出库/收货使用数据库事务及 `version + 当前阶段 + 审核状态 + 收货组织` 条件更新，避免重复请求或并发覆盖；收货更新同时要求组织启用且类型为 buyer。业务日期按 `Asia/Shanghai` 判断。

第二十三刀已新增可空的 `buyerOrganizationId`/关联与索引，第五条迁移 `20261008090000_batch_buyer_organization` 已应用到本机 localhost:5432/liangmu_medicine；没有回填历史批次、修改 seed 或运行 reset。采购商仍浏览全部已审核批次，但只有所属收货组织可以收货。列表/详情增加派生 `canConfirmReceipt`，收货组织 ID/名称只返回给管理员或所属采购商，非所属采购商/其他角色置 null；匿名白名单不增加采购组织字段。这是组织归属，不是订单、合同、支付或个人指定收货人。

后端 typecheck、124 项测试和 build 通过；显式 `npx tsx tests/batchReceipt.database-smoke.ts` 在本机随机创建 6 个组织、5 个用户、2 个批次，验证有效/停用/无有效账号候选、跨组织/旧未分配拒绝、并发出库/收货及事件数量；finally 按精确 ID 清理，既有批次阶段/版本/收货字段未改变。未调用 AI。新 Prisma Client 已生成，开发服务须重启以确保加载新模型。2026-10-09 两组前端均接入，当时 127 项前端与 124 项后端测试、类型/lint/两种前端构建及后端 build 通过；管理员选择组织出库、采购商能力按钮及提交、换身份保护、同步防重和缓存刷新均已连接新契约。浏览器另用 4 个临时组织/3 个账号/2 个批次完成真实出库、非所属仅浏览、所属收货/刷新和旧未分配无按钮验收，核对版本与事件后按精确 ID 清理及级联清理；不修改 seed/真实业务记录，无新迁移、reset 或 AI 调用。当时静态弹窗/提示的主题上下文警告由第二十四刀处理，不代表公网/微信真机完成。

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
- 在 `src/knowledge/herbs.ts` 人工整理五味药材的 10 个非临床背景摘要（v2 增加黄精），链接到香港浸会大学中药材图像数据库的公开可检索记录；核对日期不是原文发布时间，不是完整药典或全量爬虫
- 中文双字片段/英文词 + BM25 词法检索与小量扩展，最多 6 个相关片段；没有依据则直接资料不足。Embedding/pgvector 后置，无新 Key、依赖、表或 migration。评分参数参考 [Elasticsearch BM25](https://www.elastic.co/docs/reference/elasticsearch/index-settings/similarity)
- 批次事实来自权限裁剪后的 detail，排除 AI 审核建议、操作人和完整 payload；当前只查看基础字段及最近 20 条可见事件的有限文字摘要
- 模型仍使用既有 DeepSeek 原生 fetch 代理，一次 JSON 生成；Zod 校验结构，引用 ID 必须来自本轮召回且与正文对应，URL 由服务端映射，不由模型提供。检查引用存在不能证明内容完全受来源支持
- 55 秒超时、断线取消、每用户 10 次/分钟、单进程内每用户一次运行保护；返回前重新检查批次访问/版本与账号角色/组织变化。不是多实例共享队列或持久化任务
- 医疗关键词拒答和提示词隔离仅为 MVP 防护，不宣称完全解决医学安全、提示词注入或幻觉；不提供诊断、剂量、处方或治疗建议
- 62 项后端自动化使用内存批次/Mock 模型；另完成真实 DeepSeek + PostgreSQL + HTTP 验收，使用现有已审核黄芪批次，不创建测试用户/批次，不执行 migration/seed。登记产地与通用背景回答各调用一次模型，医疗及无依据问题不调用模型，批次/事件/审核记录前后指纹一致
- 前端 Hook/共用组件已接入详情与快速预览；本地浏览器采用 Mock 模型 + 真实 PostgreSQL 验收停止、失败、手动重试、来源展示与弹窗卸载，后端观察到两次取消。临时服务、脚本和标签已关闭/清理；不是生产环境或摄像头/微信真机扫码验收

新增错误码：`AI_QUESTION_RUNNING`（409）、`AI_QUESTION_STALE`（409）；AI 代理和取消错误沿用既有约定。问答与风险分析使用独立限流计数，两者不自动重试。

## 持久化通知与 Socket.IO（第十四刀底座，第十九刀扩面）

- `GET /api/notifications?page=1&pageSize=10&status=all` 返回 `{ items, total, unreadCount, page, pageSize }`；status 可为 all/unread/read，未读计数始终针对本人全部通知。用户 ID 来自登录身份，不接受 recipientId。未知查询字段返回 400
- `PATCH /api/notifications/:id/read` 接受空对象，返回 `{ item }`；四角色都只能标记本人消息，未知或其他收件人的 ID 统一返回 404。条件更新确保并发/重复点击不覆盖首次 readAt；通知内部 metadata/recipientId 不进入 DTO。通知路由响应设置 `Cache-Control: no-store`，避免私人数据被 HTTP 缓存保存
- 建档、首条事件与有效管理员的 batchSubmitted 通知在同一事务中写入；审核结果写给批次所属种植组织，审核通过的采收完成批次写给所有可接单有效加工商，加工完成进入仓储写给有效管理员
- 审核、采收、加工入库的批次状态/审核记录/事件和通知均在同一事务提交；允许先采收后审核，因此审核通过已采收批次时也会补发加工接收通知。事务完成后才发布提示，没有有效收件人时不创建空消息
- Express 与 Socket.IO 共用 HTTP Server；客户端使用 `/socket.io`，handshake.auth 仅接受 `{ token }`，JWT 验证与数据库 currentUser 检查独立于前端路由。服务端决定用户房间，不开放任意 join 指令；Origin 限定 CLIENT_ORIGIN，无 Origin 的 CLI 也必须有合法 JWT
- `notifications:changed` 只提醒前端缓存失效，不携带通知正文。JWT 到期主动断开；长连接每 30 秒检查账号、组织与角色变化，变化时发送 session:invalid 并断开（不是每帧实时检查）。每个 REST 请求仍独立认证
- 服务为单实例内存广播，没有 Redis adapter、outbox、持久化事件重放或必达保证。提示失败不撤销已提交业务；前端必须在连接/重连时查询 PostgreSQL 补齐，消息表是唯一持久化来源。参考 [Socket.IO 交付保证](https://socket.io/docs/v4/delivery-guarantees/)
- 第十九刀新增 2 项事务/收件人回归并将 HTTP、Socket 测试扩展到非管理员，当时后端共 103 项通过；覆盖提交后推送、本人房间、Origin、断线补查、JWT 到期、账号停用及角色/组织变化
- 真实 PostgreSQL 烟测生成一条随机批次，审核、采收、加工入库分别命中 1 名种植商、2 名加工商和 2 名管理员；临时批次、事件、审核与通知均已精确清理，没有执行 seed/migration/reset
- 前端数据源、Query Hook、App 全局订阅、消息中心与铃铛已向四角色开放。本地浏览器验证加工商/采购商未读与通知列表、种植商空态及各角色返回路径；本次浏览器未模拟网络断线，不将集成测试结论冒充浏览器结论
- 人工聊天已在第二十刀独立接入；质检/出库/收货通知、采购商关注关系、生产代理/部署仍未实现或未验证。pg 弃用提示仍为工程化待办

## 人工聊天 REST 与实时提示（第二十刀）

| 接口 | 请求与用途 |
| --- | --- |
| `GET /api/chat/contacts?search=账号或姓名或组织` | 当前可联系账号，最多 30 条及 hasMore |
| `GET /api/chat/conversations` | 当前可访问的本人最近 100 个会话、预览、未读数及 hasMore |
| `POST /api/chat/conversations` | `{ recipientId }`，服务端检查联系人并创建/复用双方私聊 |
| `GET /api/chat/conversations/:id/messages?before=sequence` | 默认最新 40 条，升序返回，nextBefore 用于加载更早历史 |
| `POST /api/chat/conversations/:id/messages` | `{ clientMessageId: UUID, content }`，最多 2000 字符纯文本 |
| `PATCH /api/chat/conversations/:id/read` | `{ sequence }`，只推进本人的已读游标，不超过现有位置 |

- 所有请求独立认证、严格 Zod 校验与 no-store；不接受客户端发送人、组织、角色、sequence 或成员列表。未知与越权联系人/会话统一 404，UUID 复用改原文返回 409，非法已读位置 400
- `chatContactWhere` 查询有效账号与有效匹配组织：buyer 仅 admin；admin 可联系四角色；grower/processor 可联系同组织、admin 和已绑定批次合作组织。管理员也不能读取未参与的私聊；协作撤销后列表/历史/发送/已读均失去访问权
- 新增 `ChatConversation` / `ChatParticipant` / `ChatMessage`，不用 Notification 或 Assistant 表冒充人工聊天。双方排序 pairKey 唯一，senderId/clientMessageId 唯一，conversationId/sequence 唯一；发送在事务中原子递增会话序号，失败回滚。并发 UUID 唯一冲突后读取已提交结果，不重复保存
- 消息提交后只向双方 JWT 用户房间发布无正文的 `chat:changed`，与通知共用一个 Socket.IO Server。已读提示仅给本人；readSequence 条件更新保证只能前进，未读只统计另一人发送的消息
- 会话创建/消息发送共享单账号每分钟 30 次限流；没有多实例共享限流、Redis adapter/outbox、必达提示、群聊、附件、在线状态、撤回或客服排班。REST 是恢复记录的依据；前端重连/聚焦补查并对可见页面每 20 秒轮询兜底
- `20261007090000_human_chat/migration.sql` 已在本机 liangmu_medicine 应用，仅新增表/索引/外键；第二十刀当时四条迁移全部应用，第二十三刀后为五条。生成新 Prisma Client 后需重启后端加载，热重载未必因生成目录变化自动发生
- 新增 10 项自动化测试（不接真实数据库/AI）；显式 `npx tsx tests/chat.database-smoke.ts` 使用随机临时组织/用户/批次/会话验证实际 SQL 权限、并发、44 条分页、恢复和撤权。仅允许本机非生产数据库，finally 精确清理，不能用作 seed。加 `--browser` 暂留临时账号供页面验收，Enter 或 10 分钟后清理
- 本轮真实数据库与临时采购商/管理员双账号浏览器验收通过，临时记录已清理，未改原有业务数据；浏览器未模拟断网，375px 设置也未生效，不将服务测试或 CSS 样式写成真机验证结论

## 普通聊天兼容接口（第十五刀基线，当前页面使用下方持久化端点）

- `POST /api/assistant/chat` 请求 `{ question: string }`，去首尾空格后 2～500 字符，严格拒绝额外字段；四角色均需 Bearer 认证。响应 `{ reply: { id, scope: 'general', batchId: null, question, status, answer, citations: [], mode: 'api', modelName, createdAt } }`
- 只把系统说明与本轮问题交给 DeepSeek，要求 JSON 输出并用 Zod 校验，拒绝工具调用与额外生成字段。没有数据库读工具、检索、历史或医学能力，不冒充批次事实问答；医疗关键词拒答不产生模型费用，其他普通回复无 RAG 来源
- 接口每用户每分钟 10 次（普通聊天与旧批次问答分别计数）、该服务单用户同时一轮、55 秒超时，客户端断开向上游传递取消；取消不保证退还已产生费用。服务为单实例，限流/并发保护没有多实例共享
- `Cache-Control: no-store`；返回前重新读取当前用户，账号/组织停用或角色/组织变化不能返回旧身份结果。批次权限由原问答服务独立检查
- DeepSeek 请求层只在非 JSON 且确实传入 tools 时发送 tool_choice=required；普通无工具请求不再被强制工具调用，保留原 Agent/JSON 参数
- 第十五刀新增 9 项 Mock/HTTP/客户端参数测试，手敲验收补 1 项当时黄精未收录/无召回测试，验收基线为 80 项，通过 typecheck/test/build；自动化没有修改数据库或调用付费模型。另在用户运行的本地服务上以现有采购商验证普通“你好”、甘草背景和黄精登记产地的模型回复，当时黄精基础介绍无召回直接资料不足；第十六刀补黄精后将无召回 fixture 改为未收录药材，保留拒答覆盖
- 全局前端已接入，本地浏览器验证跨页面/批次展示历史、折叠依据、资料不足标识和登录清理。延迟取消由 Mock 回归覆盖；真实模型回复快于停止操作，本轮不宣称已在浏览器停止上游或验证卸载中的请求
- 第十五刀不建会话表、不保存历史、不支持真正多轮或根据文字中的批次号读取资料。客户端有标签时继续使用旧 `/batches/:identifier/questions`，不能把两个接口拼接称为已完成跨批次 Agent

## 本人持久化会话（第十六刀：本地接入与真实验收完成）

- `GET /api/assistant/conversation` 不接受查询字段，账号从 JWT/数据库身份派生，返回 `{ conversationId, mode: 'api', turns }`；按 sequence 返回最近 40 轮，每轮含 id（请求 UUID）、question、batch 标签、status、createdAt，完成轮带 reply，失败轮带安全 error。
- `POST /api/assistant/conversation/messages` 严格接收 `{ requestId: UUID, question: string, batchIdentifier?: string | null }`，返回 `{ turn }`；不接收客户端历史、角色、组织或检索资料。新端点与旧 `/chat` 共用每用户每分钟 10 次的内存限流，历史读取不调用模型；旧批次问答另计数。
- 新增 AssistantConversation（userId 唯一）与 AssistantTurn（会话/请求 UUID、会话/sequence 唯一）模型。事务通过 version 条件更新占用 65 秒租约；finish 同时核对账号、版本、请求与租约，旧结果不能覆盖后来请求。同请求返回已有记录，重用 UUID 改问题返回 409；失败/取消留痕，不自动再次执行模型。过期 pending 显示 stopped，下次新请求接管时标记中断。
- 新端点服务端最多取 4 轮/8 条相关历史，问题最多 500 字符，历史回答截取 1000 字符；普通聊天只取普通历史，批次追问只取同批次、同 version、同角色/组织记录。短追问用上一问补词法主题，事实与引用始终来自本轮按权限读取的 sources，旧回答不当知识库或事实。
- 普通问候/系统使用问题不强制 RAG；普通“刚才……”追问可沿用最近成功普通会话，但明确药材/批次主题仍走资料问答。问题中的 YM 批次号/溯源码优先于标签，经 detail 同一权限检查。多个编号、无编号或药材不匹配先澄清。规则分流不是通用意图识别；不做跨批次对比、模型写入工具或向量检索。
- 历史助手输出按当前 JSON 协议序列化，避免多轮模型仿照旧格式输出空白/缺字段；历史作为不可信对话，RAG 本轮引用只认可本轮 sources。召回前剔除定位编号/插入前缀，知识命中后补最小批次身份；“来源”与产地使用词法别名，不以通用产区替代具体批次产地。
- 读取/重放历史再次核对角色/组织和批次权限，删除/不可访问批次的原问题、答案、标签及来源全部隐藏。新会话 reply 只包含引用标题/发布者/链接，不包含检索 excerpt；生成期间身份/版本变化不能保存成功答案。医疗边界与注入隔离仍是 MVP 防护，不宣称完全安全。
- 新增错误：ASSISTANT_STORAGE_NOT_READY（503）、AI_REQUEST_CONFLICT/AI_REQUEST_STALE（409）；旧运行/版本冲突、取消/超时错误沿用。退出不删除数据库消息；历史撤权在重新读取时生效，不提供实时擦除已经显示的消息。旧兼容接口并发保护仍为单进程，限流没有共享 Redis。
- 第十六刀底座新增 13 项会话/HTTP/Store 条件断言与 1 项小型词法召回评测，验收再补普通追问、编号/前缀召回 2 项，后端共 96 项通过；schema validate/generate、typecheck/test/build 通过。自动化 Mock 与实际模型/数据库验收分开，不报告生产答案正确率。
- **第十六刀迁移已应用**：`prisma/migrations/20261006000100_assistant_conversations/migration.sql` 仅新增 AI 聊天 enum/两表/索引/外键，当时 `migrate deploy` 后三条迁移均已应用；该迁移不是人工聊天室，也不搬迁旧浏览器内存消息。当时未运行 reset、db push 或 seed；第二十刀后四条，第二十三刀收货组织迁移后共五条。
- 真实 PostgreSQL + HTTP + DeepSeek 验证普通两轮记忆、黄精编号覆盖旧标签、受限 RAG、新服务实例恢复与账号隔离；重复请求不再次调用模型。两个独立 Store 的真实数据库 CAS/租约竞争与过期结果保护通过。浏览器验证刷新/重登恢复、账号隔离、黄精来源/引用及停止；停止记录落库并释放租约，取消不能保证退款。
- 烟测仅建立两名随机标记临时用户、一组织及 AI 会话，结束精确清理，原批次/事件/审核/附件指纹未改变；临时脚本已删除。未修改 .env/Key，未 commit/push/部署；开发 JWT_SECRET 缺失时重启仍需重登，但已保存的数据库历史不会因此删除。

## 管理员数据概览（第十七刀本地完成）

`GET /api/dashboard/overview`：只允许已认证有效管理员，不接受查询参数。返回 mode/generatedAt/summary/stageDistribution/categoryDistribution/recentBatches/pendingBatches，响应 `Cache-Control: no-store`。

- 管理员范围与批次列表一致，统计全部批次，不从前端分页列表估算。按阶段/类别/审核/风险分组，汇总总数、待审、风险（低/中/高）、仓储；分布包含零值，仓储与审核互不替代
- Prisma 聚合、最近更新（最多 6 条）、待审（最多 5 条）在同一 RepeatableRead 快照中执行；列表按 updatedAt 倒序、id 稳定排序，只返回必要字段，时间为带时区 ISO 字符串。无事件/附件/审核理由或 AI 内部数据，不执行写入
- 新增 5 项回归，当前后端共 101 项通过；真实 PostgreSQL + HTTP 只读验收与独立 count 一致，原批次 id/version/updatedAt 不变。没有创建账号/批次或执行 migration/seed/reset，没有调用 AI，临时服务/脚本已清理
- 前端类型/契约/数据源、身份隔离 Query Hook 与真实页面已接入；8 项前端回归与本地浏览器验证通过。统计不是实时流，现有 mutation 前缀失效、窗口回到前台和手动刷新可更新。图表表示当前分布，不提供交易金额、合格率、趋势、风险简报或抽检任务

## 下一阶段

前端开发模式通过 Vite 将 `/api` 和 `/socket.io`（启用实时连接代理）转发到本服务；生产构建默认使用独立的 demo 认证，不要求静态托管平台运行本服务。环境切换与请求层说明见根目录 README。

1. 第十六刀全局前端、迁移及真实受限多轮/编号/取消已本地验收；继续补演示问题/资料覆盖与关键回归，不冒充无限记忆、全量采集或生产答案正确率
2. 数据库后续安全增量 migration 按用户新授权，在说明并检查 SQL 后执行；seed 是初始化数据，不是每轮检查，reset 具有破坏性，不在常规授权内
3. 真实看板、真实资料/导航、核心通知与第二十刀人工聊天均已本地接入；继续保持内部协作/平台客服权限回归，关注与剩余通知按演示价值后置
4. 第一版不开发订单、模拟/真实支付；第二十三刀收货组织归属前后端与本机浏览器闭环已完成，不冒充订单/支付履约。真实文件存储后置
5. 第二十一刀完成前端首轮路由/图表拆包和资源失败兜底，API 模式构建已通过本机预览代理连接此服务验证真实看板、通知、人工聊天与资料；没有修改后端运行代码、schema、数据库迁移或调用 AI。本轮重新通过后端 typecheck、113 项测试与 build
6. 第二十二至二十四刀匿名溯源、收货归属及前端核心收尾已本地完成；第二十五刀补生产配置与 CORS/可信代理，当前前端 135 项、后端 130 项及类型/lint/构建/预算通过，未操作数据库或真实模型。下一步确认平台/费用和数据库公网方案，实际上线另授权；生产 SSE 缓冲/超时/断线取消、Socket 代理及微信/摄像头/真机仍未验收。Vite preview 的本地代理不是生产反向代理
