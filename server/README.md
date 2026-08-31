# liangmuMedicine Server

良木药谷后端使用 Node.js、Express、TypeScript、PostgreSQL 和 Prisma 7。目前已经完成数据库运行时连接、V2 核心模型、两条 migration、开发 seed 和真实数据库健康检查；登录鉴权与业务 API 尚未接入。

## 当前能力

- Express API 骨架
- `GET /api/health` 服务与 PostgreSQL 健康检查
- Prisma V2 多组织核心模型
- `@prisma/adapter-pg` + `pg` PostgreSQL Driver Adapter
- 共享 Prisma Client 与进程退出时的连接释放
- 两条 PostgreSQL migration
- 可重复执行的开发 seed

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

## 下一阶段

1. 登录 API、bcrypt 密码校验与访问令牌
2. RBAC 和组织数据隔离中间件
3. 批次、审核、事件与阶段流转 API
4. 前端 TanStack Query 接入真实 API
5. AI 审核 Agent、RAG 和实时通知
