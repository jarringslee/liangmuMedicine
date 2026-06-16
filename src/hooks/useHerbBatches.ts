import { useEffect } from 'react'
import { useHerbStore } from '../stores/herbStore'

/**
 * 订阅式获取全量批次列表（含本地覆盖层）。
 *
 * 现已改为 zustand `useHerbStore` 的薄封装：对外返回结构保持不变
 * （data / loading / error / reload），admin、buyer 等调用方无需改动；
 * 底层升级为全局单一数据源，多页面共享、只加载一次。
 */
export function useHerbBatches() {
  const data = useHerbStore((s) => s.data)
  const loading = useHerbStore((s) => s.loading)
  const error = useHerbStore((s) => s.error)
  const reload = useHerbStore((s) => s.reload)
  const load = useHerbStore((s) => s.load)

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload }
}
