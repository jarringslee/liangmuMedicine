/**
 * 批次数据 hooks（基于 TanStack Query v5）
 *
 * 设计要点：
 * 1. 底层数据源仍是 `herbStorage`（localStorage 覆盖层 + JSON 样例）。
 *    当后端 API 就绪时，只改 queryFn 内部一行 `await fetch('/api/batches')` 即可，
 *    所有调用方零改动。
 * 2. 任意写操作（add/update/audit/event/harvest）完成后，storage 层会派发
 *    `herb-changed` 事件，queryClient 监听到后自动 invalidate
 *    `['herb-batches']`，所有订阅者重新拉取 → 多页面实时同步。
 * 3. 对外暴露两个常用入口：
 *    - `useHerbBatches()`  —— 列表（admin / buyer / grower 都在用）
 *    - `useHerbBatchById(id)` —— 详情（按需启用，避免列表页面也拖详情）
 * 4. `useHerbBatchMutations()` 暴露 6 个 mutation，调用方按需取用。
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { HerbBatch } from '../types/herb'
import type { AuditStatus, BatchEvent, Stage } from '../types/herb'
import {
  addBatch,
  addBatchEvent,
  getById,
  listBatches,
  recordHarvest,
  setAuditStatus,
  updateBatch,
  type HarvestInput,
  type NewBatchEventInput,
  type NewBatchInput,
} from '../services/herbStorage'

/** 全局 queryKey 集中管理，避免散落字符串 */
export const herbQueryKeys = {
  all: ['herb-batches'] as const,
  list: () => [...herbQueryKeys.all, 'list'] as const,
  detail: (id: string) => [...herbQueryKeys.all, 'detail', id] as const,
}

/**
 * 订阅式获取全量批次列表
 * - 替代旧的 zustand herbStore + useHerbBatches
 * - 对外返回结构与旧版完全一致：{ data, loading, error, reload }
 *   - data: HerbBatch[]
 *   - loading: boolean（首屏为 true）
 *   - error: Error | null
 *   - reload: () => void
 */
export function useHerbBatches() {
  const query = useQuery({
    queryKey: herbQueryKeys.list(),
    queryFn: listBatches,
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
export function useHerbBatchById(id: string | null | undefined) {
  const query = useQuery({
    queryKey: id ? herbQueryKeys.detail(id) : ['herb-batches', 'noop'],
    queryFn: () => (id ? getById(id).then((b) => b as HerbBatch | null) : Promise.resolve(null)),
    enabled: Boolean(id),
  })
  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: (query.error as Error | null) ?? null,
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
    mutationFn: (input: NewBatchInput) => addBatch(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<HerbBatch> }) =>
      updateBatch(id, patch),
    onSuccess: invalidate,
  })
  const setAudit = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AuditStatus }) =>
      setAuditStatus(id, status),
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
 * 把 zustand `herbStore` 的全局订阅迁移到 queryClient：
 * 任意 storage 变更（新增/审核/阶段/重置）触发 `herb-changed` 事件，
 * 在这里统一 invalidate，让 useQuery 自动重新拉取。
 */
export function useHerbStoreInvalidator() {
  const qc = useQueryClient()
  useEffect(() => {
    const onChange = () => qc.invalidateQueries({ queryKey: herbQueryKeys.all })
    window.addEventListener('herb-changed', onChange)
    return () => window.removeEventListener('herb-changed', onChange)
  }, [qc])
}
