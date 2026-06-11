import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { embedWithOllama } from '@/lib/ai/ollama'

export interface OfflineCurriculumChunk {
  conceptKey: string
  subject: string
  classLevel: string
  title: string
  content: string
  examples: string[]
  keywords: string[]
}

export interface OfflineSearchResult {
  chunk: OfflineCurriculumChunk
  score: number
  ranker: 'keyword' | 'keyword+embedding'
}

const PACK_DIR = path.join(process.cwd(), 'public', 'offline-packs')
const PACK_FILES = ['class-9-physics.json']
const MIN_CURRICULUM_KEYWORD_SCORE = 18

let cachedPacks: OfflineCurriculumChunk[] | null = null

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\w\u0980-\u09FF\s=]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(value: string) {
  return normalize(value).split(/\s+/).filter(token => token.length > 1)
}

function dot(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length)
  let sum = 0
  for (let index = 0; index < length; index += 1) sum += a[index] * b[index]
  return sum
}

function magnitude(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
}

function cosineSimilarity(a: number[], b: number[]) {
  const divisor = magnitude(a) * magnitude(b)
  return divisor === 0 ? 0 : dot(a, b) / divisor
}

function keywordScore(question: string, chunk: OfflineCurriculumChunk) {
  const questionText = normalize(question)
  const questionTokens = new Set(tokens(question))
  const priority = [chunk.title, chunk.conceptKey, ...chunk.keywords]
  const haystack = normalize([chunk.title, chunk.content, chunk.examples.join(' '), chunk.keywords.join(' ')].join(' '))
  let score = 0

  for (const term of priority) {
    const normalizedTerm = normalize(term)
    if (!normalizedTerm) continue
    if (questionText.includes(normalizedTerm) || normalizedTerm.includes(questionText)) score += 8
    for (const token of tokens(term)) {
      if (questionTokens.has(token)) score += 3
    }
  }

  for (const token of Array.from(questionTokens)) {
    if (haystack.includes(token)) score += 2
  }

  return score
}

async function readPack(fileName: string) {
  const filePath = path.join(PACK_DIR, fileName)
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isOfflineChunk)
}

function isOfflineChunk(value: unknown): value is OfflineCurriculumChunk {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.conceptKey === 'string' &&
    typeof item.subject === 'string' &&
    typeof item.classLevel === 'string' &&
    typeof item.title === 'string' &&
    typeof item.content === 'string' &&
    Array.isArray(item.examples) &&
    Array.isArray(item.keywords)
  )
}

export async function loadOfflinePacks() {
  if (cachedPacks) return cachedPacks
  const batches = await Promise.all(PACK_FILES.map(file => readPack(file).catch(() => [])))
  cachedPacks = batches.flat()
  return cachedPacks
}

export async function searchOfflineCurriculum(question: string, subject?: string, classLevel?: string) {
  const packs = await loadOfflinePacks()
  const scoped = packs.filter(chunk => {
    const subjectOk = subject ? chunk.subject.toLowerCase() === subject.toLowerCase() : true
    const classOk = classLevel ? chunk.classLevel === classLevel : true
    return subjectOk && classOk
  })

  const keywordRanked: OfflineSearchResult[] = scoped
    .map(chunk => ({ chunk, score: keywordScore(question, chunk), ranker: 'keyword' as const }))
    .filter(result => result.score >= MIN_CURRICULUM_KEYWORD_SCORE)
    .sort((a, b) => b.score - a.score)

  if (!keywordRanked.length) return []

  const candidates = keywordRanked.slice(0, 6)

  try {
    const questionEmbedding = await embedWithOllama(question, { timeoutMs: 3000 })
    const enriched = await Promise.all(candidates.map(async result => {
      const text = [result.chunk.title, result.chunk.content, result.chunk.keywords.join(' ')].join('\n')
      const chunkEmbedding = await embedWithOllama(text, { timeoutMs: 3000 })
      return {
        ...result,
        score: result.score + cosineSimilarity(questionEmbedding, chunkEmbedding) * 10,
        ranker: 'keyword+embedding' as const,
      }
    }))
    return enriched.sort((a, b) => b.score - a.score).slice(0, 3)
  } catch {
    return keywordRanked.slice(0, 3)
  }
}
