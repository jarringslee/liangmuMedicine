# 良木药谷 liangmuMedicine

良木药谷是使用 React、TypeScript、Node.js 和 PostgreSQL 构建的中药材全链路智能溯源平台。项目围绕种植商、加工商、平台管理员和采购商四类角色，展示药材从建档、审核、种植、采收、加工、质检到下游溯源的协作流程。

项目面向前端与 AI 应用开发岗位作品集。目前已经完成四端前端基础闭环、PostgreSQL V2 核心模型、业务 seed、前后端真实登录/JWT 鉴权，以及“种植商建档 → 管理员审核 → 种植日志 → 采收 → 加工商认领 → 加工/质检 → 仓储 → 管理员出库 → 采购商收货”的真实业务链路；React 通过 TanStack Query 接入 API，同时保留静态 demo 数据源。AI 审核 Agent、RAG 与实时通知将在后续完成。

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

RAG 智能问答尚未实现。规划在批次详情页与扫码快速预览中提供「问问 AI」，共享批次上下文与问答能力，不要求用户先扫码。可见信息和可用操作由身份与权限决定，不由进入方式决定；当前详情需要登录，匿名脱敏访问仍属后续计划。

## 已实现功能

### 登录与前端请求

- 开发环境通过 API 登录；生产默认保留明确标识的静态演示模式，两者不会自动降级切换
- 统一 Fetch 请求层：Bearer Token、JSON、15 秒超时、主动取消、结构化错误
- 刷新时调用 `/auth/me` 恢复身份，验证期间展示加载态；网络失败保留凭证并允许重试
- 响应式路由守卫、越权页面、登录后站内回跳、提交防重复
- 401 或账号禁用时退出；普通业务 403 不清除登录态
- 退出/切账号清除 Query 和 mutation 缓存，丢弃旧身份迟到的响应

### 管理员端

- 数据概览与 ECharts 看板
- 药材批次列表、搜索和筛选
- 新建药材批次
- 批次审核通过与驳回
- 对审核通过的仓储批次确认出库
- 消息中心和顶部消息提醒
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
- 34 项鉴权和批次接口自动化测试（内存数据，不修改 PostgreSQL）

## 技术栈

### 前端

- React 19 + TypeScript
- Vite
- Ant Design + Less
- React Router
- TanStack Query
- ECharts
- html5-qrcode + qrcode.react

### 后端与数据

- Node.js + Express + TypeScript
- PostgreSQL
- Prisma + `@prisma/adapter-pg` + `pg`
- bcryptjs
- jose（JWT）+ express-rate-limit（登录限流）
- Zod

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

开发默认使用真实 API，需另开终端启动后端。Vite 将 `/api` 代理到 `http://localhost:4000`；代理只在开发服务器生效。

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

前端测试使用现有 Vite 加载 TypeScript 模块与 Node.js 内置测试器，无新增测试依赖；14 项测试覆盖恢复、401/403、缓存、竞态、取消/超时、过期、存储不可用、回跳和四角色演示。测试中的 MockTimers 会产生 Node 实验性 API 提示。

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

1. 实现带结构化风险结论、人工复核和审计记录的 AI 审核 Agent
2. 实现 RAG 药材知识问答与基础效果评测；批次详情与扫码快速预览共用问答入口
3. 开放脱敏的匿名溯源页面，支持扫码或直接打开链接，不以扫码作为访问条件
4. 为关键批次数据适配和页面交互补充前端自动化测试
5. 处理前端路由懒加载和首包体积，继续完善请求状态与异常体验
6. 接入实时业务通知、真实文件存储并完成后端部署

## 当前限制

- 真实身份与从建档到收货的主链路已接入；看板中的部分辅助信息、消息及个人资料扩展字段仍包含演示数据。
- API 模式只在 sessionStorage 保存 Token，用户身份来自服务端；demo 使用独立存储键，不信任旧 Mock 登录记录。sessionStorage 不是防 XSS 的保险箱，部署仍需 HTTPS 与 XSS 防护。
- 退出清除的是认证信息和内存请求缓存，不删除用于跨角色演示的业务 localStorage；这不代表组织隔离已完成。
- localStorage 数据仅在同一站点、同一浏览器中共享。
- demo 模式图片以 base64 保存；API 模式尚未接对象存储，因此日志、采收和质检附件暂不可上传。
- PostgreSQL 已应用 V2 核心模型并导入 seed；读取、建档、日志、采收、审核、加工认领、加工完成、质检摘要、出库和收货均已调用真实 API。
- 当前“出库”只记录阶段和溯源事件，没有物流单、承运方或运输轨迹；“收货”也没有订单、合同、库存及采购商归属模型。MVP 仅做角色级权限控制，因此任一已登录采购商都可确认任一已出库批次，不能宣称已完成生产级交易履约或订单归属校验。
- 暂无 Refresh Token、服务端登出撤销与多实例共享限流；Token 一小时过期后重新登录。
- AI Agent、RAG 和实时通知仍属于明确规划，尚未标记为已实现。
