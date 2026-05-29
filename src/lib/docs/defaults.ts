import type { DocsConfig, DocsSection, DocsTeamMember } from './types'

export const DEFAULT_DOCS_SECTIONS: DocsSection[] = [
  {
    id: 'problem',
    label: 'Problem',
    eyebrow: 'Why this matters',
    body: 'Bangladesh has millions of rural SSC/HSC students, indigenous learners, and deaf or hard-of-hearing students who are not served well by keyboard-first, urban-focused EdTech. Most tools assume stable internet, strong Bangla/English literacy, and access to coaching support.',
  },
  {
    id: 'solution',
    label: 'Solution',
    eyebrow: 'Voice-first tutoring',
    body: 'VoicePandita lets students ask questions in Bangla by voice, text, or textbook image upload. The system responds with curriculum-aware explanations, visual concept maps, spoken answers, and adaptive guidance.',
  },
  {
    id: 'why-now',
    label: 'Why Now',
    eyebrow: 'AI-native access',
    body: 'Low-cost speech models, multimodal LLMs, pgvector retrieval, Neo4j graph memory, and browser TTS make it possible to build a localized tutor for students who were previously excluded from AI learning.',
  },
  {
    id: 'product-demo',
    label: 'Product Demo',
    eyebrow: 'Core loop',
    body: 'The MVP demonstrates one polished loop: Bangla question -> AI explanation -> visual concept map -> spoken answer -> adaptive guidance. Optional expansion layers include Chakma/Marma/Garo support and BdSL avatar playback.',
  },
  {
    id: 'market',
    label: 'Market Opportunity',
    eyebrow: 'Underserved learners',
    body: 'The first wedge is rural SSC/HSC support. Expansion opportunities include school licensing, inclusive education programs, NGO/government partnerships, and premium personal tutor subscriptions.',
  },
  {
    id: 'business',
    label: 'Business Model',
    eyebrow: 'Sustainable access',
    body: 'VoicePandita can combine student freemium access, premium tutoring plans, school licensing, government education partnerships, and sponsored offline learning packs for low-resource communities.',
  },
  {
    id: 'traction',
    label: 'Traction',
    eyebrow: 'Prototype progress',
    body: 'The product already includes Bangla tutoring flows, visual concept maps, Supabase chat history, pgvector retrieval, Neo4j graph memory, Peer Wisdom logging, offline fallback packs, Chakma/Marma/Garo prototype work, and a BdSL avatar branch.',
  },
  {
    id: 'competition',
    label: 'Competition',
    eyebrow: 'Not another chatbot',
    body: 'Generic AI tutors optimize for broad chat. VoicePandita focuses on Bangladeshi curriculum, voice-first access, low-resource usage, native language inclusion, sign-language accessibility, and community learning intelligence.',
  },
  {
    id: 'advantage',
    label: 'Unique Advantage',
    eyebrow: 'Graph + vector + inclusion',
    body: 'The defensible layer is the combination of curriculum graph memory, semantic retrieval, anonymized confusion hotspots, multilingual bridges, and BdSL sign data. Every student question can improve the next explanation.',
  },
  {
    id: 'gtm',
    label: 'Go-To-Market',
    eyebrow: 'Focused rollout',
    body: 'Start with SSC/HSC science learners, partner with rural schools and teachers, create exam-focused learning packs, then expand through inclusive education partners serving CHT and deaf communities.',
  },
  {
    id: 'vision',
    label: 'Vision',
    eyebrow: 'Learning that belongs',
    body: "VoicePandita aims to become Bangladesh's inclusive AI learning companion: voice-first, localized, curriculum-aware, offline-capable, and built for students mainstream EdTech leaves behind.",
  },
]

export const DEFAULT_DOCS_TEAM: DocsTeamMember[] = [
  { name: 'VoicePandita Team', role: 'AI tutoring, product, and engineering', email: 'team@voicepandita.local', image: '' },
]

export const DEFAULT_DOCS_CONFIG: DocsConfig = {
  enabled: true,
  startAt: '2026-06-10T00:00',
  endAt: '2026-06-14T23:59',
  teamName: 'Team VoicePandita',
  sections: DEFAULT_DOCS_SECTIONS,
  team: DEFAULT_DOCS_TEAM,
  version: 'BuildFest MVP',
  updatedAt: '2026-05-29',
  versions: [
    {
      id: 'initial',
      at: '2026-05-29T00:00:00.000Z',
      by: 'system',
      note: 'Initial live docs configuration.',
    },
  ],
}

export function isDocsVisible(config: DocsConfig, now = new Date()) {
  if (!config.enabled) return false
  const start = new Date(config.startAt).getTime()
  const end = new Date(config.endAt).getTime()
  const current = now.getTime()
  return current >= start && current <= end
}
