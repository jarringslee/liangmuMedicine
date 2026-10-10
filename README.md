# 良木药谷 LiangmuTrace

良木药谷是使用 React、TypeScript、Node.js 和 PostgreSQL 构建的中药材全链路智能溯源平台。项目围绕种植商、加工商、平台管理员和采购商四类角色，展示药材从建档、审核、种植、采收、加工、质检到下游溯源的协作流程。

项目面向前端与 AI 应用开发岗位作品集，提供批次溯源、AI 风险审核与人工复核、RAG 问答、多轮 AI 会话、看板、业务通知和协作聊天。前端支持真实 API 与静态 demo 两种数据源；出库/收货表示批次流转，项目不包含订单和支付。

## 在线演示

- Cloudflare Pages：<https://liangmutrace.pages.dev>
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

批次详情页与快速预览的「问问 AI」打开同一个全局聊天抽屉，并带入所选批次。可见信息和可用操作由身份与权限决定。公开溯源页面只展示允许公开的字段；完整详情与真实 AI 服务需要登录。

AI 聊天支持可移除的批次标签和完整 YM 编号定位。API 模式按账号保存历史，刷新/重登读取最近 40 轮，服务端最多使用 4 轮相关历史；批次事实每轮重新按权限读取，普通交流不强制 RAG。静态 demo 中的 AI 回复为离线演示。

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

Pages 托管前端静态产物；真实 API 模式需要独立 HTTPS Node 后端。生产环境配置见 [后端 README](server/README.md)。

## 当前数据架构

```text
React 页面
  → TanStack Query hooks
  → herbDataSource.ts（按 VITE_AUTH_MODE 切换）
      ├─ api：services/api.ts → Express → Prisma → PostgreSQL
      └─ demo：herbStorage.ts → JSON 样例 + localStorage 覆盖层
```

API 模式下，批次列表、列表点击详情、扫码/输码查询和直接溯源链接均读取 PostgreSQL。列表接口只返回摘要，依赖事件链的页面再按需查询详情。种植商可建档、记录日志和登记采收，管理员可审核并确认出库，加工商可从共享待认领池接收批次、完成加工并记录质检摘要，采购商可确认收货。组织、操作人、阶段规则与并发版本均由服务端身份与当前数据库状态决定。

管理员出库时指定有效采购组织，只有该组织可以确认收货。API 模式的候选组织、收货能力和数据访问范围由服务端校验，API 请求失败不会退回 demo。

## 项目目录

```text
LiangmuTrace/
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
npm ci
npm run dev
```

默认地址：<http://localhost:5173>

开发默认使用真实 API，需另开终端启动后端。Vite 将 `/api` 和 `/socket.io`（含实时连接）代理到 `http://localhost:4000`；代理只在开发服务器生效。

认证模式配置：

| 文件 | 默认行为 |
| --- | --- |
| `.env.development` | `npm run dev` 使用 `VITE_AUTH_MODE=api` |
| `.env.production` | `npm run build` 使用 `VITE_AUTH_MODE=demo`，可静态部署 |
| `.env.example` | 本地开发覆盖模板，按需复制为不提交的 `.env.development.local` |

只体验前端时，在 `.env.development.local` 设置 `VITE_AUTH_MODE=demo` 后重启 Vite。生产覆盖用 `.env.production.local` 或平台构建环境变量；模式专用文件优先于通用 `.env.local`，进程环境变量优先级最高，不能误认为 `.env.local` 总会覆盖 `.env.production`。[Vite 配置优先级](https://vite.dev/guide/env-and-mode)

正式接后端时需配置 `VITE_AUTH_MODE=api` 和 HTTPS `VITE_API_BASE_URL=https://<后端域名>/api`；若使用同源 `/api`，必须自行提供真实反向代理，不能仅依赖开发代理。`VITE_*` 会进入浏览器构建产物，禁止填写数据库密码、JWT 密钥或 AI Key。当前 `.env.production` 保持 demo，尚未切换公网真实服务。

### 2. 准备 PostgreSQL

全新本地环境创建数据库；现有环境继续使用原库，不因项目更名另建数据库：

```text
liangmu_medicine
```

首次配置且 `server/.env` 不存在时，复制后端环境变量模板：

```powershell
Copy-Item .\server\.env.example .\server\.env
```

在 `server/.env` 中填写本机数据库连接串。真实密码和 API Key 只能保存在 `.env`，不得提交到 Git。

### 3. 首次安装与初始化后端

```powershell
cd server
npm ci
npm run prisma:validate
npm run prisma:generate
npx prisma migrate deploy
```

仅全新开发数据库需要样例数据时，另行执行 `npm run prisma:seed`。它会按固定主键更新数据，不用于已有数据库的日常启动或生产上线。

### 4. 日常启动后端

在独立终端进入 `server` 后执行 `npm run dev`，无需重复运行 migration 或 seed。

默认地址：<http://localhost:4000>

健康检查：<http://localhost:4000/api/health>

开发环境未配置 `JWT_SECRET` 时使用进程级随机密钥，重启后旧 Token 失效，需要重新登录。生产环境必须设置 `NODE_ENV=production`、显式 HTTPS `CLIENT_ORIGIN` 和至少 32 字符的随机 `JWT_SECRET`；可信代理默认关闭，上线按实际网关核对。接口契约与错误码见 [后端 README](server/README.md)。

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
npm run check:bundle
```

测试使用 Node.js 内置测试器和 Vite，覆盖认证、业务数据源、AI/实时消息、公开溯源与工程化规则。运行测试不需要真实数据库或模型调用。

后端：

```powershell
cd server
npm run typecheck
npm test
npm run build
npm run prisma:validate
```
