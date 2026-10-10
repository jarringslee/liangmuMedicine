import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '@prisma/client'
import type { PoolConfig } from 'pg'
import { env } from '../config/env.js'

export function createPrismaPoolConfig(
  config: Pick<typeof env, 'DATABASE_URL' | 'DB_POOL_MAX' | 'DB_CONNECT_TIMEOUT_MS'>,
): PoolConfig {
  return {
    connectionString: config.DATABASE_URL,
    max: config.DB_POOL_MAX,
    connectionTimeoutMillis: config.DB_CONNECT_TIMEOUT_MS,
  }
}

export function createPrismaTransactionOptions(
  config: Pick<typeof env, 'DB_CONNECT_TIMEOUT_MS' | 'DB_TRANSACTION_TIMEOUT_MS'>,
): NonNullable<Prisma.PrismaClientOptions['transactionOptions']> {
  return { maxWait: config.DB_CONNECT_TIMEOUT_MS, timeout: config.DB_TRANSACTION_TIMEOUT_MS }
}

// 连接等待和事务执行分别有上限；不自动重试业务操作，不改变隔离级别。
const adapter = new PrismaPg(createPrismaPoolConfig(env))

/**
 * 后端共享同一个 Prisma Client，避免每个路由重复创建连接池。
 */
export const prisma = new PrismaClient({ adapter, transactionOptions: createPrismaTransactionOptions(env) })
