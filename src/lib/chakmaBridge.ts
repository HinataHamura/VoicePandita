import localChakmaPairs from '@/data/chakmaPairs.json'

export type ChakmaPair = {
  bn: string
  ccp: string
}

export type ChakmaBridgeContext = {
  enabled: boolean
  detectedLanguage: 'bn' | 'ccp'
  requestedLanguage: string
  questionForTutor: string
  inputMatch?: {
    bn: string
    ccp: string
    score: number
  }
  examples: ChakmaPair[]
  pairs: ChakmaPair[]
  source: 'disabled' | 'hf-dataset' | 'fallback'
}

type DatasetRow = {
  row?: {
    bn?: unknown
    ccp?: unknown
  }
}

type DatasetResponse = {
  rows?: DatasetRow[]
  num_rows_total?: number
}

const DATASET_ID = 'amlan107/chakma-nmt-base-parallel-dev-set'
const DATASET_CONFIG = 'default'
const DATASET_SPLIT = 'dev_val'
const ROWS_ENDPOINT = 'https://datasets-server.huggingface.co/rows'
const PAGE_SIZE = 100
const CHAKMA_CODE_ALIASES = new Set(['ccp', 'ckm', 'chakma'])

const FALLBACK_PAIRS: ChakmaPair[] = [
  { bn: 'তা কেমন করে ?', ccp: '𑄥𑄨𑄠𑄚𑄴 𑄈𑄬𑄚𑄨𑄇𑄴𑄇𑄬 𑄉𑄧𑄢𑄨 ?' },
  { bn: 'সুপ্রভাত', ccp: '𑄌𑄨𑄎𑄨 𑄝𑄨𑄚𑄳𑄚𑄬' },
  { bn: 'শিক্ষার হার', ccp: '𑄥𑄨𑄇𑄴𑄈𑄬 𑄦𑄢𑄴' },
  { bn: 'থাকা', ccp: '𑄗𑄚' },
  { bn: 'বাম দিকে ঘুরুন ।', ccp: '𑄝𑄟𑄴 𑄛𑄢𑄴𑄥𑄬 𑄊𑄪𑄢𑄪𑄚𑄴 ।' },
  { bn: 'কীভাবে এটা করতে পারলেন ?', ccp: '𑄈𑄬𑄚𑄨𑄇𑄴𑄇𑄬 𑄃𑄨𑄠𑄚𑄴 𑄉𑄧𑄢𑄨𑄝𑄢𑄴 𑄛𑄢𑄨𑄣𑄬𑄚𑄴 ?' },
  { bn: 'আমার জন্য কোন মেইল আছে ?', ccp: '𑄟𑄧𑄢𑄴 𑄟𑄭𑄘𑄬 𑄇𑄧𑄚𑄴 𑄟𑄬𑄭𑄣𑄴 𑄃𑄊𑄬 ?' },
  { bn: 'ধন্যবাদ ।', ccp: '𑄙𑄧𑄚𑄴𑄠𑄧𑄝𑄖𑄴 ।' },
  { bn: 'আমি পোস্ট অফিস খুঁজছি ।', ccp: '𑄃𑄟𑄨 𑄛𑄮𑄌𑄴𑄑𑄴 𑄃𑄧𑄜𑄨𑄌𑄴 𑄈𑄪𑄎𑄨𑄌𑄴𑄌𑄨 ।' },
  { bn: 'আমি যাব না ।', ccp: '𑄃𑄟𑄨 𑄡𑄟𑄴 𑄚𑄧 ।' },
  { bn: 'ফোন নম্বর কত ?', ccp: '𑄜𑄮𑄚𑄴 𑄚𑄟𑄴𑄝𑄧𑄢𑄴 𑄇𑄧𑄖𑄴𑄖𑄬 ?' },
  { bn: 'অনুগ্রহ করে ভিতরে আসুন ।', ccp: '𑄃𑄧𑄚𑄪𑄉𑄳𑄢𑄧𑄦𑄧 𑄉𑄧𑄢𑄨 𑄞𑄨𑄖𑄧𑄢𑄬 𑄃𑄥𑄪𑄚𑄴 ।' },
]

let pairCache: Promise<{ pairs: ChakmaPair[]; source: 'hf-dataset' | 'fallback' }> | null = null
const LOCAL_PAIRS = localChakmaPairs as ChakmaPair[]
const BENGALI_BLOCK_START = 0x0980
const BENGALI_BLOCK_END = 0x09FF

const BANGLA_TO_CHAKMA_SCRIPT: Record<string, string> = {
  অ: '𑄃',
  আ: '𑄃𑄧',
  ই: '𑄄',
  ঈ: '𑄄𑄨',
  উ: '𑄅',
  ঊ: '𑄅𑄪',
  ঋ: '𑄢𑄨',
  এ: '𑄆',
  ঐ: '𑄆𑄭',
  ও: '𑄃𑄮',
  ঔ: '𑄃𑄯',
  ক: '𑄇',
  খ: '𑄈',
  গ: '𑄉',
  ঘ: '𑄊',
  ঙ: '𑄋',
  চ: '𑄌',
  ছ: '𑄍',
  জ: '𑄎',
  ঝ: '𑄏',
  ঞ: '𑄐',
  ট: '𑄑',
  ঠ: '𑄒',
  ড: '𑄓',
  ঢ: '𑄔',
  ণ: '𑄕',
  ত: '𑄖',
  থ: '𑄗',
  দ: '𑄘',
  ধ: '𑄙',
  ন: '𑄚',
  প: '𑄛',
  ফ: '𑄜',
  ব: '𑄝',
  ভ: '𑄞',
  ম: '𑄟',
  য: '𑄡',
  র: '𑄢',
  ল: '𑄣',
  শ: '𑄥',
  ষ: '𑄥',
  স: '𑄥',
  হ: '𑄦',
  ড়: '𑄢',
  ঢ়: '𑄢',
  য়: '𑄠',
  '়': '',
  'ং': '𑄁',
  'ঃ': '𑄂',
  'ঁ': '𑄀',
  'া': '𑄧',
  'ি': '𑄨',
  'ী': '𑄩',
  'ু': '𑄪',
  'ূ': '𑄫',
  'ৃ': '𑄨',
  'ে': '𑄬',
  'ৈ': '𑄭',
  'ো': '𑄮',
  'ৌ': '𑄯',
  '্': '𑄴',
  '০': '𑄶',
  '১': '𑄷',
  '২': '𑄸',
  '৩': '𑄹',
  '৪': '𑄺',
  '৫': '𑄻',
  '৬': '𑄼',
  '৭': '𑄽',
  '৮': '𑄾',
  '৯': '𑄿',
  '।': '।',
}

export function isChakmaText(text: string) {
  for (const char of text) {
    const codePoint = char.codePointAt(0) || 0
    if (codePoint >= 0x11100 && codePoint <= 0x1114F) return true
  }
  return false
}

export function isChakmaLanguage(language: string) {
  return CHAKMA_CODE_ALIASES.has(language.trim().toLowerCase())
}

export function shouldUseChakmaBridge(question: string, language: string) {
  return isChakmaLanguage(language) || isChakmaText(question)
}

export function normalizeForMatch(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[।?!,;:"'‘’“”()[\]{}\-–—.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function rowToPair(row: DatasetRow): ChakmaPair | null {
  const bn = typeof row.row?.bn === 'string' ? row.row.bn.trim() : ''
  const ccp = typeof row.row?.ccp === 'string' ? row.row.ccp.trim() : ''
  if (!bn || !ccp) return null
  return { bn, ccp }
}

async function fetchDatasetPage(offset: number, length = PAGE_SIZE): Promise<DatasetResponse> {
  const params = new URLSearchParams({
    dataset: DATASET_ID,
    config: DATASET_CONFIG,
    split: DATASET_SPLIT,
    offset: String(offset),
    length: String(length),
  })
  const res = await fetch(`${ROWS_ENDPOINT}?${params.toString()}`, {
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 60 * 60 * 24 },
  })
  if (!res.ok) throw new Error(`HF dataset request failed: ${res.status}`)
  return res.json() as Promise<DatasetResponse>
}

async function fetchAllChakmaPairs() {
  const firstPage = await fetchDatasetPage(0)
  const total = firstPage.num_rows_total || firstPage.rows?.length || 0
  const maxRows = Number(process.env.CHAKMA_DATASET_MAX_ROWS || total || PAGE_SIZE)
  const cappedTotal = Math.max(0, Math.min(total, maxRows))
  const firstPairs = (firstPage.rows || []).map(rowToPair).filter((pair): pair is ChakmaPair => Boolean(pair))
  const offsets: number[] = []

  for (let offset = PAGE_SIZE; offset < cappedTotal; offset += PAGE_SIZE) {
    offsets.push(offset)
  }

  const pages: DatasetResponse[] = []
  for (let index = 0; index < offsets.length; index += 6) {
    const batch = offsets.slice(index, index + 6)
    pages.push(...await Promise.all(batch.map(offset => fetchDatasetPage(offset, PAGE_SIZE))))
  }

  const fetchedPairs = pages.flatMap(page =>
    (page.rows || []).map(rowToPair).filter((pair): pair is ChakmaPair => Boolean(pair))
  )
  const seen = new Set<string>()

  return [...firstPairs, ...fetchedPairs].filter(pair => {
    const key = `${pair.bn}\n${pair.ccp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function loadChakmaPairs() {
  if (process.env.CHAKMA_DATASET_REMOTE_REFRESH !== '1' && LOCAL_PAIRS.length) {
    return { pairs: LOCAL_PAIRS, source: 'hf-dataset' as const }
  }

  pairCache ??= fetchAllChakmaPairs()
    .then(pairs => ({ pairs: pairs.length ? pairs : FALLBACK_PAIRS, source: pairs.length ? 'hf-dataset' as const : 'fallback' as const }))
    .catch(err => {
      console.warn('Chakma dataset unavailable; using fallback pairs', err instanceof Error ? err.message : err)
      return { pairs: FALLBACK_PAIRS, source: 'fallback' as const }
    })

  return pairCache
}

function tokenScore(a: string, b: string) {
  const aTokens = new Set(normalizeForMatch(a).split(' ').filter(Boolean))
  const bTokens = new Set(normalizeForMatch(b).split(' ').filter(Boolean))
  if (!aTokens.size || !bTokens.size) return 0
  let overlap = 0
  aTokens.forEach(token => {
    if (bTokens.has(token)) overlap += 1
  })
  return (2 * overlap) / (aTokens.size + bTokens.size)
}

function charBigrams(value: string) {
  const compact = normalizeForMatch(value).replace(/\s+/g, '')
  if (compact.length <= 1) return compact ? [compact] : []
  const bigrams: string[] = []
  for (let index = 0; index < compact.length - 1; index += 1) {
    bigrams.push(compact.slice(index, index + 2))
  }
  return bigrams
}

function diceScore(a: string, b: string) {
  const aBigrams = charBigrams(a)
  const bBigrams = charBigrams(b)
  if (!aBigrams.length || !bBigrams.length) return 0
  const counts = new Map<string, number>()
  aBigrams.forEach(item => counts.set(item, (counts.get(item) || 0) + 1))
  let overlap = 0
  bBigrams.forEach(item => {
    const count = counts.get(item) || 0
    if (count > 0) {
      overlap += 1
      counts.set(item, count - 1)
    }
  })
  return (2 * overlap) / (aBigrams.length + bBigrams.length)
}

function similarity(query: string, candidate: string) {
  const q = normalizeForMatch(query)
  const c = normalizeForMatch(candidate)
  if (!q || !c) return 0
  if (q === c) return 1
  if (q.includes(c) || c.includes(q)) return 0.9
  return Math.max(tokenScore(query, candidate), diceScore(query, candidate))
}

export function findClosestPair(
  query: string,
  sourceLanguage: 'bn' | 'ccp',
  pairs: ChakmaPair[],
  minScore = 0.42
) {
  let best: { pair: ChakmaPair; score: number } | null = null
  for (const pair of pairs) {
    const candidate = sourceLanguage === 'ccp' ? pair.ccp : pair.bn
    const score = similarity(query, candidate)
    if (!best || score > best.score) best = { pair, score }
  }
  return best && best.score >= minScore ? best : null
}

export function selectChakmaExamples(query: string, pairs: ChakmaPair[], limit = 12) {
  const scored = pairs
    .map(pair => ({ pair, score: Math.max(similarity(query, pair.bn), similarity(query, pair.ccp)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.pair)

  const common = ['সুপ্রভাত', 'ধন্যবাদ', 'কীভাবে এটা করতে পারলেন ?', 'আমি যাব না ।']
    .map(text => pairs.find(pair => pair.bn === text))
    .filter((pair): pair is ChakmaPair => Boolean(pair))

  const seen = new Set<string>()
  return [...scored, ...common].filter(pair => {
    const key = `${pair.bn}\n${pair.ccp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)
}

export function formatChakmaExamples(pairs: ChakmaPair[]) {
  return pairs.map(pair => `Bangla: ${pair.bn}\nChakma: ${pair.ccp}`).join('\n\n')
}

export async function prepareChakmaBridge(question: string, language: string): Promise<ChakmaBridgeContext> {
  if (!shouldUseChakmaBridge(question, language)) {
    return {
      enabled: false,
      detectedLanguage: 'bn',
      requestedLanguage: language,
      questionForTutor: question,
      examples: [],
      pairs: [],
      source: 'disabled',
    }
  }

  const { pairs, source } = await loadChakmaPairs()
  const detectedLanguage = isChakmaText(question) ? 'ccp' : 'bn'
  const inputMatch = findClosestPair(question, detectedLanguage, pairs, detectedLanguage === 'ccp' ? 0.5 : 0.76)
  const questionForTutor = detectedLanguage === 'ccp' && inputMatch ? inputMatch.pair.bn : question

  return {
    enabled: true,
    detectedLanguage,
    requestedLanguage: language,
    questionForTutor,
    inputMatch: inputMatch ? { ...inputMatch.pair, score: inputMatch.score } : undefined,
    examples: selectChakmaExamples(questionForTutor || question, pairs),
    pairs,
    source,
  }
}

export function translateBanglaWithDataset(answer: string, pairs: ChakmaPair[]) {
  let translated = answer
  const usefulPairs = pairs
    .filter(pair => pair.bn.length > 1 && pair.ccp.length > 1)
    .sort((a, b) => b.bn.length - a.bn.length)
    .slice(0, 800)

  for (const pair of usefulPairs) {
    if (translated.includes(pair.bn)) translated = translated.split(pair.bn).join(pair.ccp)
  }

  return transliterateRemainingBangla(translated)
}

function hasBanglaScript(value: string) {
  for (const char of value) {
    const codePoint = char.codePointAt(0) || 0
    if (codePoint >= BENGALI_BLOCK_START && codePoint <= BENGALI_BLOCK_END) return true
  }
  return false
}

function transliterateRemainingBangla(value: string) {
  if (!hasBanglaScript(value)) return value
  let output = ''

  for (const char of value) {
    const codePoint = char.codePointAt(0) || 0
    if (codePoint >= BENGALI_BLOCK_START && codePoint <= BENGALI_BLOCK_END) {
      output += BANGLA_TO_CHAKMA_SCRIPT[char] ?? char
    } else {
      output += char
    }
  }

  return output
}
