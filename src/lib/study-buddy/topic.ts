const STOPWORDS = new Set([
  'what', 'why', 'how', 'this', 'that', 'with', 'about', 'bujhi', 'bujhao', 'ki', 'keno',
  'কি', 'কেন', 'কিভাবে', 'বুঝি', 'বুঝাও', 'বুঝতে', 'না', 'এই', 'টা', 'টি', 'হলো',
])

// Patterns are word-anchored on purpose: bare fragments like `ion` or `ph`
// matched inside unrelated words ("projectile motion", "thermodynamics") and
// collapsed every topic onto the same few rooms, which reused one cached quiz.
const KNOWN_TOPICS = [
  { key: 'physics-newtons-second-law', title: "Newton's Second Law", subject: 'physics', match: /(\bnewton\b|\bsecond law\b|\b2nd law\b|\bf\s*=\s*ma\b|নিউটন|দ্বিতীয় সূত্র)/i },
  { key: 'biology-photosynthesis', title: 'Photosynthesis', subject: 'biology', match: /(\bphotosynthesis\b|সালোকসংশ্লেষ|\bchlorophyll\b|ক্লোরোফিল)/i },
  { key: 'chemistry-ionic-bonding', title: 'Ionic Bonding', subject: 'chemistry', match: /(\bionic\s+bond\w*\b|\belectron\s+transfer\b|আয়নিক\s*বন্ধন)/i },
  { key: 'chemistry-acid-base', title: 'Acid and Base', subject: 'chemistry', match: /(\bacids?\b|\bbases?\b|\bph\s+scale\b|অম্ল|ক্ষার)/i },
  { key: 'math-quadratic-equation', title: 'Quadratic Equation', subject: 'math', match: /(\bquadratic\b|দ্বিঘাত)/i },
  { key: 'ict-networking', title: 'Computer Networking', subject: 'ict', match: /(\bnetworking\b|\bnetworks?\b|\brouters?\b|\bprotocols?\b|নেটওয়ার্ক)/i },
]

export function normalizeStudyText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\w\u0980-\u09FF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugifyTopic(value: string) {
  const normalized = normalizeStudyText(value)
  const words = normalized
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOPWORDS.has(word))
    .slice(0, 7)
  return words.join('-') || 'general-concept'
}

export function deriveTopic(params: { questionText: string; subject?: string; conceptHint?: string }) {
  // The subject alone must not select a known topic; only the learner's own
  // wording should, otherwise every "physics" room becomes Newton's Second Law.
  const source = [params.conceptHint, params.questionText].filter(Boolean).join(' ')
  const known = KNOWN_TOPICS.find(item => item.match.test(source))
  if (known && (!params.subject || !known.subject || known.subject === params.subject)) {
    return {
      topicKey: known.key,
      topicTitle: known.title,
      subject: params.subject || known.subject,
    }
  }

  const topicTitle = (params.conceptHint || params.questionText).replace(/\s+/g, ' ').trim().slice(0, 70)
  const prefix = params.subject ? `${slugifyTopic(params.subject)}-` : ''
  return {
    topicKey: `${prefix}${slugifyTopic(topicTitle)}`.slice(0, 120),
    topicTitle: topicTitle || 'Learning concept',
    subject: params.subject || null,
  }
}
