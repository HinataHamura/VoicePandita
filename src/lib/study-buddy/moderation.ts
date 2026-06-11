const PHONE_RE = /(?:^|\s)(?:\+?88)?01[3-9]\d{8}(?:\s|$)/
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/
const HANDLE_RE = /(?:^|\s)(?:facebook|fb|whatsapp|telegram|imo|instagram|insta|snapchat|discord)\s*(?:id|number|handle)?\s*[:=]\s*@?\w+/i
const ABUSE_WORDS = [
  'stupid', 'idiot', 'fuck', 'shit', 'bitch',
  'বোকা', 'গাধা', 'হারামি', 'চুতিয়া', 'চুদ', 'মাগী',
]
const EMOJI_RE = /(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])/g
const REPEATED_CHAR_RE = /(.)\1{3,}/

export function containsPersonalInfo(text: string) {
  return PHONE_RE.test(text) || EMAIL_RE.test(text) || URL_RE.test(text) || HANDLE_RE.test(text)
}

export function containsAbuse(text: string) {
  const normalized = text.toLowerCase()
  return ABUSE_WORDS.some(word => normalized.includes(word))
}

export function detectSpam(text: string): { isSpam: boolean; reason?: string } {
  const clean = text.trim()
  if (!clean) return { isSpam: false }
  if (REPEATED_CHAR_RE.test(clean)) return { isSpam: true, reason: 'repeated characters' }

  const emojis = clean.match(EMOJI_RE) || []
  const nonEmoji = clean.replace(EMOJI_RE, '').trim()
  if (emojis.length >= 3 && nonEmoji.length === 0) return { isSpam: true, reason: 'emoji-only message' }

  const letters = clean.match(/[A-Za-z]/g) || []
  const allCaps = clean.match(/[A-Z]/g) || []
  if (letters.length > 0 && allCaps.length === letters.length && clean.length < 10 && allCaps.length >= 3) {
    return { isSpam: true, reason: 'all caps spam' }
  }

  return { isSpam: false }
}

export function sanitizeStudentMessage(text: string) {
  return text
    .replace(PHONE_RE, ' [blocked] ')
    .replace(EMAIL_RE, '[blocked]')
    .replace(URL_RE, '[blocked]')
    .replace(HANDLE_RE, ' [blocked] ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)
}

export function canSendFreeText(text: string) {
  const clean = text.trim()
  const spam = detectSpam(clean)
  return clean.length > 0 && clean.length <= 180 && !containsPersonalInfo(clean) && !containsAbuse(clean) && !spam.isSpam
}

export const unsafeMessageBn = 'এই room-এ phone, link, social id, spam, বা abusive কথা share করা যাবে না। শুধু পড়ার topic নিয়ে আলোচনা করো।'
