import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { env } from '../config/env.js'

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL })

/**
 * 后端共享同一个 Prisma Client，避免每个路由重复创建连接池。
 */
export const prisma = new PrismaClient({ adapter })
