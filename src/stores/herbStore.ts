/**
 * 药材批次全局状态（zustand）
 *
 * 作为批次数据的「唯一数据源」：
 * - 首次 `load()` 拉取一次，多页面共享，避免重复请求
 * - `reload()` 强制刷新；覆盖层（新增 / 审核 / 重置）变化时自动刷新
 * - `useHerbBatches` 已改为本 store 的薄封装，admin/buyer 调用方无需改动
 */

import { create } from 'zustand'
import type { HerbBatch } from '../types/herb'
import { listBatches, subscribeHerbChanged } from '../services/herbStorage'

type HerbStoreState = {
  data: HerbBatch[]
  loading: boolean
  error: Error | null
  loaded: boolean
  /** 懒加载：已加载则直接返回，并发调用共享同一次请求 */
  load: () => Promise<void>
  /** 强制重新拉取 */
  reload: () => Promise<void>
}

/** 模块级去重：避免多个组件首帧并发触发多次 fetch */
let loadPromise: Promise<void> | null = null

export const useHerbStore = create<HerbStoreState>((set, get) => ({
  data: [],
  loading: true,
  error: null,
  loaded: false,
  reload: async () => {
    set({ loading: true })
    try {
      const data = await listBatches()
      set({ data, loading: false, error: null, loaded: true })
    } catch (e) {
      set({ data: [], loading: false, error: e as Error, loaded: true })
    }
  },
  load: async () => {
    if (get().loaded) return
    if (!loadPromise) {
      loadPromise = get()
        .reload()
        .finally(() => {
          loadPromise = null
        })
    }
    return loadPromise
  },
}))

/** 覆盖层变化时刷新全局仓库（同标签页事件 + 跨标签页 storage 事件） */
subscribeHerbChanged(() => {
  void useHerbStore.getState().reload()
})
