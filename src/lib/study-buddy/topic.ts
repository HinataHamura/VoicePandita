const STOPWORDS = new Set([
  'what', 'why', 'how', 'this', 'that', 'with', 'about', 'bujhi', 'bujhao', 'ki', 'keno',
  'কি', 'কেন', 'কিভাবে', 'বুঝি', 'বুঝাও', 'বুঝতে', 'না', 'এই', 'টা', 'টি', 'হলো',
])

const KNOWN_TOPICS = [
  { key: 'physics-newtons-second-law', title: "Newton's Second Law", subject: 'physics', match: /(newton|2nd|second law|f\s*=?\s*ma|force|acceleration|বল|ত্বরণ|ভর)/i },
  { key: 'biology-photosynthesis', title: 'Photosynthesis', subject: 'biology', match: /(photosynthesis|সালোক|উদ্ভিদ|chlorophyll|co2|oxygen|গ্লুকোজ)/i },
  { key: 'chemistry-ionic-bonding', title: 'Ionic Bonding', subject: 'chemistry', match: /(ionic|ion|electron transfer|আয়নিক|আয়ন|ইলেকট্রন)/i },
  { key: 'chemistry-acid-base', title: 'Acid and Base', subject: 'chemistry', match: /(acid|base|অম্ল|ক্ষার|ph)/i },
  { key: 'math-quadratic-equation', title: 'Quadratic Equation', subject: 'math', match: /(quadratic|দ্বিঘাত|ax\^?2|সমীকরণ)/i },
  { key: 'ict-networking', title: 'Computer Networking', subject: 'ict', match: /(network|internet|router|protocol|নেটওয়ার্ক)/i },
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
  const source = [params.subject, params.conceptHint, params.questionText].filter(Boolean).join(' ')
  const known = KNOWN_TOPICS.find(item => item.match.test(source))
  if (known) {
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
