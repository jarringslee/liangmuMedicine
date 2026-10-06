import { authMode } from '../config/api'
import { apiRequest } from './api'
import { listHerbBatches } from './herbDataSource'
import { parseDashboardOverview } from './dashboardContract'
import { buildDemoDashboardOverview } from '../utils/dashboard'

export async function getDashboardOverview(signal?: AbortSignal) {
  signal?.throwIfAborted()
  if (authMode === 'demo') {
    const batches = await listHerbBatches()
    signal?.throwIfAborted()
    return parseDashboardOverview(buildDemoDashboardOverview(batches), 'demo')
  }
  const result = await apiRequest<unknown>('/dashboard/overview', { signal })
  return parseDashboardOverview(result, 'api')
}
