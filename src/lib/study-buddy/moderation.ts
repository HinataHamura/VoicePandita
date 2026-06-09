const PHONE_RE = /(?:\+?88)?01[3-9]\d{8}\b/
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const URL_RE = /\b(?:https?:\/\/|www\.|facebook\.com|fb\.com|wa\.me|t\.me|telegram\.me)\S+/i
const HANDLE_RE = /(?:facebook|fb|whatsapp|telegram|imo|instagram|insta|snapchat|discord)\s*(?:id|number|handle)?\s*[:=]?\s*@?\w+/i
const ABUSE_WORDS = [
  'stupid', 'idiot', 'fuck', 'shit', 'bitch',
  'বোকা', 'গাধা', 'হারামি', 'চুতিয়া', 'চুদ', 'মাগী',
]

export function containsPersonalInfo(text: string) {
  return PHONE_RE.test(text) || EMAIL_RE.test(text) || URL_RE.test(text) || HANDLE_RE.test(text)
}

export function containsAbuse(text: string) {
  const normalized = text.toLowerCase()
  return ABUSE_WORDS.some(word => normalized.includes(word))
}

export function sanitizeStudentMessage(text: string) {
  return text
    .replace(PHONE_RE, '[blocked]')
    .replace(EMAIL_RE, '[blocked]')
    .replace(URL_RE, '[blocked]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

export function canSendFreeText(text: string) {
  const clean = text.trim()
  return clean.length > 0 && clean.length <= 160 && !containsPersonalInfo(clean) && !containsAbuse(clean)
}

export const unsafeMessageBn = 'এই room-এ personal info বা link share করা যাবে না।'
