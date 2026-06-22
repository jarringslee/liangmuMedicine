# liangmuMedicine Server

后端第一刀：Node.js + Express + PostgreSQL 地基。

## 当前范围

- Express API 骨架
- `/api/health` 健康检查
- `.env.example` 环境变量模板
- Prisma schema 草图

暂不做：

- 真实 PostgreSQL 连接
- Prisma migration
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

## 后续顺序

1. 准备本地 PostgreSQL 和 `DATABASE_URL`
2. 跑 Prisma migration
3. 实现 batches API
4. 前端 `herbStorage.ts` 从 localStorage 逐步切到 API
5. 增加 AI 代理接口 `/api/ai/chat`
6. 增加 Socket.IO 实时消息
