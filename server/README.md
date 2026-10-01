# liangmuMedicine Server

良木药谷后端使用 Node.js、Express、TypeScript、PostgreSQL 和 Prisma 7。目前已完成 V2 模型、migration、seed、数据库健康检查、登录/JWT 身份校验、RBAC 角色守卫、按角色和组织过滤的批次读取，以及建档、审核、种植日志、采收、加工认领、加工完成和质检摘要写接口；React 已接入这些能力。

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
- 不修改真实数据库的 32 项鉴权与批次接口自动化测试

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

请求体使用 Zod 严格校验，不接受客户端提交组织、创建人、事件操作人和初始审核状态等可信字段。加工操作通过登录身份绑定组织，使用 `version` 条件更新避免两个加工商同时认领。业务日期按 `Asia/Shanghai` 判断，避免 UTC 服务器在中国时区凌晨误判“今天”。

## 下一阶段

前端开发模式通过 Vite 将 `/api` 代理到本服务；生产构建默认使用独立的 demo 认证，不要求静态托管平台运行本服务。环境切换与请求层说明见根目录 README。

1. 补齐仓储复核、出库/运输与采购确认
2. 接入真实附件存储并补充前端页面测试
3. AI 审核 Agent、RAG 和实时通知
