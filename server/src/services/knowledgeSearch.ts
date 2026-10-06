import { knowledgeChunks } from '../knowledge/herbs.js'

export type QuestionSource = {
  id: string
  kind: 'batch' | 'knowledge'
  title: string
  excerpt: string
  publisher: string
  url: string | null
}

// 中文用双字片段，英文用单词；这是词法检索，不是语义 Embedding。
function tokenize(text: string): string[] {
  const normalized = text.normalize('NFKC').toLowerCase()
  const result: string[] = normalized.match(/[a-z0-9]+/g) ?? []
  for (const segment of normalized.match(/\p{Script=Han}+/gu) ?? []) {
    for (let index = 0; index < segment.length - 1; index++) {
      result.push(segment.slice(index, index + 2))
    }
  }
  return result
}

/** 知识只召回所选药材；通用产区不能冒充这个批次的实际产地。 */
export function getHerbKnowledge(herbName: string): QuestionSource[] {
  return knowledgeChunks
    .filter((chunk) => chunk.herbName === herbName.trim())
    .map((chunk) => ({
      id: chunk.id, kind: 'knowledge', title: chunk.title,
      excerpt: chunk.content, publisher: chunk.publisher, url: chunk.url,
    }))
}

export function retrieveQuestionSources(
  question: string,
  herbName: string,
  batchSources: QuestionSource[],
): QuestionSource[] {
  const documents = [...batchSources, ...getHerbKnowledge(herbName)]
  let query = question.replaceAll(herbName.trim(), '')
  // 少量可解释的词法扩展；不把它称为语义理解。
  if (/产地|哪里|哪儿|来自|产区/.test(query)) query += ' 产地 来源'
  if (/外观|样子|颜色|形状|长什么/.test(query)) query += ' 外观'
  if (/叫什么|哪味|什么药材|名称/.test(query)) query += ' 药材名称'
  if (/介绍|概况|是什么/.test(query)) query += ' 来源 类别'
  if (/质检|检测|检验/.test(query)) query += ' 质检'
  if (/目前|现在|到哪|流程|进度/.test(query)) query += ' 当前阶段 状态'
  const terms = [...new Set(tokenize(query))]
  const indexed = documents.map((source) => {
    const tokens = tokenize(`${source.title} ${source.excerpt}`)
    const frequencies = new Map<string, number>()
    for (const term of tokens) frequencies.set(term, (frequencies.get(term) ?? 0) + 1)
    return { source, frequencies, length: tokens.length }
  })
  const averageLength = indexed.reduce((total, item) => total + item.length, 0) / indexed.length || 1
  const k1 = 1.2, b = 0.75
  // BM25：词频饱和、逆文档频率和长度归一化，保留最多 6 个真正命中的片段。
  return indexed.map((item) => {
    let score = 0
    for (const term of terms) {
      const frequency = item.frequencies.get(term) ?? 0
      if (!frequency) continue
      const documentFrequency = indexed.filter((document) => document.frequencies.has(term)).length
      const idf = Math.log(1 + (indexed.length - documentFrequency + 0.5) / (documentFrequency + 0.5))
      score += idf * frequency * (k1 + 1)
        / (frequency + k1 * (1 - b + b * item.length / averageLength))
    }
    return { source: item.source, score }
  }).filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.source.id.localeCompare(right.source.id))
    .slice(0, 6).map((item) => item.source)
}
