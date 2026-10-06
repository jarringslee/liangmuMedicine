export type HerbQuestionCitation = {
  id: string
  kind: 'batch' | 'knowledge'
  title: string
  excerpt: string
  publisher: string
  url: string | null
}

export type HerbQuestionReply = {
  id: string
  batchId: string
  question: string
  status: 'answered' | 'insufficient'
  answer: string
  citations: HerbQuestionCitation[]
  mode: 'api' | 'demo'
  modelName: string | null
  retrieval: 'bm25' | 'demo'
  knowledgeVersion: string
  createdAt: string
}
