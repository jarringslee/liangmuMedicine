/** 构建当前站点下的公开溯源分享链接。 */
export function buildTraceUrl(traceCode: string): string {
  const code = traceCode.trim().toUpperCase()
  const path = `/public/trace/${encodeURIComponent(code)}`

  if (typeof window === 'undefined') return path

  return `${window.location.origin}${path}`
}