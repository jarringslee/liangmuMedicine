import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import {
  AuditDecision,
  AuditSource,
  AuditStatus,
  BatchEventType,
  BatchStage,
  HerbCategory,
  NotificationType,
  OrganizationType,
  Prisma,
  RiskLevel,
  UserRole,
  UserStatus,
} from '@prisma/client'
import { hash } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../src/lib/prisma.js'

const roleSchema = z.enum(['admin', 'grower', 'processor', 'buyer'])
const eventRoleSchema = z.enum(['admin', 'grower', 'processor', 'buyer', 'system'])

const attachmentSchema = z.object({
  name: z.string().min(1),
  url: z.string(),
})

const eventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    'create',
    'audit',
    'stageChange',
    'qcReport',
    'storage',
    'transport',
    'transaction',
    'note',
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  occurredAt: z.string().min(1),
  operatorName: z.string().optional(),
  operatorRole: eventRoleSchema.optional(),
  scopes: z.array(roleSchema).optional(),
  fromStage: z.enum(['planting', 'harvested', 'processing', 'warehousing', 'shipped', 'sold']).optional(),
  toStage: z.enum(['planting', 'harvested', 'processing', 'warehousing', 'shipped', 'sold']).optional(),
  attachments: z.array(attachmentSchema).optional(),
})

const batchSchema = z.object({
  id: z.string().min(1),
  batchNo: z.string().min(1),
  traceCode: z.string().min(1),
  herbName: z.string().min(1),
  category: z.enum(['root', 'wholeHerb', 'fruitSeed', 'flowerLeaf', 'bark', 'mineral', 'other']),
  growerId: z.string().min(1),
  growerName: z.string().min(1),
  plantingStartDate: z.string().min(1),
  origin: z.object({
    province: z.string().min(1),
    city: z.string().min(1),
    district: z.string().min(1),
    address: z.string().min(1),
  }),
  environment: z.string().optional(),
  coverImageUrl: z.string().optional(),
  description: z.string().optional(),
  stage: z.enum(['planting', 'harvested', 'processing', 'warehousing', 'shipped', 'sold']),
  auditStatus: z.enum(['pending', 'approved', 'rejected']),
  riskLevel: z.enum(['normal', 'low', 'medium', 'high']),
  createdAt: z.string().min(1),
  createdBy: z.string().min(1),
  createdByRole: roleSchema,
  updatedAt: z.string().min(1),
  events: z.array(eventSchema),
})

const fixtureSchema = z.object({
  version: z.number().int().positive(),
  batches: z.array(batchSchema),
})

type SeedBatch = z.infer<typeof batchSchema>
type SeedEvent = z.infer<typeof eventSchema>

const fixtureUrl = new URL('../../public/data/herb-batches.json', import.meta.url)

const categoryMap: Record<SeedBatch['category'], HerbCategory> = {
  root: HerbCategory.root,
  wholeHerb: HerbCategory.wholeHerb,
  fruitSeed: HerbCategory.fruitSeed,
  flowerLeaf: HerbCategory.flowerLeaf,
  bark: HerbCategory.bark,
  mineral: HerbCategory.mineral,
  other: HerbCategory.other,
}

const stageMap: Record<SeedBatch['stage'], BatchStage> = {
  planting: BatchStage.planting,
  harvested: BatchStage.harvested,
  processing: BatchStage.processing,
  warehousing: BatchStage.warehousing,
  shipped: BatchStage.shipped,
  sold: BatchStage.sold,
}

const riskMap: Record<SeedBatch['riskLevel'], RiskLevel> = {
  normal: RiskLevel.normal,
  low: RiskLevel.low,
  medium: RiskLevel.medium,
  high: RiskLevel.high,
}

const auditStatusMap: Record<SeedBatch['auditStatus'], AuditStatus> = {
  pending: AuditStatus.pending,
  approved: AuditStatus.approved,
  rejected: AuditStatus.rejected,
}

const eventTypeMap: Record<SeedEvent['type'], BatchEventType> = {
  create: BatchEventType.create,
  audit: BatchEventType.audit,
  stageChange: BatchEventType.stageChange,
  qcReport: BatchEventType.qcReport,
  storage: BatchEventType.storage,
  transport: BatchEventType.transport,
  transaction: BatchEventType.transaction,
  note: BatchEventType.note,
}

const userRoleMap: Record<z.infer<typeof roleSchema>, UserRole> = {
  admin: UserRole.admin,
  grower: UserRole.grower,
  processor: UserRole.processor,
  buyer: UserRole.buyer,
}

const userSeeds = [
  {
    id: 'admin-lijialin',
    username: 'lijialin',
    email: '1413488450@qq.com',
    password: 'lijialin123',
    displayName: '李佳林',
    role: UserRole.admin,
    organizationId: 'org-liangmu-platform',
  },
  {
    id: 'admin-zhengwukai',
    username: 'zhengwukai',
    email: '516136122@qq.com',
    password: 'zhengwukai123',
    displayName: '郑武凯',
    role: UserRole.admin,
    organizationId: 'org-liangmu-platform',
  },
  {
    id: 'buyer-chenjingxuan',
    username: 'chenjingxuan',
    email: '2308096635@qq.com',
    password: 'chenjingxuan123',
    displayName: '陈靖轩',
    role: UserRole.buyer,
    organizationId: 'buyer-chenjingxuan',
  },
  {
    id: 'buyer-caomoran',
    username: 'caomoran',
    email: '3072757348@qq.com',
    password: 'caomoran123',
    displayName: '曹默然',
    role: UserRole.buyer,
    organizationId: 'buyer-caomoran',
  },
  {
    id: 'grower-yuanyuhang',
    username: 'yuanyuhang',
    email: '3253702912@qq.com',
    password: 'yuanyuhang123',
    displayName: '袁宇航',
    role: UserRole.grower,
    organizationId: 'g-qinling-bencao',
  },
  {
    id: 'grower-lijiaying',
    username: 'lijiaying',
    email: '3101016138@qq.com',
    password: 'lijiaying123',
    displayName: '李佳英',
    role: UserRole.grower,
    organizationId: 'g-taibaishan-daodi',
  },
  {
    id: 'processor-haorunyuan',
    username: 'haorunyuan',
    email: '2264523868@qq.com',
    password: 'haorunyuan123',
    displayName: '蒿润圆',
    role: UserRole.processor,
    organizationId: 'p-qinling-herb',
  },
  {
    id: 'processor-yangzhouming',
    username: 'yangzhouming',
    email: '2022217461@qq.com',
    password: 'yangzhouming123',
    displayName: '杨周明',
    role: UserRole.processor,
    organizationId: 'p-baishan-herb',
  },
] as const

const knownUserIdByName = new Map<string, string>(
  userSeeds.map((user) => [user.displayName, user.id]),
)

function parseChinaDateTime(value: string): Date {
  const localDateTime = value.replace(' ', 'T')
  const withSeconds = localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime
  return new Date(`${withSeconds}+08:00`)
}

function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function processorFor(batch: SeedBatch): string | null {
  if (!['processing', 'warehousing', 'shipped', 'sold'].includes(batch.stage)) return null
  const sequence = Number(batch.id.replace('hb-', ''))
  return sequence % 2 === 0 ? 'p-baishan-herb' : 'p-qinling-herb'
}

function eventOperatorRole(event: SeedEvent): UserRole | null {
  if (!event.operatorRole || event.operatorRole === 'system') return null
  return userRoleMap[event.operatorRole]
}

async function loadFixture() {
  const json = await readFile(fixtureUrl, 'utf8')
  return fixtureSchema.parse(JSON.parse(json))
}

async function seedOrganizations(batches: SeedBatch[]) {
  const growerOrganizations = Array.from(
    new Map(
      batches.map((batch) => [
        batch.growerId,
        {
          id: batch.growerId,
          code: batch.growerId,
          name: batch.growerName,
          type: OrganizationType.grower,
          province: batch.origin.province,
          city: batch.origin.city,
        },
      ]),
    ).values(),
  )

  const organizations: Prisma.OrganizationUncheckedCreateInput[] = [
    {
      id: 'org-liangmu-platform',
      code: 'org-liangmu-platform',
      name: '良木药谷平台',
      type: OrganizationType.platform,
      province: '陕西省',
      city: '西安市',
    },
    ...growerOrganizations,
    {
      id: 'p-qinling-herb',
      code: 'p-qinling-herb',
      name: '秦岭本草加工厂',
      type: OrganizationType.processor,
      province: '陕西省',
      city: '西安市',
    },
    {
      id: 'p-baishan-herb',
      code: 'p-baishan-herb',
      name: '白山道地药材加工厂',
      type: OrganizationType.processor,
      province: '吉林省',
      city: '白山市',
    },
    {
      id: 'buyer-chenjingxuan',
      code: 'buyer-chenjingxuan',
      name: '陈靖轩采购账户',
      type: OrganizationType.buyer,
    },
    {
      id: 'buyer-caomoran',
      code: 'buyer-caomoran',
      name: '曹默然采购账户',
      type: OrganizationType.buyer,
    },
  ]

  for (const organization of organizations) {
    await prisma.organization.upsert({
      where: { id: organization.id },
      update: {
        code: organization.code,
        name: organization.name,
        type: organization.type,
        province: organization.province,
        city: organization.city,
        address: organization.address,
        enabled: true,
      },
      create: organization,
    })
  }
}

async function seedUsers() {
  for (const user of userSeeds) {
    const passwordHash = await hash(user.password, 12)

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        username: user.username,
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        role: user.role,
        status: UserStatus.active,
        organizationId: user.organizationId,
      },
      create: {
        id: user.id,
        username: user.username,
        email: user.email,
        passwordHash,
        displayName: user.displayName,
        role: user.role,
        status: UserStatus.active,
        organizationId: user.organizationId,
      },
    })
  }
}

async function seedBatches(batches: SeedBatch[]) {
  for (const batch of batches) {
    const data = {
      batchNo: batch.batchNo,
      traceCode: batch.traceCode,
      herbName: batch.herbName,
      category: categoryMap[batch.category],
      plantingStartDate: parseDate(batch.plantingStartDate),
      origin: batch.origin as Prisma.InputJsonValue,
      environment: batch.environment,
      coverImageUrl: batch.coverImageUrl,
      description: batch.description,
      requiresProcessing: true,
      stage: stageMap[batch.stage],
      auditStatus: auditStatusMap[batch.auditStatus],
      riskLevel: riskMap[batch.riskLevel],
      growerOrganizationId: batch.growerId,
      processorOrganizationId: processorFor(batch),
      createdById: batch.createdBy,
      version: 1,
      createdAt: parseChinaDateTime(batch.createdAt),
      updatedAt: parseChinaDateTime(batch.updatedAt),
    }

    await prisma.herbBatch.upsert({
      where: { id: batch.id },
      update: data,
      create: { id: batch.id, ...data },
    })

    for (const event of batch.events) {
      const eventData = {
        batchId: batch.id,
        type: eventTypeMap[event.type],
        title: event.title,
        description: event.description,
        occurredAt: parseChinaDateTime(event.occurredAt),
        operatorId: event.operatorName ? knownUserIdByName.get(event.operatorName) : undefined,
        operatorName: event.operatorName,
        operatorRole: eventOperatorRole(event),
        visibleRoles: event.scopes?.map((role) => userRoleMap[role]) ?? [],
        fromStage: event.fromStage ? stageMap[event.fromStage] : undefined,
        toStage: event.toStage ? stageMap[event.toStage] : undefined,
      }

      await prisma.batchEvent.upsert({
        where: { id: event.id },
        update: eventData,
        create: { id: event.id, ...eventData },
      })

      for (const [index, attachment] of (event.attachments ?? []).entries()) {
        const storageKey = `seed/${batch.id}/${event.id}/${index + 1}`
        const attachmentData = {
          batchId: batch.id,
          eventId: event.id,
          uploadedById: event.operatorName ? knownUserIdByName.get(event.operatorName) : undefined,
          originalName: attachment.name,
          publicUrl: attachment.url === '#' ? null : attachment.url,
          mimeType: attachment.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/*',
          sizeBytes: 0,
        }

        await prisma.attachment.upsert({
          where: { storageKey },
          update: attachmentData,
          create: { storageKey, ...attachmentData },
        })
      }

      if (event.type === 'audit') {
        const rejected = event.title.includes('驳回')
        const auditData = {
          batchId: batch.id,
          reviewerId: event.operatorName ? (knownUserIdByName.get(event.operatorName) ?? 'admin-lijialin') : 'admin-lijialin',
          reviewerName: event.operatorName ?? '李佳林',
          decision: rejected ? AuditDecision.rejected : AuditDecision.approved,
          source: AuditSource.manual,
          riskLevel: riskMap[batch.riskLevel],
          reason: event.description,
          createdAt: parseChinaDateTime(event.occurredAt),
        }

        await prisma.batchAudit.upsert({
          where: { id: `audit-${event.id}` },
          update: auditData,
          create: { id: `audit-${event.id}`, ...auditData },
        })
      }
    }
  }
}

async function seedNotifications() {
  const notifications: Prisma.NotificationUncheckedCreateInput[] = [
    {
      id: 'notification-seed-pending',
      type: NotificationType.batchSubmitted,
      recipientId: 'admin-lijialin',
      batchId: 'hb-0008',
      title: '新批次等待审核',
      content: '丹参批次 YM-2026-SX-DS-0534 已提交，请及时审核。',
      metadata: { seeded: true },
    },
    {
      id: 'notification-seed-rejected',
      type: NotificationType.auditResult,
      recipientId: 'admin-zhengwukai',
      batchId: 'hb-0014',
      title: '苍术批次审核驳回',
      content: '该批次产地证明不完整，当前风险等级为中风险。',
      metadata: { seeded: true },
    },
    {
      id: 'notification-seed-processor',
      type: NotificationType.stageChanged,
      recipientId: 'processor-haorunyuan',
      batchId: 'hb-0004',
      title: '黄连批次等待接收加工',
      content: '批次已完成采收，可进入加工接收流程。',
      metadata: { seeded: true },
    },
    {
      id: 'notification-seed-buyer',
      type: NotificationType.system,
      recipientId: 'buyer-chenjingxuan',
      batchId: 'hb-0003',
      title: '甘草批次溯源档案已更新',
      content: '该批次已进入运输阶段，可查看最新溯源记录。',
      metadata: { seeded: true },
    },
  ]

  for (const notification of notifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: {
        type: notification.type,
        recipientId: notification.recipientId,
        batchId: notification.batchId,
        title: notification.title,
        content: notification.content,
        metadata: notification.metadata,
      },
      create: notification,
    })
  }
}

async function main() {
  const fixture = await loadFixture()

  await seedOrganizations(fixture.batches)
  await seedUsers()
  await seedBatches(fixture.batches)
  await seedNotifications()

  const [organizations, users, batches, events, audits, attachments, notifications] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.herbBatch.count(),
    prisma.batchEvent.count(),
    prisma.batchAudit.count(),
    prisma.attachment.count(),
    prisma.notification.count(),
  ])

  console.log(
    `Seed complete: ${organizations} organizations, ${users} users, ${batches} batches, ` +
      `${events} events, ${audits} audits, ${attachments} attachments, ${notifications} notifications.`,
  )
}

main()
  .catch((error) => {
    console.error('Database seed failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
