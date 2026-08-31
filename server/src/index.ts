import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './lib/prisma.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`liangmuMedicine API listening on http://localhost:${env.PORT}`)
})

let shuttingDown = false

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received, shutting down...`)

  server.close(async (error) => {
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
