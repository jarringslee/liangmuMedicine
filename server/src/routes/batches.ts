// 校验 URL 查询参数；
// 执行 JWT 身份认证；
// 调用批次 service；
// 路由层不直接操作 Prisma。

import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRoles } from '../middleware/auth.js'
import type { AuthService } from '../services/auth.js'
import type {
    AppendBatchEventInput,
    AuditBatchInput,
    BatchListQuery,
    BatchService,
    CompleteProcessingInput,
    CreateBatchInput,
    HarvestBatchInput,
    ProcessingQualityReportInput,
} from '../services/batches.js'

// ========== Zod参数校验模板：列表查询参数规则 ==========
// 用来校验列表接口前端传入的query参数，参数不满足规则会直接拦截，不进入业务代码
const listQuerySchema = z.object({
    // coerce：如果前端传字符串形式的数字，自动转为number类型
    page: z.coerce
        .number()
        .int()         // 必须是整数
        .min(1)        // 最小页码1
        .max(10_000)   // 最大页码10000，防止超大页码查询拖垮数据库
        .default(1),   // 前端不传page，默认值为1

    pageSize: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)      // 一页最多返回100条，限制大量一次性拉取
        .default(20),  // 不传则默认一页20条

    search: z.string()
        .trim()        // 自动去掉字符串首尾空格
        .min(1)
        .max(100)      // 搜索词长度限制1~100字符
        .optional(),   // 非必传，前端可以不带搜索关键词

    // 批次阶段枚举，只能是下面指定字符串，可不传
    stage: z.enum([
        'planting',
        'harvested',
        'processing',
        'warehousing',
        'shipped',
        'sold',
    ]).optional(),

    // 审核状态枚举，只能是指定值，可不传
    auditStatus: z.enum([
        'pending',
        'approved',
        'rejected',
    ]).optional(),

    // 风险等级枚举，只能是指定值，可不传
    riskLevel: z.enum([
        'normal',
        'low',
        'medium',
        'high',
    ]).optional(),
}).strict() // strict() 严格模式：前端不能传递schema以外的多余字段，多传直接报错


// ========== Zod参数校验模板：详情接口的批次标识（id或者traceCode） ==========
const identifierSchema = z.string()
    .trim()
    .min(1)
    .max(100)
    // 正则：只允许大小写字母、数字、下划线_、短横线-
    .regex(
        /^[A-Za-z0-9_-]+$/,
        '批次标识格式不正确',
    )

const isoDateSchema = z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD')
    .refine((value) => {
        const parsed = new Date(`${value}T00:00:00.000Z`)
        return !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value
    }, '日期不是有效日期')

const createBatchSchema = z.object({
    herbName: z.string().trim().min(1).max(32),
    category: z.enum([
        'root',
        'wholeHerb',
        'fruitSeed',
        'flowerLeaf',
        'bark',
        'mineral',
        'other',
    ]),
    plantingStartDate: isoDateSchema,
    origin: z.object({
        province: z.string().trim().min(1).max(32),
        city: z.string().trim().min(1).max(32),
        district: z.string().trim().min(1).max(32).optional(),
        address: z.string().trim().min(1).max(100).optional(),
    }).strict(),
    environment: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(200).optional(),
}).strict()

const auditBatchSchema = z.object({
    decision: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(500).optional(),
    riskLevel: z.enum([
        'normal',
        'low',
        'medium',
        'high',
    ]).optional(),
}).strict()

const appendEventSchema = z.object({
    title: z.string().trim().min(1).max(40),
    description: z.string().trim().min(1).max(500),
    occurredAt: z.string().refine(
        (value) => !Number.isNaN(new Date(value).getTime()),
        '记录时间格式不正确',
    ),
}).strict()

const harvestBatchSchema = z.object({
    harvestDate: isoDateSchema,
    yieldKg: z.number().positive().max(10_000_000),
    plotArea: z.string().trim().min(1).max(100).optional(),
    harvesterName: z.string().trim().min(1).max(50).optional(),
    note: z.string().trim().min(1).max(500).optional(),
}).strict()

const completeProcessingSchema = z.object({
    note: z.string().trim().min(1).max(500),
}).strict()

const processingQualityReportSchema = z.object({
    summary: z.string().trim().min(1).max(500),
}).strict()

/**
* 创建批次模块路由工厂函数
* 接收认证服务、批次业务服务实例，返回配置好的express路由对象
*/
export function createBatchRouter(
    authService: AuthService,
    batchService: BatchService,
) {
    const router = Router()

    // 本路由下全部接口统一设置响应头：不缓存
    // no-store：浏览器、代理服务器不要保存这份响应，每次都请求后端拿最新数据
    router.use((_req, res, next) => {
        res.set('Cache-Control', 'no-store')
        next()
    })

    // 路由全局中间件：
    // 当前路由下面所有接口，请求进来必须先校验AccessToken，解析登录用户信息
    // 未登录、token无效直接拦截，不会进入下面接口业务代码
    router.use(authenticate(authService))

    // POST / 创建批次：组织、创建人和初始状态全部由服务端认证身份生成。
    router.post('/', requireRoles('grower'), async (req, res) => {
        const input = createBatchSchema.parse(
            req.body,
        ) as CreateBatchInput
        const batch = await batchService.create(
            req.auth!,
            input,
        )
        res.status(201).json({ batch })
    })

    // GET / 批次列表接口
    router.get('/', async (req, res) => {
        // 使用Zod校验url查询参数，校验失败会直接抛出异常
        const query = listQuerySchema.parse(
            req.query,
        ) as BatchListQuery

        // 调用业务层service，传入解析后的登录用户(req.auth!) + 校验完成的查询参数
        const result = await batchService.list(
            req.auth!,
            query,
        )

        // 将分页列表结果以json返回给前端
        res.json(result)
    })

    // GET /:identifier 批次详情接口
    // identifier是路由路径参数，可以是批次id或者溯源码
    router.get('/:identifier', async (req, res) => {
        // 校验路径参数格式
        const identifier = identifierSchema.parse(
            req.params.identifier,
        )

        // 调用service的detail方法查询批次详情
        const batch = await batchService.detail(
            req.auth!,
            identifier,
        )

        // 把批次详情包装在batch字段返回给前端
        res.json({ batch })
    })

    // PATCH /:identifier/audit 管理员人工审核，写入状态、审核记录和事件。
    router.patch(
        '/:identifier/audit',
        requireRoles('admin'),
        async (req, res) => {
            const identifier = identifierSchema.parse(
                req.params.identifier,
            )
            const input = auditBatchSchema.parse(
                req.body,
            ) as AuditBatchInput
            const batch = await batchService.audit(
                req.auth!,
                identifier,
                input,
            )
            res.json({ batch })
        },
    )

    router.post(
        '/:identifier/events',
        requireRoles('grower'),
        async (req, res) => {
            const identifier = identifierSchema.parse(req.params.identifier)
            const input = appendEventSchema.parse(
                req.body,
            ) as AppendBatchEventInput
            const batch = await batchService.appendEvent(
                req.auth!,
                identifier,
                input,
            )
            res.status(201).json({ batch })
        },
    )

    router.post(
        '/:identifier/harvest',
        requireRoles('grower'),
        async (req, res) => {
            const identifier = identifierSchema.parse(req.params.identifier)
            const input = harvestBatchSchema.parse(
                req.body,
            ) as HarvestBatchInput
            const batch = await batchService.harvest(
                req.auth!,
                identifier,
                input,
            )
            res.json({ batch })
        },
    )

    router.post(
        '/:identifier/processing/receive',
        requireRoles('processor'),
        async (req, res) => {
            const identifier = identifierSchema.parse(req.params.identifier)
            const batch = await batchService.receiveProcessing(
                req.auth!,
                identifier,
            )
            res.json({ batch })
        },
    )

    router.post(
        '/:identifier/processing/complete',
        requireRoles('processor'),
        async (req, res) => {
            const identifier = identifierSchema.parse(req.params.identifier)
            const input = completeProcessingSchema.parse(
                req.body,
            ) as CompleteProcessingInput
            const batch = await batchService.completeProcessing(
                req.auth!,
                identifier,
                input,
            )
            res.json({ batch })
        },
    )

    router.post(
        '/:identifier/processing/quality-report',
        requireRoles('processor'),
        async (req, res) => {
            const identifier = identifierSchema.parse(req.params.identifier)
            const input = processingQualityReportSchema.parse(
                req.body,
            ) as ProcessingQualityReportInput
            const batch = await batchService.saveProcessingQualityReport(
                req.auth!,
                identifier,
                input,
            )
            res.status(201).json({ batch })
        },
    )

    router.post(
        '/:identifier/shipping/dispatch',
        requireRoles('admin'),
        async (req, res) => {
            const identifier = identifierSchema.parse(req.params.identifier)
            const batch = await batchService.dispatch(
                req.auth!,
                identifier,
            )
            res.json({ batch })
        },
    )

    router.post(
        '/:identifier/receipt/confirm',
        requireRoles('buyer'),
        async (req, res) => {
            const identifier = identifierSchema.parse(req.params.identifier)
            const batch = await batchService.confirmReceipt(
                req.auth!,
                identifier,
            )
            res.json({ batch })
        },
    )

    // 返回配置完成的路由实例，供主程序挂载
    return router
}