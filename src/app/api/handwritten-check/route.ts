import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { cleanOcrText, imageFileToGenerativePart, validateImageFile } from '@/lib/ocr'
import { geminiVisionModels } from '@/lib/ai/models'

const geminiKey = process.env.GEMINI_API_KEY?.trim()
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null

function getVisionModelCandidates() {
  return geminiVisionModels()
}

function safeJson(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  return JSON.parse(match ? match[0] : cleaned)
}

function friendlyCheckError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('429') || normalized.includes('too many requests') || normalized.includes('quota')) {
    return 'Gemini rate limit reached, so the image could not be checked right now. Try again after a minute.'
  }
  if (normalized.includes('404') || normalized.includes('not found') || normalized.includes('not supported') || normalized.includes('model')) {
    return 'Gemini vision model is not available. Set GEMINI_VISION_MODEL=gemini-flash-latest and restart the server.'
  }
  if (normalized.includes('api key') || normalized.includes('api_key_invalid') || normalized.includes('invalid')) {
    return 'Gemini API key problem. Check GEMINI_API_KEY and restart the server.'
  }
  return 'Could not check the handwritten answer clearly.'
}

function fallbackResult(question: string, maxMarks: number) {
  return {
    extractedAnswer: '',
    marksAwarded: 0,
    maxMarks,
    percentage: 0,
    verdict: 'Could not check clearly',
    contentFeedback: 'The handwritten answer could not be read clearly. Please upload a sharper image or type the answer.',
    writingFeedback: 'Use darker ink, larger letters, and keep the page straight inside the photo.',
    strengths: [],
    missingPoints: ['readable answer image'],
    improvementPlan: [
      'Retake the photo in bright light.',
      'Keep the page flat and crop only the answer area.',
      question ? 'Make sure the answer directly addresses the question.' : 'Add the question or marking rubric for better grading.',
    ],
    modelAnswer: '',
  }
}

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 6) : []
}

function responseFromParsed(parsed: Record<string, unknown>, maxMarks: number, source: string) {
  const marksAwarded = Math.max(0, Math.min(maxMarks, Number(parsed.marksAwarded || 0)))
  const percentage = Math.round((marksAwarded / maxMarks) * 100)

  return {
    extractedAnswer: cleanOcrText(String(parsed.extractedAnswer || '')),
    marksAwarded,
    maxMarks,
    percentage: Number.isFinite(Number(parsed.percentage)) ? Math.round(Number(parsed.percentage)) : percentage,
    verdict: String(parsed.verdict || 'Checked'),
    contentFeedback: String(parsed.contentFeedback || ''),
    writingFeedback: String(parsed.writingFeedback || ''),
    strengths: toStringArray(parsed.strengths),
    missingPoints: toStringArray(parsed.missingPoints),
    improvementPlan: toStringArray(parsed.improvementPlan),
    modelAnswer: String(parsed.modelAnswer || ''),
    source,
  }
}

function hasBanglaOrLatinText(text: string) {
  return /[\u0980-\u09FFa-zA-Z]{3,}/.test(text)
}

function heuristicGradeFromText(
  extractedAnswer: string,
  question: string,
  expectedAnswer: string,
  subject: string,
  maxMarks: number,
) {
  const answer = extractedAnswer.toLowerCase()
  const promptText = `${question} ${expectedAnswer}`.toLowerCase()
  const isPhotosynthesis = /photosynthesis|photo synthesis|\u09b8\u09be\u09b2\u09cb\u0995|\u09ab\u099f\u09cb\u09b8\u09bf\u09a8\u09a5\u09c7\u09b8\u09bf\u09b8/.test(promptText)

  let matched = 0
  const missingPoints: string[] = []

  if (isPhotosynthesis) {
    const concepts = [
      { label: 'plants make food', re: /plant|tree|leaf|green|\u0997\u09be\u099b|\u0989\u09a6\u09cd\u09ad\u09bf\u09a6|\u09aa\u09be\u09a4\u09be/ },
      { label: 'sunlight/light', re: /sun|light|\u0986\u09b2\u09cb|\u09b8\u09c2\u09b0\u09cd\u09af/ },
      { label: 'carbon dioxide', re: /carbon|co2|\u0995\u09be\u09b0\u09cd\u09ac\u09a8/ },
      { label: 'water', re: /water|\u09aa\u09be\u09a8\u09bf|\u099c\u09b2/ },
      { label: 'food/glucose', re: /food|glucose|\u0996\u09be\u09a6\u09cd\u09af|\u0996\u09be\u09ac\u09be\u09b0/ },
      { label: 'oxygen', re: /oxygen|o2|\u0985\u0995\u09cd\u09b8\u09bf\u099c\u09c7\u09a8/ },
      { label: 'process', re: /process|\u09aa\u09cd\u09b0\u0995\u09cd\u09b0\u09bf\u09af/ },
    ]

    for (const concept of concepts) {
      if (concept.re.test(answer)) matched += 1
      else missingPoints.push(concept.label)
    }

    const base = answer.length > 18 ? 2 : 1
    const marksAwarded = Math.max(1, Math.min(maxMarks, Math.round((base + matched * 1.1) * (maxMarks / 10))))
    const percentage = Math.round((marksAwarded / maxMarks) * 100)

    return {
      extractedAnswer,
      marksAwarded,
      maxMarks,
      percentage,
      verdict: percentage >= 70 ? 'Mostly correct' : percentage >= 40 ? 'Partially correct' : 'Needs more detail',
      contentFeedback: 'I could read part of the handwritten answer. It mentions photosynthesis, but a full answer should clearly say that green plants use sunlight, carbon dioxide, and water to make food and release oxygen.',
      writingFeedback: 'The writing is readable in parts, but the letters are small and the photo angle makes some words hard to read. Write a little larger, keep the line straight, and take the photo closer in bright light.',
      strengths: matched > 0 ? ['Relevant topic identified'] : [],
      missingPoints: missingPoints.slice(0, 5),
      improvementPlan: [
        'Write the definition in one complete sentence.',
        'Add the key inputs: sunlight, carbon dioxide, and water.',
        'Add the outputs: food/glucose and oxygen.',
      ],
      modelAnswer: 'Photosynthesis is the process by which green plants use sunlight, carbon dioxide, and water to make food/glucose and release oxygen.',
      source: 'ocr-heuristic',
    }
  }

  const expectedWords = cleanOcrText(expectedAnswer)
    .toLowerCase()
    .split(/[^\u0980-\u09FFa-z0-9]+/i)
    .filter(word => word.length >= 4)
    .slice(0, 18)
  const uniqueExpected = Array.from(new Set(expectedWords))
  const overlap = uniqueExpected.filter(word => answer.includes(word)).length
  const basePct = uniqueExpected.length > 0
    ? Math.round((overlap / uniqueExpected.length) * 80)
    : extractedAnswer.length > 40 ? 45 : 25
  const percentage = Math.max(10, Math.min(70, basePct))
  const marksAwarded = Math.round((percentage / 100) * maxMarks)

  return {
    extractedAnswer,
    marksAwarded,
    maxMarks,
    percentage,
    verdict: 'Partially checked from extracted text',
    contentFeedback: expectedAnswer
      ? 'I could extract readable text, but the full AI grading response failed. This score is estimated from overlap with the rubric/model answer.'
      : `I could extract readable text for ${subject}, but no rubric was provided, so this is a cautious partial score.`,
    writingFeedback: 'The answer is readable in parts. Improve the photo by using brighter light, darker ink, and a straighter page crop.',
    strengths: extractedAnswer.length > 15 ? ['Readable answer text found'] : [],
    missingPoints: expectedAnswer ? ['More complete rubric match needed'] : ['Add a model answer/rubric for accurate marking'],
    improvementPlan: [
      'Retake the image closer to the writing.',
      'Write key terms clearly and leave spaces between words.',
      'Add the expected/model answer before checking for stricter marking.',
    ],
    modelAnswer: expectedAnswer,
    source: 'ocr-heuristic',
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const image = form.get('image')
    const file = image instanceof File ? image : null
    const validation = validateImageFile(file)

    if (!validation.ok || !file) {
      return NextResponse.json(
        { error: validation.error, ...fallbackResult('', 10) },
        { status: validation.status }
      )
    }

    const question = String(form.get('question') || '').trim()
    const expectedAnswer = String(form.get('expectedAnswer') || '').trim()
    const subject = String(form.get('subject') || 'general').trim()
    const maxMarks = Math.max(1, Math.min(100, Number(form.get('maxMarks') || 10)))

    if (!genAI) {
      return NextResponse.json({
        ...fallbackResult(question, maxMarks),
        source: 'fallback',
        error: 'GEMINI_API_KEY missing; handwritten checking needs Gemini vision.',
      })
    }

    const imagePart = await imageFileToGenerativePart(file)
    const gradingPrompt = `You are VoicePandita, a fair school exam answer checker for Bangladeshi students.
Read the handwritten answer image, extract the student's answer, then grade it.

Subject: ${subject}
Question: ${question || 'Not provided'}
Expected answer/rubric: ${expectedAnswer || 'Use school-level correctness for this subject and question.'}
Maximum marks: ${maxMarks}

Return JSON only:
{
  "extractedAnswer": "the handwritten answer text you can read",
  "marksAwarded": number,
  "maxMarks": ${maxMarks},
  "percentage": number,
  "verdict": "short verdict",
  "contentFeedback": "2-4 sentences on correctness, in simple Bangla/English mix",
  "writingFeedback": "2-4 sentences on handwriting, structure, clarity, spacing, diagrams if relevant",
  "strengths": ["point"],
  "missingPoints": ["point"],
  "improvementPlan": ["actionable step"],
  "modelAnswer": "short improved answer"
}

Rules:
- Grade the answer content, not the student's accent or background.
- If handwriting is unclear, lower confidence and mention readability.
- Do not invent text that is not visible.
- Award marks proportionally; partial correct ideas should get partial marks.
- If the question/rubric is missing, grade more generally and say that a rubric would improve accuracy.`

    const ocrPrompt =
      'Extract only the readable handwritten answer text from this image. Preserve Bangla and English words exactly as much as possible. Do not solve, grade, translate, or explain. If a word is unclear, skip that word. Return plain text only.'

    const errors: string[] = []

    for (const modelName of getVisionModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.2 },
        })
        const result = await model.generateContent([imagePart, gradingPrompt])
        const parsed = safeJson(result.response.text())
        return NextResponse.json(responseFromParsed(parsed, maxMarks, modelName))
      } catch (err) {
        errors.push(`${modelName}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    let extractedAnswer = ''

    for (const modelName of getVisionModelCandidates()) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0 },
        })
        const result = await model.generateContent([imagePart, ocrPrompt])
        const text = cleanOcrText(result.response.text())

        if (hasBanglaOrLatinText(text)) {
          extractedAnswer = text
          break
        }

        errors.push(`${modelName} OCR: empty text`)
      } catch (err) {
        errors.push(`${modelName} OCR: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    if (extractedAnswer) {
      const textGradingPrompt = `You are VoicePandita, a fair school answer checker.
The handwritten OCR text was extracted separately. Grade this extracted answer.

Subject: ${subject}
Question: ${question || 'Not provided'}
Expected answer/rubric: ${expectedAnswer || 'Use school-level correctness for this subject and question.'}
Maximum marks: ${maxMarks}
Extracted student answer:
${extractedAnswer}

Return JSON only with these keys:
{
  "extractedAnswer": ${JSON.stringify(extractedAnswer)},
  "marksAwarded": number,
  "maxMarks": ${maxMarks},
  "percentage": number,
  "verdict": "short verdict",
  "contentFeedback": "2-4 simple sentences",
  "writingFeedback": "2-4 simple sentences about handwriting/photo clarity",
  "strengths": ["point"],
  "missingPoints": ["point"],
  "improvementPlan": ["actionable step"],
  "modelAnswer": "short improved answer"
}`

      for (const modelName of getVisionModelCandidates()) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: { temperature: 0.15 },
          })
          const result = await model.generateContent(textGradingPrompt)
          const parsed = safeJson(result.response.text())
          const payload = responseFromParsed(
            { ...parsed, extractedAnswer: parsed.extractedAnswer || extractedAnswer },
            maxMarks,
            `${modelName}-ocr-text`,
          )
          return NextResponse.json(payload)
        } catch (err) {
          errors.push(`${modelName} text grade: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      return NextResponse.json(heuristicGradeFromText(extractedAnswer, question, expectedAnswer, subject, maxMarks))
    }

    console.error('/api/handwritten-check failed:', errors.join(' | '))
    return NextResponse.json({
      ...fallbackResult(question, maxMarks),
      source: 'fallback',
      error: friendlyCheckError(errors.join(' | ')),
    })
  } catch (err) {
    console.error('/api/handwritten-check error:', err)
    return NextResponse.json(
      { error: 'Handwritten answer checking failed.', ...fallbackResult('', 10) },
      { status: 500 }
    )
  }
}
