import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import {
  PDF_SUMMARY_LIMITS,
  createLocalPdfSummary,
  extractJsonObject,
  extractPdfText,
  normalizeSummaryJson,
  validatePdfFile,
} from '@/lib/pdfSummary'

export const runtime = 'nodejs'

const scannedPdfResponse = {
  success: false,
  error: 'This PDF looks scanned or image-based. Please use OCR/manual text mode or upload a text-based PDF.',
  pdfType: 'scanned_or_empty',
}

function getSummaryModels() {
  return [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    process.env.GEMINI_SUMMARY_MODEL?.trim(),
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ].filter((model, index, models): model is string => Boolean(model) && models.indexOf(model) === index)
}

type GeminiSummaryErrorType =
  | 'missing_api_key'
  | 'invalid_api_key'
  | 'quota_rate_limit'
  | 'request_too_large'
  | 'model_not_available'
  | 'summary_failed'

class GeminiSummaryError extends Error {
  constructor(
    public type: GeminiSummaryErrorType,
    message: string,
    public model?: string
  ) {
    super(message)
    this.name = 'GeminiSummaryError'
  }
}

function classifyGeminiError(err: unknown, model?: string): GeminiSummaryError {
  if (err instanceof GeminiSummaryError) return err

  const message = err instanceof Error ? err.message : String(err)
  const normalized = message.toLowerCase()

  if (normalized.includes('api key not valid') || normalized.includes('api_key_invalid') || normalized.includes('invalid api key')) {
    return new GeminiSummaryError('invalid_api_key', message, model)
  }
  if (normalized.includes('429') || normalized.includes('too many requests') || normalized.includes('quota') || normalized.includes('rate limit')) {
    return new GeminiSummaryError('quota_rate_limit', message, model)
  }
  if (normalized.includes('400') && (normalized.includes('too large') || normalized.includes('token') || normalized.includes('request payload') || normalized.includes('exceeds'))) {
    return new GeminiSummaryError('request_too_large', message, model)
  }
  if (normalized.includes('404') || normalized.includes('not found') || normalized.includes('not supported') || normalized.includes('model')) {
    return new GeminiSummaryError('model_not_available', message, model)
  }

  return new GeminiSummaryError('summary_failed', message, model)
}

function userMessageForGeminiError(error: GeminiSummaryError) {
  switch (error.type) {
    case 'missing_api_key':
      return 'Gemini API key missing. Server-side GEMINI_API_KEY configure korte hobe.'
    case 'invalid_api_key':
      return 'Gemini API key invalid. Notun key .env.local e boshiye server restart korun.'
    case 'quota_rate_limit':
      return 'Gemini summary quota/rate limit reached. Showing a local study summary from the extracted PDF text.'
    case 'request_too_large':
      return 'PDF content request too large. Smaller PDF ba kom page upload korun.'
    case 'model_not_available':
      return 'Gemini summary model unavailable. Showing a local study summary from the extracted PDF text.'
    default:
      return 'Gemini summary unavailable. Showing a local study summary from the extracted PDF text.'
  }
}

async function geminiText(prompt: string) {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) throw new GeminiSummaryError('missing_api_key', 'GEMINI_API_KEY is missing.')

  const genAI = new GoogleGenerativeAI(key)
  let lastError: GeminiSummaryError | null = null

  for (const modelName of getSummaryModels()) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2 },
      })
      const result = await model.generateContent(prompt)
      return result.response.text().trim()
    } catch (err) {
      lastError = classifyGeminiError(err, modelName)
      console.warn('/api/pdf-summary Gemini model failed:', {
        type: lastError.type,
        model: modelName,
        message: lastError.message,
      })
      if (lastError.type !== 'model_not_available') break
    }
  }

  throw lastError || new GeminiSummaryError('summary_failed', 'Gemini summary failed.')
}

function summaryPrompt(pdfText: string, language: 'bn' | 'en') {
  const outputLanguage = language === 'en' ? 'simple English' : 'clean, simple Bangla'
  return `You are VoicePandita, a study assistant.
Summarize this PDF in ${outputLanguage}.
Return valid JSON only with:
shortSummary,
detailedSummary,
keyPoints,
importantTerms,
studyNotes.
Do not copy raw text. Do not repeat lines. Preserve important formulas.
Do not invent facts not present in the document.

Rules:
- shortSummary must be exactly 3 sentences in ${outputLanguage}.
- detailedSummary should be student-friendly notes in ${outputLanguage}.
- keyPoints must be 5-8 strings.
- importantTerms must include formulas/terms if available, otherwise key vocabulary.
- studyNotes must be exam-style notes.

PDF extracted text:
${pdfText}`
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const uploaded = form.get('file')
    const requestedLanguage = form.get('language')
    const summaryLanguage = requestedLanguage === 'en' ? 'en' : 'bn'
    const file = uploaded instanceof File ? uploaded : null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No PDF uploaded.' }, { status: 400 })
    }

    const validation = validatePdfFile(file)

    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: validation.status })
    }

    const { pages, text } = await extractPdfText(file)

    if (pages > PDF_SUMMARY_LIMITS.maxPages) {
      return NextResponse.json({
        success: false,
        error: `PDF is too long for v1. Please upload a PDF with ${PDF_SUMMARY_LIMITS.maxPages} pages or fewer.`,
        pages,
      }, { status: 413 })
    }

    if (text.length < PDF_SUMMARY_LIMITS.minExtractedChars) {
      return NextResponse.json({ ...scannedPdfResponse, fileName: file.name, pages })
    }

    let normalized: ReturnType<typeof normalizeSummaryJson>
    let warning: string | undefined
    let fallbackReason: string | undefined

    try {
      const quotaSafeText = text.slice(0, PDF_SUMMARY_LIMITS.chunkChars * 2)
      const finalRaw = await geminiText(summaryPrompt(quotaSafeText, summaryLanguage))
      normalized = normalizeSummaryJson(extractJsonObject(finalRaw))
    } catch (summaryErr) {
      const geminiError = classifyGeminiError(summaryErr)
      console.warn('/api/pdf-summary using local fallback:', {
        type: geminiError.type,
        model: geminiError.model,
        message: geminiError.message,
      })
      normalized = createLocalPdfSummary(text, file.name, pages, summaryLanguage)
      warning = userMessageForGeminiError(geminiError)
      fallbackReason = geminiError.type
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      pages,
      pdfType: 'text_pdf',
      summaryLanguage,
      ...normalized,
      extractedText: text,
      warning: warning || normalized.warning,
      fallbackReason: fallbackReason || normalized.fallbackReason,
      source: 'pdf-summary',
    })
  } catch (err) {
    console.error('/api/pdf-summary error:', err)
    const geminiError = classifyGeminiError(err)

    return NextResponse.json({
      success: false,
      error: userMessageForGeminiError(geminiError),
      errorType: geminiError.type,
      model: geminiError.model,
    }, { status: geminiError.type === 'missing_api_key' || geminiError.type === 'invalid_api_key' ? 500 : 200 })
  }
}
