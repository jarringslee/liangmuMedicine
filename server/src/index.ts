import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'
import { createAuthService } from './services/auth.js'
import { attachNotificationRealtime } from './realtime/notifications.js'

const auth = createAuthService()
const app = createApp(auth)
const server = createServer(app)
// 业务通知与人工聊天复用同一 JWT 实时连接；数据库消息仍通过 REST 读写。
const io = attachNotificationRealtime(server, auth)

server.listen(env.PORT, () => {
  console.log(`LiangmuTrace API listening on http://localhost:${env.PORT}`)
})

let shuttingDown = false

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received, shutting down...`)

  // 关闭 Socket 后再关闭 HTTP，避免长连接阻止优雅退出。
  io.close(async (error?: Error) => {
    await prisma.$disconnect()

    if (error) {
      console.error('HTTP server shutdown failed', error)
      process.exit(1)
    }

    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
