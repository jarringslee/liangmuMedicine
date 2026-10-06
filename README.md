# 良木药谷 liangmuMedicine

良木药谷是使用 React、TypeScript、Node.js 和 PostgreSQL 构建的中药材全链路智能溯源平台。项目围绕种植商、加工商、平台管理员和采购商四类角色，展示药材从建档、审核、种植、采收、加工、质检到下游溯源的协作流程。

项目面向前端与 AI 应用开发岗位作品集。目前已经完成四端前端基础闭环、PostgreSQL V2 核心模型、业务 seed、前后端真实登录/JWT 鉴权，以及“种植商建档 → 管理员审核 → 种植日志 → 采收 → 加工商认领 → 加工/质检 → 仓储 → 管理员出库 → 采购商收货”的真实业务链路；React 通过 TanStack Query 接入 API，同时保留静态 demo 数据源。AI 风险审核 Agent 已接入真实 DeepSeek，并形成建议、人工复核与审计闭环；第十三刀单轮 BM25 RAG 问答已完成多入口页面接入、真实模型/数据库 HTTP 链路与本地浏览器验收。第十四刀 PostgreSQL 持久化通知、Socket.IO 订阅、消息中心与铃铛已完成本地浏览器验收；聊天室及真实后端公网部署尚未完成。

## 在线演示

- Cloudflare Pages：<https://liangmumedicine.pages.dev>
- 当前线上版本是静态前端演示，数据来自内置 JSON 与当前浏览器的 localStorage，不与本机 PostgreSQL 互通。

## 核心业务链路

```text
种植商创建批次
  → 管理员审核
  → 种植商记录种植日志和采收信息
  → 加工商接收、加工、记录质检摘要并完成入库
  → 管理员确认出库
  → 采购商确认收货
```

采购商可在有权查看时通过药材列表、扫码或溯源码查询进入溯源详情；这些访问入口独立于上面的阶段流转。demo 模式的跨角色变化由同一浏览器的本地覆盖层模拟；API 模式已通过 Express 与 PostgreSQL 实现从建档到收货的跨账号业务流转。

### 溯源与智能问答的入口

药材列表点击、二维码扫描和溯源码查询是并列的批次访问入口，扫码不是查看溯源信息的前提。扫码保留连接实体药材与线上批次、快速定位批次的价值；列表则支持日常浏览、搜索后直接查看详情。

第十三刀 RAG 问答已在批次详情页与快速预览中提供「问问 AI」，复用组件与问答服务，基于所选批次提问，不要求用户先扫码。两个入口的输入和回答状态独立，可见信息和可用操作由身份与权限决定，不由进入方式决定；当前详情需要登录，匿名脱敏访问仍属后续计划。本地页面与真实模型 HTTP 链路均已验收，摄像头/微信真机扫码另行验证。

## 已实现功能

### 登录与前端请求

- 开发环境通过 API 登录；生产默认保留明确标识的静态演示模式，两者不会自动降级切换
- 统一 Fetch 请求层：Bearer Token、JSON、普通请求 15 秒/AI 分析 70 秒超时、主动取消、结构化错误
- 刷新时调用 `/auth/me` 恢复身份，验证期间展示加载态；网络失败保留凭证并允许重试
- 响应式路由守卫、越权页面、登录后站内回跳、提交防重复
- 401 或账号禁用时退出；普通业务 403 不清除登录态
- 退出/切账号清除 Query 和 mutation 缓存，丢弃旧身份迟到的响应

### 管理员端

- 数据概览与 ECharts 看板
- 药材批次列表、搜索和筛选
- 新建药材批次（旧 demo 入口；真实 API 建档由种植商执行，管理员负责审核）
- 批次审核通过与驳回
- AI 风险审核抽屉：SSE 阶段过程、停止/手动重试、分析建议、证据引用、工具记录与人工复核
- 对审核通过的仓储批次确认出库
- 真实消息中心和顶部消息提醒：建档通知实时刷新，本人通知分页/筛选、未读数和持久化已读
- 批次详情与溯源时间线

### 采购商端

- 已审核药材批次浏览，点击列表中的药材可直接进入溯源详情
- 二维码扫描与溯源码查询
- 溯源快速预览和详情查看
- 按采购商角色精简敏感字段
- 对已出库批次确认收货，完成本次流转

### 种植商端

- 种植商工作台
- 按所属种植组织查看批次
- 新建待审核批次
- 种植日志记录
- 采收登记与阶段流转

### 加工商端

- 加工商工作台与可处理批次列表
- 认领审核通过的未分配批次，绑定当前加工组织：`harvested → processing`
- 完成加工并写入加工记录：`processing → warehousing`
- API 模式保存质检文字摘要；demo 模式支持图片或 PDF 本地演示上传
- demo 模式入库后生成管理员系统通知

### 后端与数据库地基

- Express + TypeScript 服务骨架
- `GET /api/health` 服务与 PostgreSQL 真实健康检查
- Prisma V2 多租户核心模型与两条 migration
- 组织、用户、批次、事件、审核、附件和业务通知表结构
- Prisma PostgreSQL Driver Adapter 与共享数据库客户端
- 12 个组织、8 个账号、15 个批次及关联业务记录的可重复 seed
- `POST /api/auth/login`、`GET /api/auth/me`：真实账号登录与当前用户查询
- 一小时 JWT Access Token、账号/组织状态检查、RBAC 角色守卫和登录限流
- `GET /api/batches`：分页、搜索、阶段/审核/风险筛选及四角色数据范围
- `GET /api/batches/:identifier`：按数据库 ID 或溯源码读取详情，包含角色可见的事件、审核与附件
- 批次建档、审核、日志、采收、加工认领、加工完成、质检摘要、确认出库与确认收货写接口
- 70 项鉴权、批次、AI 风险分析、资料问答与通知自动化测试（内存数据/模拟模型，不修改 PostgreSQL、不消耗 AI 费用）

### AI 风险审核助手

- 后端已实现 DeepSeek 代理、两个只读工具、结构化 JSON 校验、证据引用 ID 检查、频率/轮数/超时限制
- 分析建议作为管理员可见的事件保存；人工复核关联分析记录，使用批次版本检查防止采纳过期建议
- 当前仅检查项目资料完整性与一致性；没有药典限值库、文件解析或药物安全检测能力
- 管理员列表提供 AI 审核抽屉，支持读取/重新分析、建议填表与人工结论提交；通过统一数据源与 TanStack Query 管理请求和缓存
- 真实 DeepSeek + PostgreSQL + HTTP 链路已验证；在 `server/.env` 配置 `DEEPSEEK_API_KEY` 后重启后端，默认模型为可配置的 `deepseek-flash`
- 页面通过 SSE 展示实际业务阶段与工具开始/完成事件，支持停止和手动重试；不会由 AI 自动通过或驳回。模型仍返回完整 JSON，不是逐 token 输出或思维链
- 真实 DeepSeek/数据库 SSE 烟测与本地浏览器交互验收均已完成；浏览器轮次使用 Mock 模型 + 真实 PostgreSQL，覆盖停止、失败、重试、人工审核与刷新后过期保护，不代表生产代理已验收
- 断流或停止后重新读取最近保存的建议，不自动重复调用模型；停止不会撤销已提交的事务，也不保证退还上游费用
- 静态 demo 的辅助模块使用明确标识的本地规则，不能称为真实模型分析

### 单轮 RAG 资料问答

- 后端 `POST /api/batches/:identifier/questions` 仅接收问题；服务端按当前身份重新读取批次，问答入口不影响权限
- 首期采用 BM25 词法检索，中文双字片段/英文词、少量词法扩展、最多 6 个相关片段；不是语义 Embedding 或向量数据库实现
- 丹参、黄芪、当归、甘草的 8 个人工知识摘要来自香港浸会大学中药材图像数据库的公开可检索记录，保留来源链接与核对日期；只整理非临床背景，不抓取全文或图片，也不能替代现行药典
- 模型基于召回片段生成 JSON；服务端验证引用 ID 并映射真实来源链接，区分通用知识与批次事实。没有召回依据或超出医疗边界时明确不回答；引用存在不等于已验证答案正确率
- 复用现有 DeepSeek 配置，不增加 Key/依赖/数据库表；55 秒后端超时、前端 70 秒、取消、限流、版本变化保护，不自动重试
- 静态 demo 只提供本地档案摘录，不能称为 AI 或 RAG；不保存会话、不支持多轮记忆或逐字输出
- `useHerbQuestion` 与共用组件已接入详情/快速预览，支持受控输入、示例问题、回答/来源、停止、错误保留输入和手动重试；批次 key 改变或弹窗关闭会卸载并取消请求。药材列表进入详情与扫码/输码后的预览均可使用，不依赖扫码标记
- 真实 DeepSeek + PostgreSQL + HTTP 验收通过：已审核黄芪批次的登记产地与通用来源/产区能够明确区分并引用依据；拒答无需模型调用，问答前后批次及事件/审核记录没有变化
- 本地浏览器使用 Mock 模型 + 真实 PostgreSQL 验收列表详情与输码快速预览，并验证停止、失败、重试、来源和关闭取消；不代表已验收微信/摄像头真机扫码或生产部署

### 业务通知与实时刷新

- 种植商建档、首条事件与有效管理员通知在同一数据库事务提交；事务完成后发送变化提示，不向客户端直接推送通知正文
- Socket.IO 与 Express 共用 HTTP Server，JWT 与数据库身份检查后加入服务端决定的用户房间；管理员只能查询和标记本人的通知
- `useNotificationRealtime` 在 App 全局桥接中只建立一个订阅；消息中心与铃铛复用 `useNotifications`，通过按模式/用户/分页隔离的 Query 缓存读取数据
- 消息中心支持全部/未读/已读、服务端分页、手动刷新、批次链接与标记已读；铃铛显示最近 5 条及全量未读数，时间明确按 Asia/Shanghai 展示
- 连接/重连和通知提示触发重新查询 PostgreSQL；不把 Socket 提示当作可靠消息队列，没有客户端发送队列或事件重放
- 本地浏览器已验收种植商建档后管理员无需刷新即见通知、未读变化、已读筛选与刷新持久化、链接、铃铛和角色拦截；临时批次及关联通知已清理
- 静态 demo 保留明确标识的系统通知与本地已读覆盖；旧模拟邮件/聊天不计入功能。当前只有建档产生新持久化通知，聊天室与其他阶段通知后置

## 技术栈

### 前端

- React 19 + TypeScript
- Vite
- Ant Design + Less
- React Router
- TanStack Query
- ECharts
- html5-qrcode + qrcode.react
- socket.io-client

### 后端与数据

- Node.js + Express + TypeScript
- PostgreSQL
- Prisma + `@prisma/adapter-pg` + `pg`
- bcryptjs
- jose（JWT）+ express-rate-limit（登录限流）
- Zod
- Socket.IO

### 部署

- Cloudflare Pages：前端静态站点
- GitHub：代码托管与自动部署触发

## 当前数据架构

```text
React 页面
  → TanStack Query hooks
  → herbDataSource.ts（按 VITE_AUTH_MODE 切换）
      ├─ api：services/api.ts → Express → Prisma → PostgreSQL
      └─ demo：herbStorage.ts → JSON 样例 + localStorage 覆盖层
```

API 模式下，批次列表、列表点击详情、扫码/输码查询和直接溯源链接均读取 PostgreSQL。列表接口只返回摘要，依赖事件链的页面再按需查询详情。种植商可建档、记录日志和登记采收，管理员可审核并确认出库，加工商可从共享待认领池接收批次、完成加工并记录质检摘要，采购商可确认收货。组织、操作人、阶段规则与并发版本均由服务端身份与当前数据库状态决定。

## 项目目录

```text
liangmuMedicine/
├─ public/                 # 静态资源、药材图片和 JSON 样例数据
├─ src/
│  ├─ components/         # 公共组件、扫码与溯源组件
│  ├─ hooks/              # TanStack Query 数据 hooks
│  ├─ mock/               # 账号、看板、消息等演示数据
│  ├─ pages/              # admin、buyer、grower、processor 页面
│  ├─ config/             # API 地址与认证模式
│  ├─ services/           # 请求层、认证状态、本地数据访问与 QueryClient
│  ├─ types/              # 认证与药材业务类型
│  └─ utils/              # 鉴权、溯源码和业务辅助函数
├─ server/
│  ├─ prisma/             # Prisma schema、migrations 与 seed
│  └─ src/                # Express 应用、配置和路由
├─ tests/                  # 前端认证与请求层自动化测试
└─ README.md
```

## 本地运行

### 1. 启动前端

```powershell
npm install
npm run dev
```

默认地址：<http://localhost:5173>

开发默认使用真实 API，需另开终端启动后端。Vite 将 `/api` 和 `/socket.io`（含实时连接）代理到 `http://localhost:4000`；代理只在开发服务器生效。

认证模式配置：

| 文件 | 默认行为 |
| --- | --- |
| `.env.development` | `npm run dev` 使用 `VITE_AUTH_MODE=api` |
| `.env.production` | `npm run build` 使用 `VITE_AUTH_MODE=demo`，可静态部署 |
| `.env.example` | 本地覆盖模板，按需复制为不提交的 `.env.local` |

只体验前端时，在 `.env.local` 设置 `VITE_AUTH_MODE=demo` 后重启 Vite。该文件也会覆盖生产构建配置，构建前应检查它。正式接后端部署时需设置 `VITE_AUTH_MODE=api` 和 `VITE_API_BASE_URL`，并提供同源 `/api` 反向代理或正确的跨域配置；不能仅依赖开发代理。`VITE_*` 会进入浏览器构建产物，禁止填写数据库密码、JWT 密钥或 AI Key。

### 2. 准备 PostgreSQL

本地创建数据库：

```text
liangmu_medicine
```

复制后端环境变量模板：

```powershell
Copy-Item .\server\.env.example .\server\.env
```

在 `server/.env` 中填写本机数据库连接串。真实密码和 API Key 只能保存在 `.env`，不得提交到 Git。

### 3. 初始化并启动后端

```powershell
cd server
npm install
npm run prisma:validate
npm run prisma:generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

默认地址：<http://localhost:4000>

健康检查：<http://localhost:4000/api/health>

开发环境未配置 `JWT_SECRET` 时使用进程级随机密钥，重启后旧 Token 失效，需要重新登录。生产环境必须设置 `NODE_ENV=production` 和至少 32 字符的随机 `JWT_SECRET`。接口契约与错误码见 [后端 README](server/README.md)。

## 演示账号

以下账号同时存在于前端 Mock 与本地数据库 seed 中。API 模式由数据库校验（只保存 bcrypt 哈希）；demo 模式仅做本地演示校验，不能当作安全鉴权。API 失败不会回退到 Mock。

| 角色 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | `lijialin` | `lijialin123` |
| 采购商 | `chenjingxuan` | `chenjingxuan123` |
| 种植商 | `yuanyuhang` | `yuanyuhang123` |
| 加工商 | `haorunyuan` | `haorunyuan123` |

## 常用校验命令

前端：

```powershell
npm run lint
npm test
npm run build
```

前端测试使用现有 Vite 加载 TypeScript 模块与 Node.js 内置测试器，无新增测试依赖；38 项测试覆盖恢复、401/403、缓存、竞态、取消/超时、过期、存储不可用、回跳、四角色演示，以及风险分析统一数据源、70 秒独立超时、Hook 旧查询取消、本地建议保存、过期检查和人工复核。事件流测试还覆盖跨字节中文/CRLF、多行 data、终态检查、错误与断流、停止、切账号和超时；Hook 测试覆盖停止/失败后的结果恢复、不自动重跑、重试使用新控制器和 await 期间切账号保护。资料问答测试覆盖请求契约、安全来源链接、切账号丢弃结果、明确标识的 demo，以及 Hook 防重复提交、只读缓存不失效、停止/失败不自动重跑和手动重试新控制器。SSR Hook 测试不替代真实浏览器 Effect/交互验收。测试中的 MockTimers 会产生 Node 实验性 API 提示。

第十四刀新增 8 项通知回归后，当前前端测试共 46 项；上段 38 项是第十三刀基线。新增覆盖 DTO/demo、JWT 请求契约、取消/切账号迟到响应、mutation 只失效当前用户通知缓存且不自动重试，以及上海时区跨日显示。SSR Harness 使用测试专用认证快照 fixture，仅验证请求和缓存逻辑；真实订阅 Effect 与消息页面另经本地浏览器验收，不以 SSR 替代浏览器。

各测试文件分别使用 `node_modules/.vite-tests/` 下独立的 Vite 缓存目录，避免并行测试或本地开发服务器共享缓存导致 Windows 文件删除冲突；缓存位于被 Git 忽略的 `node_modules` 中。

后端：

```powershell
cd server
npm run typecheck
npm test
npm run build
npm run prisma:validate
npm run prisma:seed
```

## 下一阶段

1. 第十四刀本地验收完成；下一刀实现最小一对一聊天室，限定权限、持久化历史和实时收发，不扩展复杂 IM
2. 为 RAG 补充小型效果评测集；保持词法检索边界，按时间再决定语义向量化
3. 为关键批次数据适配和页面交互补充前端自动化测试，处理路由懒加载、首包体积及旧组件警告
4. 开放脱敏的匿名溯源页面，支持扫码或直接打开链接，不以扫码作为访问条件；真实文件存储按时间后置
5. 完成后端部署，验证反向代理不会缓冲 SSE，并验收微信/摄像头真机扫码

## 当前限制

### 第十四刀当前边界

后端新增 `GET /api/notifications` 和 `PATCH /api/notifications/:id/read`，只允许管理员查询/标记本人通知。种植商建档、首条事件和有效管理员通知在同一事务内提交，成功后通过 Socket.IO 用户房间发送变化提示。真实 PostgreSQL + HTTP + Socket 烟测已通过；本次临时批次及通知已精确清理，没有改动 seed。

Socket 提示不是消息本体，前端通过 TanStack Query 重新查询；连接/重连也触发获取。默认 Socket 事件不是可靠的持久化消息队列，详见 [Socket.IO 交付保证](https://socket.io/docs/v4/delivery-guarantees/)。当前是单实例服务，没有 Redis adapter/outbox/事件重放。

前端数据源/Hook、App 桥接、消息中心和铃铛已接入真实通知。本地浏览器已验证双端建档实时变化、读取与已读交互；本次浏览器未额外模拟网络断线，断线后 REST 补查及过期/停用断连由 Socket 集成测试覆盖，不扩大验收结论。本刀只为建档生成新通知，其他阶段通知、聊天室、生产反向代理和公网部署后置。

- 真实身份与从建档到收货的主链路、管理员消息中心已接入；看板统计/示例 AI 摘要、个人资料扩展字段仍包含演示数据，部分管理菜单或辅助表单没有真实 API，不应当作已完成模块演示。
- API 模式只在 sessionStorage 保存 Token，用户身份来自服务端；demo 使用独立存储键，不信任旧 Mock 登录记录。sessionStorage 不是防 XSS 的保险箱，部署仍需 HTTPS 与 XSS 防护。
- 退出清除的是认证信息和内存请求缓存，不删除用于跨角色演示的业务 localStorage；demo 的本地共享不是服务端组织隔离。API 模式另由后端执行角色与组织数据范围检查。
- localStorage 数据仅在同一站点、同一浏览器中共享。
- demo 模式图片以 base64 保存；API 模式尚未接对象存储，因此日志、采收和质检附件暂不可上传。
- PostgreSQL 已应用 V2 核心模型并导入 seed；读取、建档、日志、采收、审核、加工认领、加工完成、质检摘要、出库和收货均已调用真实 API。
- 当前“出库”只记录阶段和溯源事件，没有物流单、承运方或运输轨迹；“收货”也没有订单、合同、库存及采购商归属模型。MVP 仅做角色级权限控制，因此任一已登录采购商都可确认任一已出库批次，不能宣称已完成生产级交易履约或订单归属校验。
- 暂无 Refresh Token、服务端登出撤销与多实例共享限流；Token 一小时过期后重新登录。
- AI 审核助手已完成 SSE 页面接入、真实 DeepSeek/数据库 HTTP 验证与本地 Mock 模型浏览器交互验收，生产反向代理尚待验证。模型仍输出完整 JSON，SSE 报告业务阶段，不是逐字输出或思维链。审核只检查项目资料，没有外部药典、医学诊断或自动放行能力；单轮 BM25 RAG 已完成多入口页面及本地真实链路验收，但知识规模有限、未实现语义向量化，也没有生产级答案正确率/医学安全保证。实时通知当前只覆盖建档，不包括聊天室或所有业务阶段。
