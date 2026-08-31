# 良木药谷 liangmuMedicine

良木药谷是使用 React、TypeScript、Node.js 和 PostgreSQL 构建的中药材全链路智能溯源平台。项目围绕种植商、加工商、平台管理员和采购商四类角色，展示药材从建档、审核、种植、采收、加工、质检到下游溯源的协作流程。

项目面向前端与 AI 应用开发岗位作品集。目前已经完成四端前端基础闭环、Express 后端骨架、PostgreSQL V2 核心模型及可重复执行的业务 seed；真实业务 API、服务端鉴权、AI 审核 Agent、RAG 与实时通知正在后续阶段接入。

## 在线演示

- Cloudflare Pages：<https://liangmumedicine.pages.dev>
- 当前线上版本是静态前端演示，数据来自内置 JSON 与当前浏览器的 localStorage，不与本机 PostgreSQL 互通。

## 核心业务链路

```text
种植商创建批次
  → 管理员审核
  → 采购商浏览与扫码溯源
  → 种植商记录种植日志和采收信息
  → 加工商接收、加工、上传质检报告并完成入库
  → 管理员收到入库通知
```

当前跨角色数据变化由同一浏览器下的本地覆盖层模拟。后续将迁移到 Express API 与 PostgreSQL，实现真实的跨账号、跨设备协作。

## 已实现功能

### 管理员端

- 数据概览与 ECharts 看板
- 药材批次列表、搜索和筛选
- 新建药材批次
- 批次审核通过与驳回
- 消息中心和顶部消息提醒
- 批次详情与溯源时间线

### 采购商端

- 已审核药材批次浏览
- 二维码扫描与溯源码查询
- 溯源快速预览和详情查看
- 按采购商角色精简敏感字段

### 种植商端

- 种植商工作台
- 按所属种植组织查看批次
- 新建待审核批次
- 种植日志记录
- 采收登记与阶段流转

### 加工商端

- 加工商工作台与可处理批次列表
- 接收加工：`harvested → processing`
- 完成加工入库：`processing → warehousing`
- 质检报告图片或 PDF 本地演示上传
- 入库后生成管理员系统通知

### 后端与数据库地基

- Express + TypeScript 服务骨架
- `GET /api/health` 服务与 PostgreSQL 真实健康检查
- Prisma V2 多租户核心模型与两条 migration
- 组织、用户、批次、事件、审核、附件和业务通知表结构
- Prisma PostgreSQL Driver Adapter 与共享数据库客户端
- 12 个组织、8 个账号、15 个批次及关联业务记录的可重复 seed

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
- Zod

### 部署

- Cloudflare Pages：前端静态站点
- GitHub：代码托管与自动部署触发

## 当前数据架构

```text
React 页面
  → TanStack Query hooks
  → herbStorage.ts
  → public/data/herb-batches.json
  + localStorage 本地覆盖层
```

后端数据库层目前独立存在：

```text
Express /api/health
  → 共享 Prisma Client
  → PostgreSQL Driver Adapter
  → PostgreSQL
```

下一阶段会把页面写操作统一收口到 TanStack Query mutation 和 API Client，再用真实业务 API 替换 `herbStorage.ts` 的本地实现。

## 项目目录

```text
liangmuMedicine/
├─ public/                 # 静态资源、药材图片和 JSON 样例数据
├─ src/
│  ├─ components/         # 公共组件、扫码与溯源组件
│  ├─ hooks/              # TanStack Query 数据 hooks
│  ├─ mock/               # 账号、看板、消息等演示数据
│  ├─ pages/              # admin、buyer、grower、processor 页面
│  ├─ services/           # 当前本地数据访问层和 QueryClient
│  ├─ types/              # 认证与药材业务类型
│  └─ utils/              # 鉴权、溯源码和业务辅助函数
├─ server/
│  ├─ prisma/             # Prisma schema、migrations 与 seed
│  └─ src/                # Express 应用、配置和路由
└─ README.md
```

## 本地运行

### 1. 启动前端

```powershell
npm install
npm run dev
```

默认地址：<http://localhost:5173>

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

## 演示账号

以下账号同时存在于前端 Mock 与本地数据库 seed 中。前端目前仍使用 Mock 校验；数据库只保存 bcrypt 哈希，不保存明文密码。

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
npm run build
```

后端：

```powershell
cd server
npm run typecheck
npm run build
npm run prisma:validate
npm run prisma:seed
```

## 下一阶段

1. 实现登录 API、密码校验和访问令牌
2. 实现 RBAC 与组织数据隔离中间件
3. 实现批次 CRUD、审核、事件和阶段流转 API
4. 前端从 JSON/localStorage 切换到真实 API
5. 开放脱敏的匿名扫码溯源页面
6. 接入实时业务通知
7. 实现 AI 审核 Agent、RAG 知识问答与效果评测
8. 接入真实文件存储并完成后端部署

## 当前限制

- 路由权限和账号登录目前主要由前端 Mock 实现，不可视为生产安全方案。
- localStorage 数据仅在同一站点、同一浏览器中共享。
- 图片和质检附件目前以 base64 形式本地保存，只适合演示。
- PostgreSQL 已应用 V2 核心模型并导入 seed，但前端尚未调用真实业务 API。
- 轻量多租户目前只完成数据库关系，API 层的 RBAC 和组织过滤尚未实现。
- AI Agent、RAG 和实时通知仍属于明确规划，尚未标记为已实现。
