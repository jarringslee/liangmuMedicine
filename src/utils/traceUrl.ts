/** 构建当前站点下的溯源详情链接 */
export function buildTraceUrl(traceCode: string): string {
  if (typeof window === 'undefined') return `/trace/${traceCode}`
  const base = window.location.origin
  return `${base}/trace/${traceCode}`
}
