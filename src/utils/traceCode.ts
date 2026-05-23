/** 溯源码（traceCode）解析与校验工具 */

export const TRACE_CODE_REGEX = /^YM-TRACE-\d{4}-[A-Z0-9-]+$/i

/** 是否符合溯源码格式 */
export function isTraceCode(text: string): boolean {
  return TRACE_CODE_REGEX.test(text.trim())
}

/**
 * 从扫描/输入文本中提取溯源码
 * 支持：
 * - 完整 URL（含 `/trace/<code>` 片段）
 * - 裸溯源码（如 `YM-TRACE-2026-0001`）
 * 返回大写后的溯源码；无法识别时返回 null。
 */
export function extractTraceCode(text: string | null | undefined): string | null {
  if (!text) return null
  const trimmed = text.trim()
  if (!trimmed) return null

  const urlMatch = trimmed.match(/\/trace\/([A-Za-z0-9-]+)/)
  if (urlMatch && urlMatch[1]) return urlMatch[1].toUpperCase()

  if (TRACE_CODE_REGEX.test(trimmed)) return trimmed.toUpperCase()

  return null
}
