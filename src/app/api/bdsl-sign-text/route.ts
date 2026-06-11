import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null
const groqKey = process.env.GROQ_API_KEY?.trim()
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null

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
        console.warn(`/api/bdsl-sign-text Gemini failed: ${modelName}`, err instanceof Error ? err.message : err)
      }
    }
  }

  if (groq) {
    try {
      const result = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 320,
      })
      return result.choices[0]?.message?.content?.trim() || null
    } catch (err) {
      console.warn('/api/bdsl-sign-text Groq failed:', err instanceof Error ? err.message : err)
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
    return JSON.parse(cleaned.slice(start, end + 1)) as { signText?: string; keywords?: string[] }
  } catch {
    return null
  }
}

function cleanForSignText(value: string) {
  return value
    .normalize('NFC')
    .replace(/\*\*|__|`|#{1,6}/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\u0980-\u09FFa-zA-Z0-9\s।.!?-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function localSignText(answer: string) {
  const clean = cleanForSignText(answer)
  const sentences = clean.split(/[।.!?]+/).map(item => item.trim()).filter(Boolean)
  const firstUseful = sentences.find(item => item.length >= 18) || sentences[0] || clean
  return firstUseful.split(/\s+/).slice(0, 28).join(' ')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const answer = typeof body.answer === 'string' ? cleanForSignText(body.answer).slice(0, 2400) : ''

    if (!answer) {
      return NextResponse.json({ signText: '', source: 'empty' })
    }

    if (!genAI && !groq) {
      return NextResponse.json({ signText: localSignText(answer), source: 'local-fallback' })
    }

    const prompt = `You are preparing text ONLY for a Bangladeshi Sign Language avatar.

Convert the tutor answer into a very short, easy, sign-friendly Bangla answer.

Original answer:
${answer}

Return ONLY valid JSON:
{
  "signText": "short sign-friendly answer",
  "keywords": ["keyword1", "keyword2"]
}

Rules:
- Do not answer with the full lesson.
- Keep signText under 28 words.
- Use simple Bangla words and common school concepts.
- Prefer concrete signable words: water, sun, rain, heat, air, cloud, plant, force, mass, acceleration.
- Remove markdown, numbering, formulas, citations, and difficult clauses.
- If the answer is complex, keep only the main idea and 3-6 key concepts.
- Do not change the visible LMS/chat answer. This text is only for avatar signing.`

    const raw = await generateText(prompt)
    const parsed = raw ? extractJson(raw) : null
    const signText = cleanForSignText(parsed?.signText || '').split(/\s+/).slice(0, 32).join(' ')

    return NextResponse.json({
      signText: signText || localSignText(answer),
      keywords: Array.isArray(parsed?.keywords) ? parsed.keywords.map(String).slice(0, 8) : [],
      source: genAI ? 'gemini' : 'groq',
    })
  } catch (err) {
    return NextResponse.json(
      { signText: '', error: err instanceof Error ? err.message : 'Could not prepare sign text' },
      { status: 500 },
    )
  }
}
