type ParseSuccess<T> = { success: true; data: T }
type ParseFailure = { success: false; error: { flatten: () => { fieldErrors: Record<string, string[]> } } }
type ParseResult<T> = ParseSuccess<T> | ParseFailure

type StudyBuddyLanguage = 'bn' | 'en' | 'chakma' | 'marma' | 'garo'
type EmotionLabel = 'confident' | 'confused' | 'frustrated'

const LANGUAGES = new Set(['bn', 'en', 'chakma', 'marma', 'garo'])
const EMOTIONS = new Set(['confident', 'confused', 'frustrated'])
const REACTIONS = new Set(['আমি বুঝেছি', 'আমি বুঝিনি', 'আরেকটা hint চাই', 'Explanation আবার দাও'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function fail(field: string, message: string): ParseFailure {
  return {
    success: false,
    error: {
      flatten: () => ({ fieldErrors: { [field]: [message] } }),
    },
  }
}

function ok<T>(data: T): ParseSuccess<T> {
  return { success: true, data }
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function cleanString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export const studyBuddyLanguageSchema = {
  safeParse(value: unknown): ParseResult<StudyBuddyLanguage> {
    const language = cleanString(value, 20) || 'bn'
    return LANGUAGES.has(language) ? ok(language as StudyBuddyLanguage) : fail('language', 'Invalid language')
  },
}

export const joinStudyBuddySchema = {
  safeParse(value: unknown): ParseResult<{
    questionText: string
    subject?: string
    classLevel?: string
    language?: StudyBuddyLanguage
    emotionLabel?: EmotionLabel
    conceptHint?: string
    anonymousSessionId?: string
    solo?: boolean
  }> {
    const body = asObject(value)
    if (!body) return fail('body', 'Invalid request')

    const questionText = cleanString(body.questionText, 1200)
    if (questionText.length < 2) return fail('questionText', 'Question is required')

    const language = cleanString(body.language, 20) || 'bn'
    if (!LANGUAGES.has(language)) return fail('language', 'Invalid language')

    const emotionLabel = cleanString(body.emotionLabel, 20)
    if (emotionLabel && !EMOTIONS.has(emotionLabel)) return fail('emotionLabel', 'Invalid emotion')

    const anonymousSessionId = cleanString(body.anonymousSessionId, 80)
    if (anonymousSessionId && !UUID_RE.test(anonymousSessionId)) return fail('anonymousSessionId', 'Invalid session id')

    return ok({
      questionText,
      subject: cleanString(body.subject, 80) || undefined,
      classLevel: cleanString(body.classLevel, 40) || undefined,
      language: language as StudyBuddyLanguage,
      emotionLabel: emotionLabel ? emotionLabel as EmotionLabel : undefined,
      conceptHint: cleanString(body.conceptHint, 160) || undefined,
      anonymousSessionId: anonymousSessionId || undefined,
      solo: body.solo === true,
    })
  },
}

export const roomIdSchema = {
  safeParse(value: unknown): ParseResult<string> {
    const roomId = cleanString(value, 80)
    return UUID_RE.test(roomId) ? ok(roomId) : fail('roomId', 'Invalid room id')
  },
}

export const answerSchema = {
  safeParse(value: unknown): ParseResult<{
    questionId: string
    answer: { id: string } & Record<string, unknown>
    responseMs?: number
  }> {
    const body = asObject(value)
    if (!body) return fail('body', 'Invalid answer')

    const questionId = cleanString(body.questionId, 80)
    if (!UUID_RE.test(questionId)) return fail('questionId', 'Invalid question id')

    const answer = asObject(body.answer)
    const id = cleanString(answer?.id, 8)
    if (!id) return fail('answer', 'Answer id is required')

    const responseMs = Number(body.responseMs)
    if (body.responseMs !== undefined && (!Number.isInteger(responseMs) || responseMs < 0 || responseMs > 600000)) {
      return fail('responseMs', 'Invalid response time')
    }

    return ok({
      questionId,
      answer: { ...(answer || {}), id },
      responseMs: Number.isInteger(responseMs) ? responseMs : undefined,
    })
  },
}

export const reportSchema = {
  safeParse(value: unknown): ParseResult<{
    reportedSessionId?: string
    reason: string
    details?: string
  }> {
    const body = asObject(value)
    if (!body) return fail('body', 'Invalid report')

    const reportedSessionId = cleanString(body.reportedSessionId, 80)
    if (reportedSessionId && !UUID_RE.test(reportedSessionId)) return fail('reportedSessionId', 'Invalid reported session id')

    const reason = cleanString(body.reason, 80)
    if (reason.length < 3) return fail('reason', 'Reason is required')

    return ok({
      reportedSessionId: reportedSessionId || undefined,
      reason,
      details: cleanString(body.details, 400) || undefined,
    })
  },
}

export const reactionSchema = {
  safeParse(value: unknown): ParseResult<{ content: string }> {
    const body = asObject(value)
    const content = cleanString(body?.content, 80)
    return REACTIONS.has(content) ? ok({ content }) : fail('content', 'Invalid reaction')
  },
}

export const messageSchema = {
  safeParse(value: unknown): ParseResult<{ content: string }> {
    const body = asObject(value)
    if (!body) return fail('body', 'Invalid message')

    const content = cleanString(body.content, 500)
    if (content.length < 1) return fail('content', 'Message is required')

    return ok({ content })
  },
}
