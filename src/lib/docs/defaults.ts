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
    eyebrow: 'Bangladesh wedge, global pattern',
    body: 'The first wedge is rural SSC/HSC science support for students who cannot afford coaching or stable internet. The same access gap exists across South Asia and other multilingual emerging markets, so the product can expand from Bangladesh into Bangla-speaking diaspora learners, low-resource language communities, inclusive education programs, and school networks that need curriculum-grounded AI support.',
  },
  {
    id: 'business',
    label: 'Business Model',
    eyebrow: 'Freemium plus institutional revenue',
    body: 'VoicePandita keeps core student access free through a freemium model: free Bangla Q&A, voice help, and limited revision packs; paid student upgrades for deeper exam prep, saved history, and higher AI usage; school/NGO licensing for teacher dashboards, cohort analytics, and offline packs; and sponsored deployments funded by CSR, donors, or government education programs. This creates a cross-subsidy model where urban/premium and institutional users help keep rural access affordable.',
  },
  {
    id: 'unit-economics',
    label: 'Unit Economics',
    eyebrow: 'Low-cost delivery',
    body: 'The MVP is designed around free-tier and low-cost infrastructure: Vercel, Supabase, pgvector, browser TTS, Gemini/Groq free or low-cost inference, cacheable curriculum chunks, and offline fallback packs. Cost control comes from retrieval before generation, short structured answers, cached textbook explanations, and institution-level batching. Revenue scales by seats, schools, and sponsored packs rather than only per-chat payments.',
  },
  {
    id: 'adoption',
    label: 'Adoption Pathway',
    eyebrow: 'Pilot to scale',
    body: 'Roll out in three phases: first, 2-3 rural or low-income SSC/HSC pilot classrooms with teacher-supervised usage and learning outcome measurement; second, NGO and school partnerships for inclusive education cohorts, including CHT language support and deaf learner workflows; third, district-level and diaspora-supported deployments with teacher dashboards, content packs, and impact reporting. Success metrics: active learners, answered curriculum questions, weak-topic improvement, teacher time saved, offline-pack usage, and retention.',
  },
  {
    id: 'global-readiness',
    label: 'Global Readiness',
    eyebrow: 'NRB and cross-border scale',
    body: 'VoicePandita can become a Bangladesh-origin model for inclusive AI tutoring in multilingual markets. The global strategy is to partner with NRB educators, diaspora mentors, universities, and language-data contributors to validate curriculum content, fund pilots, and adapt the platform to comparable low-resource education contexts. The architecture is modular: language bridges, curriculum packs, RAG sources, school dashboards, and accessibility layers can be localized country by country.',
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
