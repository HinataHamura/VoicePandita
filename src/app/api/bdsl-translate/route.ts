import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null
const groqKey = process.env.GROQ_API_KEY?.trim()
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null

type TranslationItem = {
  word: string
  candidates: string[]
}

async function generateText(prompt: string) {
  const models = process.env.GEMINI_MODEL?.trim()
    ? [process.env.GEMINI_MODEL.trim(), 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']
    : ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']

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
        model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
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
    const translations = Array.isArray(parsed?.translations)
      ? parsed.translations
          .map((item) => ({
            word: cleanWord(item.word),
            candidates: Array.isArray(item.candidates)
              ? item.candidates.map(cleanWord).filter(Boolean).slice(0, 5)
              : [],
          }))
          .filter((item) => item.word && item.candidates.length > 0)
      : []

    return NextResponse.json({ translations, source: genAI ? 'gemini' : 'groq' })
  } catch (err) {
    return NextResponse.json(
      { translations: [], error: err instanceof Error ? err.message : 'Translation failed' },
      { status: 500 },
    )
  }
}
