# liangmuMedicine Server

后端第一刀：Node.js + Express + PostgreSQL 地基。

## 当前范围

- Express API 骨架
- `/api/health` 健康检查
- `.env.example` 环境变量模板
- Prisma schema
- 初始 PostgreSQL migration SQL

暂不做：

- 前端数据迁移
- 登录鉴权
- AI / WebSocket

这些会在后续小步接入。

## 本地启动

```bash
cd server
npm install
npm run dev
```

健康检查：

```bash
curl http://localhost:4000/api/health
```

说明：当前健康检查只确认 Express 服务是否运行，暂不检查 PostgreSQL 连接。

## 数据库准备

当前数据库方案已敲定：

- Node.js + Express
- PostgreSQL
- Prisma

本地需要先准备 PostgreSQL。数据库名建议：

```text
liangmu_medicine
```

复制环境变量：

```bash
cp .env.example .env
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env
```

然后修改 `.env`：

```env
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/liangmu_medicine?schema=public
```

校验 Prisma schema：

```bash
npm run prisma:validate
```

说明：当前使用 Prisma 7，`DATABASE_URL` 由 `prisma.config.ts` 读取，不再写在 `schema.prisma` 的 datasource 中。
如果没有创建 `.env` 或没有填写 `DATABASE_URL`，Prisma 命令会直接报错提醒。

生成 Prisma Client：

```bash
npm run prisma:generate
```

执行 migration（需要 PostgreSQL 已启动且 `DATABASE_URL` 正确）：

```bash
npm run prisma:migrate:dev -- --name init
```

如果只是先看表结构，不想连接数据库，可以直接阅读：

```text
prisma/migrations/20260623000100_init/migration.sql
```

## 后续顺序

1. 本地 PostgreSQL 执行初始 migration
2. 补 seed，把现有 mock 账号和药材批次导入数据库
3. 实现 batches API
4. 前端 `herbStorage.ts` 从 localStorage 逐步切到 API
5. 增加 AI 代理接口 `/api/ai/chat`
6. 增加 Socket.IO 实时消息
