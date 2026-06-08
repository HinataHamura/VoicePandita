export interface OfflineConcept {
  question: string
  keywords: string[]
  answer: string
  visualPath: string[]
}

export interface OfflineSearchResult {
  concept: OfflineConcept
  score: number
}

const SUBJECT_FILES = ['physics', 'chemistry', 'biology', 'math'] as const

const FALLBACK_CONCEPTS: OfflineConcept[] = [
  {
    question: "Newton's second law ki?",
    keywords: ['newton', 'second law', 'force', 'mass', 'acceleration', 'f=ma', 'bol', 'vor', 'toron'],
    answer: "Newton-er second law bole, kono bostur upor net force porle tar acceleration hoy. Formula F = ma, mane force = mass x acceleration. Mass eki thakle force beshi hole acceleration beshi hoy.",
    visualPath: ['Physics', 'Motion', "Newton's Second Law"],
  },
  {
    question: 'Photosynthesis process bujhao',
    keywords: ['photosynthesis', 'salok', 'plant', 'glucose', 'oxygen', 'sunlight', 'chlorophyll'],
    answer: 'Photosynthesis holo process jekhane green plant sunlight, carbon dioxide, ar water use kore glucose toyri kore, ar oxygen release kore. Chlorophyll light energy dhore ei kaj korte help kore.',
    visualPath: ['Biology', 'Plant Physiology', 'Photosynthesis'],
  },
  {
    question: 'Acid base ki?',
    keywords: ['acid', 'base', 'ph', 'amlo', 'khar', 'neutralization'],
    answer: 'Acid pani te H+ ion baray, ar base OH- ion baray. pH 7 er niche acid, pH 7 er upore base. Acid ar base mile salt ar water toyri korle take neutralization bole.',
    visualPath: ['Chemistry', 'Chemical Reactions', 'Acid Base'],
  },
  {
    question: 'Trigonometry basic ratio ki?',
    keywords: ['trigonometry', 'sin', 'cos', 'tan', 'triangle', 'trikon'],
    answer: 'Right triangle-e sin theta = opposite/hypotenuse, cos theta = adjacent/hypotenuse, ar tan theta = opposite/adjacent. Ei ratio diye angle ar side-er relation ber kora hoy.',
    visualPath: ['Math', 'Geometry', 'Trigonometry'],
  },
]

const TRANSLITERATION: Record<string, string[]> = {
  bol: ['force', 'বল'],
  vor: ['mass', 'ভর'],
  toron: ['acceleration', 'ত্বরণ'],
  salok: ['photosynthesis', 'সালোকসংশ্লেষণ'],
  glucose: ['গ্লুকোজ', 'sugar', 'শর্করা'],
  acid: ['অম্ল'],
  base: ['ক্ষার'],
  kaj: ['work', 'কাজ'],
  shokti: ['energy', 'শক্তি'],
  bidyut: ['electricity', 'বিদ্যুৎ'],
  trikon: ['trigonometry', 'ত্রিকোণমিতি'],
}

let cachedConcepts: OfflineConcept[] | null = null

function normalize(value: string) {
  let text = value.toLowerCase().normalize('NFKC')
  for (const [roman, aliases] of Object.entries(TRANSLITERATION)) {
    if (text.includes(roman)) text += ` ${aliases.join(' ')}`
  }
  return text.replace(/[^\w\u0980-\u09FF\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokens(value: string) {
  return normalize(value).split(/\s+/).filter(token => token.length > 1)
}

function similarity(a: string, b: string) {
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.75
  const min = Math.min(a.length, b.length)
  let same = 0
  for (let i = 0; i < min; i += 1) if (a[i] === b[i]) same += 1
  return same / Math.max(a.length, b.length)
}

async function loadOfflineConcepts(baseUrl = '') {
  if (cachedConcepts) return cachedConcepts
  const batches = await Promise.all(SUBJECT_FILES.map(async subject => {
    try {
      const res = await fetch(`${baseUrl}/offline-data/${subject}.json`)
      if (!res.ok) return []
      return (await res.json()) as OfflineConcept[]
    } catch {
      return []
    }
  }))
  const loaded = batches.flat()
  cachedConcepts = loaded.length > 0 ? loaded : FALLBACK_CONCEPTS
  return cachedConcepts
}

export async function searchOffline(query: string, options?: { baseUrl?: string; limit?: number }) {
  const concepts = await loadOfflineConcepts(options?.baseUrl || '')
  const normalizedQuery = normalize(query)
  const queryTokens = tokens(query)
  const queryTokenSet = new Set(queryTokens)
  const scored = concepts.map(concept => {
    const priorityTerms = [concept.question, ...concept.keywords, ...concept.visualPath]
    const haystack = tokens([concept.question, concept.answer, concept.visualPath.join(' '), concept.keywords.join(' ')].join(' '))
    let score = 0
    for (const term of priorityTerms) {
      const normalizedTerm = normalize(term)
      if (!normalizedTerm) continue
      const termTokens = tokens(term)
      const isShortSingleToken = termTokens.length === 1 && termTokens[0].length <= 3
      if (isShortSingleToken) {
        if (queryTokenSet.has(termTokens[0])) score += 8
      } else if (normalizedQuery.includes(normalizedTerm) || normalizedTerm.includes(normalizedQuery)) {
        score += 8
      }
    }
    for (const token of queryTokens) {
      if (haystack.includes(token)) {
        score += 2
        continue
      }
      const best = Math.max(0, ...haystack.map(candidate => similarity(candidate, token)))
      score += token.length >= 4 ? best * 0.35 : 0
    }
    return { concept, score }
  })
  return scored
    .filter(item => item.score > 0.8)
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.limit || 3)
}

export function buildOfflineAnswer(result: OfflineSearchResult | undefined, query: string) {
  if (!result) {
    return {
      answer: `Offline Mode: "${query}" নিয়ে local cache-এ exact match পেলাম না। Newton's laws, photosynthesis, minerals, cell, force, work, energy, electricity, acid-base, বা trigonometry নিয়ে প্রশ্ন করলে cached answer দিতে পারব।`,
      graphPath: ['Offline Curriculum', 'Needs Online Sync', 'No exact cache match'],
      diagram: 'graph LR\n  A[প্রশ্ন] --> B[Local cache search]\n  B --> C[Exact match নেই]\n  C --> D[Online হলে RAG ব্যবহার হবে]',
    }
  }

  const title = result.concept.visualPath[result.concept.visualPath.length - 1] || result.concept.question
  return {
    answer: `Offline Learning Mode: ${result.concept.answer}\n\nUsing locally cached curriculum. Online হলে GraphRAG + Gemini দিয়ে আরও গভীর ব্যাখ্যা দেওয়া হবে।`,
    graphPath: result.concept.visualPath,
    diagram: `graph LR\n  A[${title}] --> B[মূল ধারণা]\n  A --> C[উদাহরণ]\n  A --> D[ব্যবহার]\n  B --> E[বোঝা]\n  C --> E\n  D --> E`,
  }
}
