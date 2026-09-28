/**
 * 批次数据 hooks（基于 TanStack Query v5）
 *
 * 设计要点：
 * 1. `herbDataSource` 根据 VITE_AUTH_MODE 选择真实 API 或本地演示数据，
 *    页面与 Hook 不需要感知实际数据来源。
 * 2. mutation 成功后统一 invalidate 批次缓存；demo 模式的其他本地写入
 *    仍可通过 `herb-changed` 事件触发缓存失效。
 * 3. 对外暴露三个常用入口：
 *    - `useHerbBatches()`  —— 列表（admin / buyer / grower 都在用）
 *    - `useHerbBatchById(id)` —— 详情（按需启用，避免列表页面也拖详情）
 *    - `useHerbBatchByTraceCode(code)` —— 扫码、直接链接共用的详情
 * 4. `useHerbBatchMutations()` 暴露 6 个 mutation，调用方按需取用。
 */
import { useEffect } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HerbBatch } from '../types/herb'
import type { BatchEvent, Stage } from '../types/herb'
import {
  addBatchEvent,
  recordHarvest,
  updateBatch,
  type HarvestInput,
  type NewBatchEventInput,
  type NewBatchInput,
} from '../services/herbStorage'

import { authMode } from '../config/api'
import {
  auditHerbBatch,
  createHerbBatch,
  getHerbBatchById,
  getHerbBatchByTraceCode,
  listHerbBatches,
  type AuditHerbBatchInput,
} from '../services/herbDataSource'

/** 全局 queryKey 集中管理，避免散落字符串 */
export const herbQueryKeys = {
  all: ['herb-batches', authMode] as const,
  list: () =>
    [...herbQueryKeys.all, 'list'] as const,
  detail: (identifier: string) =>
    [
      ...herbQueryKeys.all,
      'detail',
      identifier,
    ] as const,
}

/**
 * 订阅式获取全量批次列表
 * - 对外返回结构与旧版完全一致：{ data, loading, error, reload }
 *   - data: HerbBatch[]
 *   - loading: boolean（首屏为 true）
 *   - error: Error | null
 *   - reload: () => void
 */
export function useHerbBatches() {
  const query = useQuery({
    queryKey: herbQueryKeys.list(),
    queryFn: listHerbBatches,
  })

  const queryClient = useQueryClient()
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: herbQueryKeys.all })
  }

  return {
    data: query.data ?? [],
    loading: query.isPending || query.isFetching,
    error: (query.error as Error | null) ?? null,
    reload,
  }
}

/** 按 ID 获取单个批次（详情页按需启用） */
// 根据批次 ID 查询药材详情的自定义 Hook
export function useHerbBatchById(id: string | null | undefined) {
  const query = useQuery({
    queryKey: id ? herbQueryKeys.detail(id) : [...herbQueryKeys.all, 'noop'],
    queryFn: () => (id ? getHerbBatchById(id) : Promise.resolve(null)),
    enabled: Boolean(id),
  })

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: (query.error as Error | null) ?? null,
    reload: () => void query.refetch(),
  }
}

/**
 * 写操作 mutation 集合
 * 全部成功后都会自动 invalidate `herb-batches` 全树，
 * 触发所有订阅的 useQuery 重新拉取（admin / buyer / grower 同步刷新）。
 */
export function useHerbBatchMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: herbQueryKeys.all })

  const create = useMutation({
    mutationFn: (input: NewBatchInput) => createHerbBatch(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<HerbBatch> }) =>
      updateBatch(id, patch),
    onSuccess: invalidate,
  })
  const setAudit = useMutation({
    mutationFn: (input: AuditHerbBatchInput) =>
      auditHerbBatch(input),
    onSuccess: invalidate,
  })
  const addEvent = useMutation({
    mutationFn: ({ batchId, input }: { batchId: string; input: NewBatchEventInput }) =>
      addBatchEvent(batchId, input),
    onSuccess: invalidate,
  })
  const setStage = useMutation({
    mutationFn: ({
      batchId,
      toStage,
      operator,
      note,
    }: {
      batchId: string
      toStage: Stage
      operator: { displayName: string; role: BatchEvent['operatorRole'] }
      note?: string
    }) => {
      return addBatchEvent(batchId, {
        type: 'stageChange',
        title: '阶段变更',
        occurredAt: new Date().toISOString(),
        operatorName: operator.displayName,
        operatorRole: operator.role,
        toStage,
        description: note,
      }).then(() => updateBatch(batchId, { stage: toStage }))
    },
    onSuccess: invalidate,
  })
  const harvest = useMutation({
    mutationFn: ({
      batchId,
      input,
      operator,
    }: {
      batchId: string
      input: HarvestInput
      operator: { userId: string; displayName: string; growerId?: string; growerName?: string }
    }) => recordHarvest(batchId, input, operator),
    onSuccess: invalidate,
  })

  return { create, update, setAudit, addEvent, setStage, harvest }
}

/**
 * 把本地覆盖层的变更事件桥接到 TanStack Query：
 * 任意 storage 变更（新增/审核/阶段/重置）触发 `herb-changed` 事件，
 * 在这里统一使批次查询缓存失效，让 useQuery 自动重新拉取。
 */
export function useHerbQueryInvalidator() {
  const qc = useQueryClient()
  useEffect(() => {
    const onChange = () => qc.invalidateQueries({ queryKey: herbQueryKeys.all })
    window.addEventListener('herb-changed', onChange)
    return () => window.removeEventListener('herb-changed', onChange)
  }, [qc])
}

/**
 * 列表接口只返回摘要；确实依赖事件链的页面再按需补查详情。
 * 当前仅用于种植日志和采收记录，避免所有列表都产生 N+1 请求。
 */
export function useHerbBatchDetails(batches: HerbBatch[]) {
  const queries = useQueries({
    queries: batches.map((batch) => ({
      queryKey: herbQueryKeys.detail(batch.id),
      queryFn: () => getHerbBatchById(batch.id),
      enabled: authMode === 'api',
    })),
  })

  if (authMode === 'demo') {
    return {
      data: batches,
      loading: false,
      error: null as Error | null,
      reload: () => undefined,
    }
  }

  return {
    data: queries.flatMap((query) => (query.data ? [query.data] : [])),
    loading: queries.some((query) => query.isPending || query.isFetching),
    error: (queries.find((query) => query.error)?.error as Error | null) ?? null,
    reload: () => {
      queries.forEach((query) => void query.refetch())
    },
  }
}

/** 按溯源码读取详情，列表点击、扫码和直接链接均可复用。 */
export function useHerbBatchByTraceCode(
  traceCode: string | null | undefined,
) {
  const query = useQuery({
    queryKey: traceCode
      ? herbQueryKeys.detail(traceCode)
      : [...herbQueryKeys.all, 'noop-trace'],
    queryFn: () =>
      traceCode
        ? getHerbBatchByTraceCode(traceCode)
        : Promise.resolve(null),
    enabled: Boolean(traceCode),
  })

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: (query.error as Error | null) ?? null,
    reload: () => {
      void query.refetch()
    },
  }
}
