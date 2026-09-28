/** 应用入口工厂文件
 * 提供 createApp 工厂函数，用来创建并配置整个Express应用实例
 * 统一加载中间件、挂载所有业务路由，支持依赖注入方便单元测试
 */
import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
// 健康检查路由
import { healthRouter } from './routes/health.js'
// 认证模块路由工厂
import { createAuthRouter } from './routes/auth.js'
// 认证服务工厂与类型定义
import { createAuthService, type AuthService } from './services/auth.js'
// 全局错误处理中间件、自定义HTTP错误类
import { errorHandler, HttpError } from './middleware/error.js'
// 批次模块路由工厂
import { createBatchRouter } from './routes/batches.js'
// 批次业务服务工厂与类型定义
import {
  createBatchService,
  type BatchService,
} from './services/batches.js'

/**
 * 创建Express应用实例的工厂函数
 * @param authService 认证服务，不传则自动创建真实认证服务
 * @param batchService 批次业务服务，不传则自动创建真实批次服务
 * 支持传入mock服务，用于自动化测试，避免连接真实数据库
 */
export function createApp(
  authService: AuthService = createAuthService(),
  batchService: BatchService = createBatchService(),
) {
  // 初始化express app实例
  const app = express()

  // 跨域中间件，读取环境变量配置前端域名，允许携带cookie凭证
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
    }),
  )

  // 解析请求体为json，限制最大请求体大小2MB，防止超大请求攻击
  app.use(express.json({ limit: '2mb' }))

  // 挂载健康检查接口 /api
  app.use('/api', healthRouter)
  // 挂载鉴权相关接口 /api/auth，注入认证服务
  app.use('/api/auth', createAuthRouter(authService))
  // 挂载药材批次接口 /api/batches，注入鉴权服务和批次业务服务
  app.use(
    '/api/batches',
    createBatchRouter(authService, batchService),
  )

  // 兜底中间件：访问不存在的接口路径，抛出404自定义错误
  app.use((_req, _res, next) => {
    next(new HttpError(404, 'NOT_FOUND', 'API route not found'))
  })

  // 全局统一异常捕获处理中间件，格式化所有接口抛出的错误并返回给前端
  app.use(errorHandler)

  // 返回配置完成的express应用实例
  return app
}
