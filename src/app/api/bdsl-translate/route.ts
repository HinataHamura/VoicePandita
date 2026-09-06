import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import { readFile } from 'fs/promises'
import path from 'path'
import { geminiTextModels, groqModel } from '@/lib/ai/models'

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null
const groqKey = process.env.GROQ_API_KEY?.trim()
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null

type TranslationItem = {
  word: string
  candidates: string[]
  matched?: {
    english: string
    gloss: string
    sigmlPath: string
    category: string
  }
}

type DatasetEntry = {
  gloss: string
  english: string
  category: string
  sigmlPath: string
}

async function generateText(prompt: string) {
  const models = geminiTextModels()

  if (genAI) {
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        return result.response.text().trim()
      } catch (err) {
        console.warn(`/api/bdsl-translate Gemini failed: ${modelName}`, err instanceof Error ? err.message : err)
      }
    }
  }

  if (groq) {
    try {
      const result = await groq.chat.completions.create({
        model: groqModel(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      })
      return result.choices[0]?.message?.content?.trim() || null
    } catch (err) {
      console.warn('/api/bdsl-translate Groq failed:', err instanceof Error ? err.message : err)
    }
  }

  return null
}

function extractJson(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as { translations?: TranslationItem[] }
  } catch {
    return null
  }
}

const cleanWord = (word: unknown) =>
  typeof word === 'string'
    ? word.normalize('NFC').replace(/[^\u0980-\u09FFa-zA-Z0-9\s-]/g, '').trim().slice(0, 40)
    : ''

const norm = (value: string) =>
  value.normalize('NFC').toLowerCase().replace(/[^\u0980-\u09FFa-z0-9]/g, '')

const EN_SUFFIXES = [
  'tion','sion','ness','ment','ings','ers','ies',
  'ing','ed','er','es','ly','al','ful','less','s','e',
]

let signIndexPromise: Promise<Map<string, DatasetEntry[]>> | null = null

function addIndexEntry(index: Map<string, DatasetEntry[]>, key: string, entry: DatasetEntry) {
  const n = norm(key)
  if (!n) return
  const current = index.get(n) ?? []
  current.push(entry)
  index.set(n, current)
}

async function loadSignIndex() {
  if (signIndexPromise) return signIndexPromise

  signIndexPromise = readFile(path.join(process.cwd(), 'public', 'data', 'Sections', 'dataset.json'), 'utf8')
    .then((raw) => JSON.parse(raw) as Array<Record<string, string>>)
    .then((items) => {
      const index = new Map<string, DatasetEntry[]>()
      for (const item of items) {
        const entry: DatasetEntry = {
          gloss: String(item.gloss || item.english || '').trim(),
          english: String(item.english || item.gloss || '').trim(),
          category: String(item.sectionEn || item.category || 'Unknown').trim(),
          sigmlPath: String(item.sigmlPath || '').trim(),
        }
        if (!entry.english && !entry.gloss) continue
        addIndexEntry(index, entry.english, entry)
        addIndexEntry(index, entry.gloss, entry)
      }
      return index
    })
    .catch(() => new Map<string, DatasetEntry[]>())

  return signIndexPromise
}

function suffixCandidates(value: string) {
  const n = norm(value)
  const stems: string[] = []
  for (const suffix of EN_SUFFIXES) {
    if (n.length > suffix.length + 3 && n.endsWith(suffix)) {
      const stem = n.slice(0, -suffix.length)
      stems.push(stem, `${stem}e`, `${stem}y`, `${stem}i`)
    }
  }
  return stems
}

function preferPlayable(entries: DatasetEntry[] | undefined) {
  if (!entries?.length) return null
  return entries.find(entry => entry.sigmlPath) ?? entries[0]
}

function findDatasetMatch(index: Map<string, DatasetEntry[]>, candidates: string[]) {
  for (const candidate of candidates) {
    const direct = preferPlayable(index.get(norm(candidate)))
    if (direct) return direct

    for (const stem of suffixCandidates(candidate)) {
      const stemmed = preferPlayable(index.get(stem))
      if (stemmed) return stemmed
    }
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const words = Array.isArray(body.words)
      ? Array.from(new Set(body.words.map(cleanWord).filter(Boolean))).slice(0, 12)
      : []
    const context = typeof body.context === 'string' ? body.context.slice(0, 500) : ''

    if (words.length === 0) {
      return NextResponse.json({ translations: [] })
    }

    if (!genAI && !groq) {
      return NextResponse.json({ translations: [], source: 'no-llm-key' })
    }

    const prompt = `Translate these Bangla/Bengali lesson words into short English sign-dictionary lookup candidates.

Words: ${words.join(', ')}
Context: ${context || 'none'}

Return ONLY valid JSON:
{
  "translations": [
    { "word": "original word", "candidates": ["English lemma", "simpler synonym", "related base concept"] }
  ]
}

Rules:
- Keep each candidate 1 or 2 English words.
- Use base dictionary words, not full sentence translation.
- Prefer concrete signable concepts from school lessons.
- For inflected Bengali words, return the root concept.
- Examples: "আকারে" -> ["Shape", "Form"], "বাষ্পীভূত" -> ["Evaporate", "Steam"], "বায়ুমণ্ডলের" -> ["Air", "Sky"], "উপরের" -> ["Up"], "দিকে" -> ["Side", "Direction"]`

    const raw = await generateText(prompt)
    const parsed = raw ? extractJson(raw) : null
    const signIndex = await loadSignIndex()
    let translations: TranslationItem[] = []

    if (Array.isArray(parsed?.translations)) {
      const resolvedTranslations = await Promise.all(
        parsed.translations.map(async (item) => {
          const word = cleanWord(item.word)
          const rawCandidates = Array.isArray(item.candidates)
            ? item.candidates.map(cleanWord).filter(Boolean).slice(0, 5)
            : []
          const matched = findDatasetMatch(signIndex, rawCandidates)
          const candidates = matched
            ? Array.from(new Set([matched.english, matched.gloss, ...rawCandidates].filter(Boolean))).slice(0, 5)
            : rawCandidates

          return {
            word,
            candidates,
            matched: matched
              ? {
                  english: matched.english,
                  gloss: matched.gloss,
                  sigmlPath: matched.sigmlPath,
                  category: matched.category,
                }
              : undefined,
          }
        }),
      )

      translations = resolvedTranslations.filter((item) => item.word && item.candidates.length > 0)
    }

    return NextResponse.json({ translations, source: genAI ? 'gemini' : 'groq' })
  } catch (err) {
    return NextResponse.json(
      { translations: [], error: err instanceof Error ? err.message : 'Translation failed' },
      { status: 500 },
    )
  }
}
