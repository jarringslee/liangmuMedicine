export type SseMessage = { event: string; data: unknown }
export class SseProtocolError extends Error {}

/** UTF-8 字节块不等于 SSE 消息：中文、换行和 JSON 都可能跨 read() 分块。 */
export async function readSseMessages(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onMessage: (message: SseMessage) => boolean,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let buffer = '', event = 'message', data: string[] = [], frameSize = 0
  const abort = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', abort, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      try { buffer += decoder.decode(value, { stream: !done }) } catch {
        throw new SseProtocolError('事件流包含无效 UTF-8 文本')
      }
      if (buffer.length + frameSize > 128_000) throw new SseProtocolError('事件流消息超过大小限制')
      while (true) {
        const newline = /\r\n|\r|\n/.exec(buffer)
        if (!newline) break
        // CRLF 可能跨字节块；末尾单独的 CR 先等下一块。
        if (!done && newline[0] === '\r' && newline.index + 1 === buffer.length) break
        const line = buffer.slice(0, newline.index)
        buffer = buffer.slice(newline.index + newline[0].length)
        if (line === '') {
          if (data.length) {
            let parsed: unknown
            try { parsed = JSON.parse(data.join('\n')) } catch {
              throw new SseProtocolError('事件流消息不是有效 JSON')
            }
            signal.throwIfAborted()
            if (onMessage({ event, data: parsed })) return
          }
          event = 'message'; data = []; frameSize = 0
          continue
        }
        frameSize += line.length
        if (frameSize > 128_000) throw new SseProtocolError('事件流消息超过大小限制')
        if (line.startsWith(':')) continue // 心跳注释不是业务进度。
        const colon = line.indexOf(':')
        const field = colon === -1 ? line : line.slice(0, colon)
        let text = colon === -1 ? '' : line.slice(colon + 1)
        if (text.startsWith(' ')) text = text.slice(1)
        if (field === 'event') event = text || 'message'
        if (field === 'data') data.push(text)
      }
      // 没有空行结束的尾帧不派发；业务层还必须确认收到 result。
      if (done) return
    }
  } finally {
    signal.removeEventListener('abort', abort)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
