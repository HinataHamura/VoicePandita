export type PdfSummaryResult = {
  success: true
  fileName: string
  pages: number
  pdfType: 'text_pdf'
  summaryLanguage: 'bn' | 'en'
  shortSummary: string
  detailedSummary: string
  keyPoints: string[]
  importantTerms: string[]
  studyNotes: string[]
  source: 'pdf-summary'
  extractedText?: string
  warning?: string
  fallbackReason?: string
}

type SummaryFields = Omit<
  PdfSummaryResult,
  'success' | 'fileName' | 'pages' | 'pdfType' | 'summaryLanguage' | 'source' | 'extractedText'
>

export const PDF_SUMMARY_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  maxPages: 20,
  minExtractedChars: 120,
  chunkChars: 5500,
}

const FALLBACK_WARNING = 'Gemini summary quota/rate limit reached. Showing a local study summary from the extracted PDF text.'

const PHYSICS_TERMS = [
  { test: /\bnewton\b|নিউটন/i, label: 'Newton / নিউটন' },
  { test: /\bforce\b|বল/i, label: 'Force / বল' },
  { test: /\bmass\b|ভর/i, label: 'Mass / ভর' },
  { test: /\bacceleration\b|ত্বরণ/i, label: 'Acceleration / ত্বরণ' },
  { test: /\binertia\b|জড়তা|জড়তা/i, label: 'Inertia / জড়তা' },
  { test: /\bmomentum\b|ভরবেগ/i, label: 'Momentum / ভরবেগ' },
  { test: /\bimpulse\b|আঘাতবল/i, label: 'Impulse' },
  { test: /\bfriction\b|ঘর্ষণ/i, label: 'Friction / ঘর্ষণ' },
  { test: /\bvelocity\b|বেগ/i, label: 'Velocity / বেগ' },
  { test: /\benergy\b|শক্তি/i, label: 'Energy / শক্তি' },
]

export function validatePdfFile(file: File | null) {
  if (!file) return { ok: false, status: 400, error: 'No PDF uploaded.' }
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return { ok: false, status: 415, error: 'Only PDF files are supported.' }
  }
  if (file.size > PDF_SUMMARY_LIMITS.maxBytes) {
    return { ok: false, status: 413, error: 'PDF must be smaller than 10MB.' }
  }
  return { ok: true, status: 200, error: null }
}

export async function extractPdfText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const pdfParse = loadPdfParse()
  const parsed = await pdfParse(buffer)
  return {
    pages: parsed.numpages || 0,
    text: cleanPdfText(parsed.text || ''),
  }
}

type PdfParseResult = {
  numpages?: number
  text?: string
}

type PdfParse = (buffer: Buffer) => Promise<PdfParseResult>

function loadPdfParse(): PdfParse {
  const nodeRequire = eval('require') as NodeRequire
  return nodeRequire('pdf-parse') as PdfParse
}

export function cleanPdfText(text: string) {
  const normalized = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u00ad/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/([A-Za-z])-\n([A-Za-z])/g, '$1$2')
    .replace(/([A-Za-z])-\s+([a-z])/g, '$1$2')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u0980-\u09FF\u0394\u03B1-\u03C9\u00B2\u00B3=+\-*/^().,%:;[\]{}<>≤≥×÷√πΩ_]/g, ' ')
    .replace(/\n{3,}/g, '\n\n')

  const rawLines = normalized
    .split('\n')
    .map(line => line.trim().replace(/\s{2,}/g, ' '))
    .filter(Boolean)

  const lineCounts = new Map<string, number>()
  for (const line of rawLines) {
    const key = line.toLowerCase()
    lineCounts.set(key, (lineCounts.get(key) || 0) + 1)
  }

  const cleanedLines = rawLines.filter(line => {
    const compact = line.replace(/\s/g, '')
    const lower = line.toLowerCase()
    const repeatCount = lineCounts.get(lower) || 0

    if (/^(page|পৃষ্ঠা)?\s*\d+\s*(of\s*\d+)?$/i.test(line)) return false
    if (/^\d+$/.test(line) && Number(line) < 1000) return false
    if (repeatCount > 2 && line.length < 80 && !looksLikeFormula(line)) return false
    if (compact.length < 2) return false
    if (junkRatio(line) > 0.32 && !looksLikeFormula(line)) return false

    return true
  })

  return compactAdjacentDuplicates(cleanedLines).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function chunkText(text: string, chunkChars = PDF_SUMMARY_LIMITS.chunkChars) {
  const chunks: string[] = []
  let cursor = 0

  while (cursor < text.length) {
    const end = Math.min(cursor + chunkChars, text.length)
    const nextBreak = text.lastIndexOf('\n', end)
    const cut = nextBreak > cursor + chunkChars * 0.55 ? nextBreak : end
    const chunk = text.slice(cursor, cut).trim()
    if (chunk) chunks.push(chunk)
    cursor = cut
  }

  return chunks
}

export function extractJsonObject(text: string) {
  const cleaned = text.replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Summary model did not return JSON')
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

export function normalizeSummaryJson(value: any): SummaryFields {
  return {
    shortSummary: cleanSummaryText(String(value?.shortSummary || '')).trim(),
    detailedSummary: cleanSummaryText(String(value?.detailedSummary || '')).trim(),
    keyPoints: normalizeStringList(value?.keyPoints, 8),
    importantTerms: normalizeStringList(value?.importantTerms, 12),
    studyNotes: normalizeStringList(value?.studyNotes, 10),
  }
}

export function buildLocalStudySummary(cleanText: string, fileName = 'PDF', pages = 0): SummaryFields {
  const lines = meaningfulLines(cleanText)
  const topic = detectTopic(lines, fileName)
  const formulas = extractFormulas(cleanText)
  const isNewtonPhysics = detectNewtonPhysics(cleanText, formulas)
  const sourcePoints = extractImportantLines(lines, formulas)
  const keyPoints = buildKeyPoints(sourcePoints, formulas, isNewtonPhysics)
  const importantTerms = buildImportantTerms(cleanText, formulas, isNewtonPhysics)
  const studyNotes = buildStudyNotes(topic, formulas, isNewtonPhysics, pages)

  const formulaText = formulas.length ? ` গুরুত্বপূর্ণ সূত্র: ${formulas.slice(0, 3).join(', ')}।` : ''

  return {
    shortSummary: isNewtonPhysics
      ? `এই PDF-এ নিউটনের গতিসূত্র, বল, ভর, ত্বরণ এবং ভরবেগের মতো গুরুত্বপূর্ণ পদার্থবিজ্ঞানের ধারণা আলোচনা করা হয়েছে।${formulaText} এটি শিক্ষার্থীদের ধারণা বোঝা ও পরীক্ষার প্রস্তুতিতে সহায়ক।`
      : `এই PDF-এ ${topic} বিষয়ে গুরুত্বপূর্ণ ধারণা, সংজ্ঞা এবং পরীক্ষার উপযোগী তথ্য সাজানো হয়েছে।${formulaText} নিচের সারাংশটি extracted text থেকে পরিষ্কার study notes হিসেবে তৈরি করা হয়েছে।`,
    detailedSummary: buildDetailedSummary(topic, keyPoints, formulas, isNewtonPhysics),
    keyPoints,
    importantTerms,
    studyNotes,
    warning: FALLBACK_WARNING,
    fallbackReason: 'local_study_fallback',
  }
}

export function buildEnglishLocalStudySummary(cleanText: string, fileName = 'PDF', pages = 0): SummaryFields {
  const lines = meaningfulLines(cleanText)
  const topic = detectTopic(lines, fileName)
  const formulas = extractFormulas(cleanText)
  const sourcePoints = extractImportantLines(lines, formulas)
  const keyPoints = uniqueStrings([
    ...formulas.map(formula => `Important formula: ${formula}`),
    ...sourcePoints.map(line => cleanSummaryText(line).replace(/[।]$/, '.')),
  ]).slice(0, 6)

  const importantTerms = uniqueStrings([
    ...formulas,
    ...PHYSICS_TERMS.filter(term => term.test.test(cleanText)).map(term => term.label),
  ]).slice(0, 8)

  return {
    shortSummary: `This PDF discusses key ideas from ${topic}. The extracted text has been organized into concise study notes for quick revision. Important formulas and terms are highlighted where available.`,
    detailedSummary: [
      `The readable PDF text is about ${topic}. VoicePandita grouped the main definitions, formulas, examples, and exam-relevant lines into a clean local study summary.`,
      keyPoints.length
        ? `The most important ideas are: ${keyPoints.slice(0, 3).join(' ')}`
        : 'Start by reviewing the headings and definitions, then connect them with examples from the text.',
      formulas.length
        ? `Practice the formulas separately: ${formulas.slice(0, 5).join(', ')}. Write what each symbol means before solving numerical problems.`
        : 'For revision, rewrite each important line in your own words and prepare a short example.',
    ].join('\n\n'),
    keyPoints: keyPoints.length ? keyPoints : ['Read the headings first.', 'Mark definitions and examples.', 'Review formulas separately.'],
    importantTerms: importantTerms.length ? importantTerms : [topic],
    studyNotes: uniqueStrings([
      'Read headings, definitions, and examples in that order.',
      'Write each formula with the meaning of every symbol.',
      'For exam answers, use definition, explanation, and example.',
      pages > 1 ? `Review 1-2 key ideas from each of the ${pages} pages.` : 'Make a short one-page revision note.',
      formulas.length ? 'For numerical problems, write the formula first, then substitute values.' : 'Use your own words to check understanding.',
    ]).slice(0, 6),
    warning: FALLBACK_WARNING,
    fallbackReason: 'local_study_fallback',
  }
}

export function createLocalPdfSummary(text: string, fileName?: string, pages?: number, language: 'bn' | 'en' = 'bn') {
  const cleaned = cleanPdfText(text)
  return language === 'en'
    ? buildEnglishLocalStudySummary(cleaned, fileName, pages)
    : buildLocalStudySummary(cleaned, fileName, pages)
}

function meaningfulLines(text: string) {
  return uniqueStrings(
    text
      .split('\n')
      .map(line => cleanSummaryText(line))
      .filter(line => line.length >= 8)
      .filter(line => !/^(chapter|unit|page|পৃষ্ঠা)\s*\d+$/i.test(line))
  ).slice(0, 160)
}

function detectTopic(lines: string[], fileName: string) {
  const heading = lines.find(line => {
    if (line.length > 90) return false
    if (looksLikeFormula(line)) return false
    return /[A-Za-z\u0980-\u09FF]/.test(line)
  })

  if (heading) return heading.replace(/^\d+[\s.)-]+/, '')
  return fileName.replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ') || 'এই অধ্যায়'
}

function detectNewtonPhysics(text: string, formulas: string[]) {
  const lower = text.toLowerCase()
  return (
    lower.includes('newton') ||
    lower.includes('inertia') ||
    lower.includes('momentum') ||
    lower.includes('impulse') ||
    /নিউটন|জড়তা|জড়তা|ভরবেগ|ত্বরণ/.test(text) ||
    formulas.some(formula => /f\s*=\s*ma|p\s*=\s*mv|j\s*=/i.test(formula))
  )
}

function buildDetailedSummary(topic: string, keyPoints: string[], formulas: string[], isNewtonPhysics: boolean) {
  if (isNewtonPhysics) {
    return [
      'এই অংশে বস্তু কীভাবে স্থির থাকে, চলতে শুরু করে বা ত্বরণ পায় তা নিউটনের গতিসূত্র দিয়ে বোঝানো হয়েছে। প্রথম সূত্র জড়তার ধারণা ব্যাখ্যা করে, দ্বিতীয় সূত্র বল, ভর ও ত্বরণের সম্পর্ক দেখায়, আর তৃতীয় সূত্র ক্রিয়া ও প্রতিক্রিয়ার সম্পর্ক পরিষ্কার করে।',
      formulas.length
        ? `সূত্রগুলো পরীক্ষার জন্য গুরুত্বপূর্ণ: ${formulas.slice(0, 5).join(', ')}। সূত্র লেখার পাশাপাশি প্রতিটি symbol-এর অর্থ বুঝে নিলে numerical problem সমাধান সহজ হয়।`
        : 'এখানে বল, ভর, ত্বরণ, ভরবেগ এবং impulse-এর মতো ধারণাগুলো একসাথে পড়লে অধ্যায়ের সম্পর্কগুলো পরিষ্কার হয়।',
      'পরীক্ষায় ভালো করার জন্য সংজ্ঞা, সূত্র, symbol-এর অর্থ এবং ছোট উদাহরণ একসাথে লিখে অনুশীলন করা উচিত।',
    ].join('\n\n')
  }

  return [
    `${topic} অংশে PDF-এর readable text থেকে মূল ধারণা, সংজ্ঞা এবং প্রাসঙ্গিক উদাহরণ আলাদা করে সাজানো হয়েছে।`,
    keyPoints.length
      ? `সবচেয়ে গুরুত্বপূর্ণ বিষয়গুলো হলো: ${keyPoints.slice(0, 3).join(' ')}`
      : 'মূল বিষয়গুলো heading, definition এবং formula দেখে ধাপে ধাপে পড়লে সহজে বোঝা যায়।',
    formulas.length
      ? `যেসব সূত্র পাওয়া গেছে সেগুলো আলাদা করে অনুশীলন করা দরকার: ${formulas.slice(0, 5).join(', ')}।`
      : 'যেখানে সংজ্ঞা বা ব্যাখ্যা আছে, সেখানে নিজের ভাষায় ছোট নোট বানালে revision সহজ হবে।',
  ].join('\n\n')
}

function buildKeyPoints(lines: string[], formulas: string[], isNewtonPhysics: boolean) {
  const points: string[] = []

  if (isNewtonPhysics) {
    points.push(
      'নিউটনের প্রথম সূত্র জড়তার ধারণা ব্যাখ্যা করে।',
      'দ্বিতীয় সূত্র বল, ভর ও ত্বরণের সম্পর্ক দেখায়: F = ma।',
      'তৃতীয় সূত্র অনুযায়ী প্রত্যেক ক্রিয়ার সমান ও বিপরীত প্রতিক্রিয়া থাকে।'
    )
    if (formulas.some(formula => /p\s*=\s*mv/i.test(formula))) points.push('ভরবেগের সূত্র: p = mv।')
    if (formulas.some(formula => /j\s*=|impulse/i.test(formula))) points.push('Impulse বা আঘাতের সূত্র বল ও সময়ের সম্পর্ক বোঝায়।')
  }

  for (const formula of formulas) {
    points.push(`গুরুত্বপূর্ণ সূত্র: ${formula}`)
  }

  for (const line of lines) {
    points.push(toBanglaPoint(line))
  }

  return uniqueStrings(points.map(cleanSummaryText).filter(Boolean)).slice(0, 6)
}

function buildImportantTerms(text: string, formulas: string[], isNewtonPhysics: boolean) {
  const terms = Array.from(formulas)

  for (const term of PHYSICS_TERMS) {
    if (term.test.test(text)) terms.push(term.label)
  }

  if (isNewtonPhysics) {
    terms.push("Newton's Laws", 'F = ma', 'p = mv')
  }

  return uniqueStrings(terms.map(cleanSummaryText).filter(Boolean)).slice(0, 8)
}

function buildStudyNotes(topic: string, formulas: string[], isNewtonPhysics: boolean, pages: number) {
  const notes = isNewtonPhysics
    ? [
        'প্রথমে তিনটি গতিসূত্রের statement আলাদা করে মুখস্থ না করে অর্থ বুঝে নাও।',
        'F = ma সূত্রে force, mass এবং acceleration কী বোঝায় তা লিখে practice করো।',
        'ভরবেগ ও impulse থাকলে p = mv এবং J = FΔt = Δp সূত্র আলাদা করে revise করো।',
        'প্রতিটি সূত্রের পাশে একটি বাস্তব উদাহরণ লিখলে exam answer শক্তিশালী হয়।',
      ]
    : [
        `${topic} পড়ার সময় heading, definition এবং example আলাদা করে mark করো।`,
        'গুরুত্বপূর্ণ line নিজের ভাষায় এক-দুই বাক্যে rewrite করলে revision সহজ হবে।',
        'Formula থাকলে symbol-এর অর্থ, unit এবং ব্যবহার একসাথে লিখে রাখো।',
        'Exam answer লেখার সময় সংজ্ঞা, ব্যাখ্যা, উদাহরণ এই ক্রম রাখো।',
      ]

  if (pages > 1) notes.push(`${pages} page-এর PDF হওয়ায় প্রতিটি page থেকে ১-২টি key idea আলাদা করে revise করো।`)
  if (formulas.length) notes.push('Numerical problem থাকলে আগে formula বসাও, তারপর given value substitute করো।')

  return uniqueStrings(notes).slice(0, 6)
}

function extractImportantLines(lines: string[], formulas: string[]) {
  const formulaSet = new Set(formulas.map(item => item.toLowerCase()))

  return lines
    .map(line => cleanSummaryText(line))
    .filter(line => line.length >= 18 && line.length <= 180)
    .sort((a, b) => scoreLine(b, formulaSet) - scoreLine(a, formulaSet))
    .slice(0, 10)
}

function scoreLine(line: string, formulaSet: Set<string>) {
  const lower = line.toLowerCase()
  let score = 0
  if (/[=:]/.test(line) || looksLikeFormula(line) || formulaSet.has(lower)) score += 5
  if (/definition|law|formula|therefore|because|example|সূত্র|সংজ্ঞা|কারণ|ব্যাখ্যা|উদাহরণ|নিউটন|বল|ভর|ত্বরণ|ভরবেগ/i.test(line)) score += 4
  if (line.length < 90) score += 2
  if (/^\d+[\s.)-]/.test(line)) score += 1
  return score
}

function extractFormulas(text: string) {
  const formulas = new Set<string>()
  const knownPatterns = [
    /F\s*=\s*ma/gi,
    /p\s*=\s*mv/gi,
    /J\s*=\s*F\s*Δ?t/gi,
    /J\s*=\s*Δ?p/gi,
    /a\s*=\s*Δ?v\s*\/\s*Δ?t/gi,
    /v\s*=\s*u\s*\+\s*at/gi,
    /s\s*=\s*ut\s*\+\s*(?:1\/2|½)\s*at[²2]?/gi,
  ]

  for (const pattern of knownPatterns) {
    for (const match of text.match(pattern) || []) formulas.add(formatFormula(match))
  }

  const generalMatches = text.match(/\b[A-Za-zΔ][A-Za-z0-9Δ]*\s*=\s*[A-Za-z0-9Δ+\-*/^().\s]{1,35}/g) || []
  for (const match of generalMatches) {
    const formula = formatFormula(match)
    if (formula.length <= 45 && /[A-Za-zΔ]/.test(formula)) formulas.add(formula)
  }

  return Array.from(formulas).slice(0, 8)
}

function formatFormula(formula: string) {
  return formula.replace(/\s+/g, ' ').replace(/Delta/gi, 'Δ').trim().replace(/[.,;:]$/, '')
}

function toBanglaPoint(line: string) {
  const cleaned = cleanSummaryText(line).replace(/^[\d.)\-\s]+/, '')
  if (!cleaned) return ''
  if (/[।.!?]$/.test(cleaned)) return cleaned
  return `${cleaned}।`
}

function cleanSummaryText(text: string) {
  return text
    .replace(/```json|```/g, '')
    .replace(/^[-•*\d.)\s]+/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([।.,;:!?])/g, '$1')
    .trim()
}

function normalizeStringList(value: unknown, maxItems: number) {
  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\n|;|•|-\s+/)
      : []

  return uniqueStrings(
    list
      .map(item => cleanSummaryText(String(item)))
      .filter(item => item.length > 2)
  ).slice(0, maxItems)
}

function compactAdjacentDuplicates(lines: string[]) {
  const result: string[] = []
  for (const line of lines) {
    const previous = result[result.length - 1]
    if (previous?.toLowerCase() === line.toLowerCase()) continue
    result.push(line)
  }
  return result
}

function uniqueStrings(items: string[]) {
  const seen = new Set<string>()
  return items.filter(item => {
    const key = item.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function looksLikeFormula(line: string) {
  return /[A-Za-zΔ]\s*=|[+\-*/^]|≤|≥|×|÷/.test(line)
}

function junkRatio(line: string) {
  const junk = line.match(/[^\w\s\u0980-\u09FF\u0394\u03B1-\u03C9=+\-*/^().,%:;[\]{}<>≤≥×÷√πΩ]/g) || []
  return junk.length / Math.max(line.length, 1)
}
