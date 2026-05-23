import { useCallback, useEffect, useState } from 'react'
import type { HerbBatch } from '../types/herb'
import { listBatches, subscribeHerbChanged } from '../services/herbStorage'

type State = {
  data: HerbBatch[]
  loading: boolean
  error: Error | null
}

/** 订阅式获取全量批次列表（含本地覆盖层） */
export function useHerbBatches() {
  const [state, setState] = useState<State>({ data: [], loading: true, error: null })

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))
    try {
      const data = await listBatches()
      setState({ data, loading: false, error: null })
    } catch (e) {
      setState({ data: [], loading: false, error: e as Error })
    }
  }, [])

  useEffect(() => {
    load()
    const unsub = subscribeHerbChanged(() => {
      load()
    })
    return () => unsub()
  }, [load])

  return { ...state, reload: load }
}
