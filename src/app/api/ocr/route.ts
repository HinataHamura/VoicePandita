import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { cleanOcrText, imageFileToGenerativePart, validateImageFile } from '@/lib/ocr'

const OCR_PROMPT =
  'Extract all readable educational text from this image. Preserve important headings, questions, equations, labels, and bullet points. Do not answer the content. Do not explain. Return only the extracted text. If some parts are unclear, return only the readable parts.'

const fallbackPayload = {
  success: false,
  text: '',
  source: 'fallback',
  needsReview: true,
  error: 'Could not extract text clearly. Please type or edit the question manually.',
}

const OCR_MIN_INTERVAL_MS = 2500
const OCR_MAX_RETRIES = 2

let ocrQueue = Promise.resolve()
let lastOcrStartedAt = 0

function getVisionModelCandidates() {
  return [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    process.env.GEMINI_VISION_MODEL?.trim(),
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ].filter((model, index, models): model is string => Boolean(model) && models.indexOf(model) === index)
}

function friendlyOcrError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('429') || normalized.includes('too many requests') || normalized.includes('quota')) {
    return 'Gemini OCR quota/rate limit reached. Image theke text extract kora jacche na ekhon. Please text ta manually paste/type kore question korun.'
  }
  if (normalized.includes('404') || normalized.includes('not found') || normalized.includes('not supported') || normalized.includes('model')) {
    return 'Gemini OCR model available na. GEMINI_VISION_MODEL=gemini-2.0-flash-lite or gemini-2.0-flash diye server restart korun, or text manually paste/type korun.'
  }
  if (normalized.includes('api key') || normalized.includes('api_key_invalid') || normalized.includes('invalid')) {
    return 'Gemini API key problem. GEMINI_API_KEY check kore dev server restart korun, or text manually paste/type korun.'
  }
  return fallbackPayload.error
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isQuotaError(message: string) {
  return /429|too many requests|quota|rate limit|resource_exhausted/i.test(message)
}

function retryDelayMs(message: string, attempt: number) {
  const retryMatch = message.match(/retry in\s+([\d.]+)s/i)
  const hintedSeconds = retryMatch ? Number(retryMatch[1]) : null
  const base = hintedSeconds && Number.isFinite(hintedSeconds)
    ? hintedSeconds * 1000
    : 2000 * 2 ** attempt
  const jitter = Math.floor(Math.random() * 600)
  return Math.min(base + jitter, 6500)
}

async function withOcrQueue<T>(task: () => Promise<T>) {
  const run = ocrQueue.then(async () => {
    const elapsed = Date.now() - lastOcrStartedAt
    if (elapsed < OCR_MIN_INTERVAL_MS) {
      await sleep(OCR_MIN_INTERVAL_MS - elapsed)
    }
    lastOcrStartedAt = Date.now()
    return task()
  })

  ocrQueue = run.then(() => undefined, () => undefined)
  return run
}

async function generateWithBackoff<T>(task: () => Promise<T>) {
  let lastError: unknown

  for (let attempt = 0; attempt <= OCR_MAX_RETRIES; attempt += 1) {
    try {
      return await withOcrQueue(task)
    } catch (err) {
      lastError = err
      const message = err instanceof Error ? err.message : String(err)
      if (!isQuotaError(message) || attempt === OCR_MAX_RETRIES) break
      await sleep(retryDelayMs(message, attempt))
    }
  }

  throw lastError
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const image = form.get('image')
    const file = image instanceof File ? image : null
    if (!file) {
      return NextResponse.json(
        { ...fallbackPayload, error: 'No image uploaded' },
        { status: 400 }
      )
    }

    const validation = validateImageFile(file)

    if (!validation.ok) {
      return NextResponse.json(
        { ...fallbackPayload, error: validation.error },
        { status: validation.status }
      )
    }

    const geminiKey = process.env.GEMINI_API_KEY?.trim()
    if (!geminiKey) {
      return NextResponse.json(fallbackPayload)
    }

    const genAI = new GoogleGenerativeAI(geminiKey)
    const imagePart = await imageFileToGenerativePart(file)
    const errors: string[] = []

    for (const modelName of getVisionModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0 },
        })

        const result = await generateWithBackoff(() => model.generateContent([
          imagePart,
          OCR_PROMPT,
        ]))
        const text = cleanOcrText(result.response.text())

        if (!text) {
          errors.push(`${modelName}: empty OCR text`)
          continue
        }

        return NextResponse.json({
          success: true,
          text,
          source: 'gemini',
          needsReview: true,
        })
      } catch (modelErr) {
        const message = modelErr instanceof Error ? modelErr.message : 'Unknown Gemini OCR error'
        errors.push(`${modelName}: ${message}`)
        if (isQuotaError(message)) {
          console.error('/api/ocr Gemini quota error:', message)
          return NextResponse.json({
            ...fallbackPayload,
            error: friendlyOcrError(message),
          })
        }
      }
    }

    console.error('/api/ocr Gemini extraction failed:', errors.join(' | '))
    return NextResponse.json({
      ...fallbackPayload,
      error: friendlyOcrError(errors.join(' | ')),
    })
  } catch (err) {
    console.error('/api/ocr error:', err)
    return NextResponse.json(fallbackPayload)
  }
}
