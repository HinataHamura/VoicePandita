'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Accessibility,
  BarChart3,
  BookOpen,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe2,
  Layers3,
  Network,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react'
import MermaidDiagram from '@/components/MermaidDiagram'
import type { DocsLiveData } from '@/lib/docs/types'

type Section = {
  id: string
  label: string
  eyebrow: string
  body: string
}

type TeamMember = {
  name: string
  role: string
  email: string
  image: string
}

type DocsConfig = {
  enabled: boolean
  startAt: string
  endAt: string
  teamName: string
  sections: Section[]
  team: TeamMember[]
  version: string
  updatedAt: string
  versions: Array<{ id: string; at: string; by: string; note: string }>
}

const DEFAULT_SECTIONS: Section[] = [
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
    body: 'VoicePandita aims to become Bangladesh\'s inclusive AI learning companion: voice-first, localized, curriculum-aware, offline-capable, and built for students mainstream EdTech leaves behind.',
  },
]

const DEFAULT_TEAM: TeamMember[] = [
  { name: 'VoicePandita Team', role: 'AI tutoring, product, and engineering', email: 'team@voicepandita.local', image: '' },
]

const DEFAULT_CONFIG: DocsConfig = {
  enabled: true,
  startAt: '2026-06-10T00:00',
  endAt: '2026-06-14T23:59',
  teamName: 'Team VoicePandita',
  sections: DEFAULT_SECTIONS,
  team: DEFAULT_TEAM,
  version: 'BuildFest MVP',
  updatedAt: '2026-05-29',
  versions: [{ id: 'initial', at: '2026-05-29T00:00:00.000Z', by: 'system', note: 'Initial live docs configuration.' }],
}

const features = [
  ['Bangla voice tutor', 'Current', 'Groq Whisper + Gemini + browser TTS'],
  ['Visual concept maps', 'Current', 'Mermaid diagrams and teaching animations'],
  ['Emotion-aware support', 'Prototype', 'Text/repetition cues with adaptive tone and TTS speed'],
  ['GraphRAG memory', 'Current', 'Supabase pgvector + Neo4j graph memory'],
  ['Peer Wisdom Network', 'Prototype', 'Repeated concept confusion and hotspot tracking'],
  ['Offline packs', 'Prototype', 'Preloaded subject-based fallback answers'],
  ['Chakma/Marma/Garo', 'Expansion prototype', 'Native-script and A.chik language bridge branch'],
  ['BdSL avatar', 'Expansion prototype', 'IsharaKotha SiGML avatar playback branch'],
]

const apis = [
  ['/api/ask', 'POST', 'Tutor answer, diagram, graph path, emotion-aware prompt'],
  ['/api/transcribe', 'POST', 'Groq Whisper speech-to-text'],
  ['/api/ocr', 'POST', 'Question extraction from uploaded image'],
  ['/api/embeddings', 'POST', 'Embedding service bridge'],
  ['/api/curriculum-memory', 'POST', 'Curriculum memory retrieval/logging'],
  ['/api/graph-memory', 'POST', 'Neo4j graph-memory write path'],
  ['/api/pwn', 'GET/POST', 'Peer Wisdom hotspots and anonymized question logging'],
  ['/api/bdsl-translate', 'POST', 'Sign-dictionary candidate translation'],
]

const roadmap = [
  ['Short term', 'Polish voice-to-visual demo, stabilize Mermaid diagrams, tighten offline fallback, improve PWN views.'],
  ['Mid term', 'Integrate multilingual branch into main app, add teacher dashboards, persist /docs admin config in Supabase.'],
  ['Long term', 'Production consent controls, larger local/offline packs, hosted fine-tuned indigenous-language model, ONNX acoustic emotion detection.'],
]

const architectureDiagram = `flowchart LR
  Student[Student voice text image] --> UI[Next.js React app]
  UI --> API[Next.js API routes]
  API --> STT[Groq Whisper]
  API --> OCR[Gemini OCR extraction]
  API --> RAG[Supabase pgvector retrieval]
  API --> Graph[Neo4j graph memory]
  RAG --> LLM[Gemini Flash tutor]
  Graph --> LLM
  LLM --> Visual[Mermaid concept map]
  LLM --> TTS[Browser TTS]
  LLM --> Logs[Supabase chat and PWN logs]
  LLM --> Avatar[BdSL avatar prototype]`

const dataFlowDiagram = `flowchart LR
  A[Question input] --> B[STT OCR or text parser]
  B --> C[Emotion and language hints]
  C --> D[Curriculum vector search]
  D --> E[Neo4j graph context]
  E --> F[LLM structured answer]
  F --> G[Bangla explanation]
  F --> H[Mermaid diagram]
  F --> I[Spoken answer]
  F --> J[Peer Wisdom log]
  J --> K[Hotspot insights]`

function isVisible(config: DocsConfig) {
  if (!config.enabled) return false
  const now = Date.now()
  const start = new Date(config.startAt).getTime()
  const end = new Date(config.endAt).getTime()
  return now >= start && now <= end
}

function initials(name: string) {
  return name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'VP'
}

function statusClass(status: string) {
  if (status === 'Current') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (status === 'Prototype') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-indigo-100 text-indigo-700 border-indigo-200'
}

function sectionMarkdown(config: DocsConfig) {
  const pitch = config.sections.map(section => `## ${section.label}\n${section.body}`).join('\n\n')
  const team = config.team.map(member => `- ${member.name} - ${member.role} (${member.email})`).join('\n')
  return `# VoicePandita Docs\n\nVersion: ${config.version}\nUpdated: ${config.updatedAt}\n\n${pitch}\n\n## Team\n${team}\n`
}

const DEFAULT_LIVE_DATA: DocsLiveData = {
  docsStatus: 'Loading',
  localKeys: 0,
  sessions: 0,
  apiCount: apis.length,
  featureCount: features.length,
  lastCheckedAt: '',
}

export default function DocsClient({
  initialConfig,
  adminMode,
  initialVisible,
}: {
  initialConfig: DocsConfig
  adminMode: boolean
  initialVisible: boolean
}) {
  const [config, setConfig] = useState<DocsConfig>(initialConfig || DEFAULT_CONFIG)
  const [ready, setReady] = useState(true)
  const [query, setQuery] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [liveStats, setLiveStats] = useState<DocsLiveData>({ ...DEFAULT_LIVE_DATA, docsStatus: initialVisible ? 'Public' : 'Restricted' })
  const [active, setActive] = useState('problem')
  const [draftMember, setDraftMember] = useState<TeamMember>({ name: '', role: '', email: '', image: '' })
  const [dragId, setDragId] = useState<string | null>(null)
  const didMountRef = useRef(false)

  useEffect(() => {
    fetch('/api/docs-live')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return
        const localKeys = Object.keys(window.localStorage).filter(key => key.startsWith('vp_')).length
        const sessions = Object.keys(window.localStorage).filter(key => key.includes('chat') || key.includes('session')).length
        setLiveStats({
          docsStatus: data.docsStatus || (initialVisible ? 'Public' : 'Restricted'),
          apiCount: data.apiCount ?? apis.length,
          featureCount: data.featureCount ?? features.length,
          lastCheckedAt: data.lastCheckedAt || new Date().toISOString(),
          localKeys,
          sessions,
        })
      })
      .catch(() => {
        const localKeys = Object.keys(window.localStorage).filter(key => key.startsWith('vp_')).length
        const sessions = Object.keys(window.localStorage).filter(key => key.includes('chat') || key.includes('session')).length
        setLiveStats(prev => ({ ...prev, localKeys, sessions }))
      })
  }, [initialVisible])

  useEffect(() => {
    if (!adminMode) return
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    const timer = window.setTimeout(() => {
      setSaveState('saving')
      fetch('/api/docs-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
        .then(async res => {
          if (!res.ok) throw new Error(await res.text())
          return res.json()
        })
        .then(payload => {
          if (payload?.config) setConfig(payload.config)
          setSaveState('saved')
        })
        .catch(() => setSaveState('error'))
    }, 700)

    return () => window.clearTimeout(timer)
  }, [adminMode, config])

  const visible = useMemo(() => isVisible(config), [config])
  const filteredSections = useMemo(() => {
    const needle = query.toLowerCase().trim()
    if (!needle) return config.sections
    return config.sections.filter(section => `${section.label} ${section.eyebrow} ${section.body}`.toLowerCase().includes(needle))
  }, [config.sections, query])

  function updateSection(id: string, patch: Partial<Section>) {
    setConfig(prev => ({
      ...prev,
      updatedAt: new Date().toISOString().slice(0, 10),
      sections: prev.sections.map(section => section.id === id ? { ...section, ...patch } : section),
    }))
  }

  function moveSection(id: string, direction: -1 | 1) {
    setConfig(prev => {
      const sections = [...prev.sections]
      const index = sections.findIndex(section => section.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= sections.length) return prev
      const [item] = sections.splice(index, 1)
      sections.splice(nextIndex, 0, item)
      return { ...prev, sections, updatedAt: new Date().toISOString().slice(0, 10) }
    })
  }

  function dropSection(targetId: string) {
    if (!dragId || dragId === targetId) return
    setConfig(prev => {
      const sections = [...prev.sections]
      const from = sections.findIndex(section => section.id === dragId)
      const to = sections.findIndex(section => section.id === targetId)
      if (from < 0 || to < 0) return prev
      const [item] = sections.splice(from, 1)
      sections.splice(to, 0, item)
      return { ...prev, sections, updatedAt: new Date().toISOString().slice(0, 10) }
    })
    setDragId(null)
  }

  function addMember() {
    if (!draftMember.name.trim()) return
    setConfig(prev => ({ ...prev, team: [...prev.team, draftMember], updatedAt: new Date().toISOString().slice(0, 10) }))
    setDraftMember({ name: '', role: '', email: '', image: '' })
  }

  function exportMarkdown() {
    const blob = new Blob([sectionMarkdown(config)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'voicepandita-docs.md'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (!ready) return null

  return (
    <main className="min-h-screen px-4 py-5 text-ink md:px-7">
      <div className="mx-auto max-w-7xl">
        <header className="sticky top-0 z-30 -mx-4 border-b border-white/60 bg-cream/84 px-4 py-3 backdrop-blur-xl md:-mx-7 md:px-7">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest">
                <FileText size={14} /> Live docs module
              </div>
              <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">VoicePandita Docs</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${visible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                {visible ? <Eye size={13} /> : <EyeOff size={13} />} {visible ? 'Public' : 'Restricted'}
              </div>
              <button onClick={exportMarkdown} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink/70 shadow-sm">
                <Download size={13} /> Markdown
              </button>
              <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink/70 shadow-sm">
                <Download size={13} /> PDF
              </button>
              <Link href="/learn" className="rounded-full bg-forest px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo/20">Open app</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-5 py-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.5rem] border border-white/70 bg-white/72 p-6 shadow-xl shadow-indigo/10 backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-forest">YC-style pitch + technical whitepaper</p>
            <h2 className="mt-3 font-display text-4xl font-bold leading-tight md:text-6xl">Bangla voice tutoring for students mainstream EdTech leaves behind.</h2>
            <p className="mt-5 max-w-3xl text-base leading-7 text-ink/68">
              VoicePandita turns Bangla voice questions into curriculum-aware explanations, visual concept maps, spoken answers, and adaptive guidance while building toward native-language, offline, and sign-language inclusion.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['Core loop', 'Voice -> visual -> spoken tutor'],
                ['Data stack', 'Supabase pgvector + Neo4j'],
                ['Inclusion', 'Chakma, Marma, Garo, BdSL'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-indigo/10 bg-indigo/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-forest">{label}</div>
                  <div className="mt-2 text-sm font-semibold text-ink">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [BookOpen, 'Features', liveStats.featureCount.toString(), 'current and roadmap items'],
              [Network, 'Graph + vector', '2', 'implemented retrieval layers'],
              [Globe2, 'Language layer', '3', 'Chakma, Marma, Garo'],
              [Accessibility, 'BdSL assets', '5,547', 'SiGML sign files'],
              [Users, 'Session traces', liveStats.sessions.toString(), `${liveStats.localKeys} local app keys observed`],
              [FileText, 'API routes', liveStats.apiCount.toString(), 'documented tutoring endpoints'],
              [ShieldCheck, 'Docs state', liveStats.docsStatus, `${config.startAt.slice(5)} to ${config.endAt.slice(5)}`],
            ].map(([Icon, label, value, sub]) => {
              const LucideIcon = Icon as typeof BookOpen
              return (
                <div key={String(label)} className="rounded-[1.25rem] border border-white/70 bg-white/70 p-5 shadow-lg shadow-indigo/8 backdrop-blur-xl">
                  <LucideIcon className="mb-4 text-forest" size={20} />
                  <div className="font-display text-3xl font-bold">{String(value)}</div>
                  <div className="mt-1 text-sm font-semibold text-ink">{String(label)}</div>
                  <div className="mt-1 text-xs leading-5 text-ink/55">{String(sub)}</div>
                </div>
              )
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[1.25rem] border border-white/70 bg-white/76 p-3 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <label className="mb-3 flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-ink/55">
                <Search size={15} />
                <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search docs" className="w-full bg-transparent outline-none" />
              </label>
              <nav className="space-y-1">
                {config.sections.map(section => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={() => setActive(section.id)}
                    className={`block rounded-xl px-3 py-2 text-sm font-semibold ${active === section.id ? 'bg-forest text-white' : 'text-ink/62 hover:bg-indigo/8 hover:text-ink'}`}
                  >
                    {section.label}
                  </a>
                ))}
                {['overview', 'features', 'architecture', 'api', 'data', 'ai', 'roadmap', 'team', 'changelog'].map(item => (
                  <a key={item} href={`#${item}`} className="block rounded-xl px-3 py-2 text-sm font-semibold capitalize text-ink/62 hover:bg-indigo/8 hover:text-ink">{item}</a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-6">
            {adminMode && (
              <section className="rounded-[1.5rem] border border-indigo/20 bg-white/82 p-5 shadow-xl shadow-indigo/10 backdrop-blur-xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-forest"><PenLine size={16} /> Admin controls</div>
                    <p className="mt-1 text-xs text-ink/55">
                      Protected admin mode at <span className="font-mono">/docs/admin</span>. Changes autosave to the server config.
                      <span className="ml-2 font-semibold text-forest">Status: {saveState}</span>
                    </p>
                  </div>
                  <button onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))} className={`rounded-full px-4 py-2 text-xs font-bold text-white ${config.enabled ? 'bg-emerald-600' : 'bg-slate-500'}`}>
                    {config.enabled ? 'Visibility ON' : 'Visibility OFF'}
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="text-xs font-semibold text-ink/60">Start date/time<input type="datetime-local" value={config.startAt} onChange={event => setConfig(prev => ({ ...prev, startAt: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink" /></label>
                  <label className="text-xs font-semibold text-ink/60">End date/time<input type="datetime-local" value={config.endAt} onChange={event => setConfig(prev => ({ ...prev, endAt: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink" /></label>
                  <label className="text-xs font-semibold text-ink/60">Version<input value={config.version} onChange={event => setConfig(prev => ({ ...prev, version: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink" /></label>
                  <label className="text-xs font-semibold text-ink/60">Team name<input value={config.teamName} onChange={event => setConfig(prev => ({ ...prev, teamName: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-ink" /></label>
                </div>
              </section>
            )}

            <section id="overview" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-forest"><Sparkles size={16} /> Product overview</div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ['Target users', 'Rural SSC/HSC learners, indigenous language learners, and deaf or hard-of-hearing students.'],
                  ['Core use cases', 'Ask a question, understand visually, hear the answer, revise with guidance, and recover offline.'],
                  ['Current MVP', 'Bangla voice/text/image input with AI explanation, Mermaid concept map, TTS, memory, and adaptive cues.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink/62">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            {filteredSections.map(section => (
              <section
                key={section.id}
                id={section.id}
                draggable={adminMode}
                onDragStart={() => setDragId(section.id)}
                onDragOver={event => adminMode && event.preventDefault()}
                onDrop={() => dropSection(section.id)}
                className={`rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl ${adminMode ? 'cursor-move' : ''}`}
              >
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest">{section.eyebrow}</div>
                <h2 className="font-display text-3xl font-bold">{section.label}</h2>
                <p className="mt-3 max-w-4xl text-sm leading-7 text-ink/68">{section.body}</p>
                {adminMode && (
                  <div className="mt-4 grid gap-2">
                    <div className="flex gap-2">
                      <button onClick={() => moveSection(section.id, -1)} className="rounded-lg border border-slate-200 bg-white p-2 text-ink/60"><ChevronUp size={15} /></button>
                      <button onClick={() => moveSection(section.id, 1)} className="rounded-lg border border-slate-200 bg-white p-2 text-ink/60"><ChevronDown size={15} /></button>
                    </div>
                    <textarea value={section.body} onChange={event => updateSection(section.id, { body: event.target.value })} className="min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-forest" />
                  </div>
                )}
              </section>
            ))}

            <section id="features" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-forest"><Layers3 size={16} /> Feature matrix</div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {features.map(([name, status, detail]) => (
                  <div key={name} className="grid gap-2 border-b border-slate-100 p-4 last:border-b-0 md:grid-cols-[1fr_160px_1.5fr]">
                    <div className="font-semibold">{name}</div>
                    <div><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(status)}`}>{status}</span></div>
                    <div className="text-sm text-ink/62">{detail}</div>
                  </div>
                ))}
              </div>
            </section>

            <section id="architecture" className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/70 bg-white/76 p-5 shadow-lg shadow-indigo/8 backdrop-blur-xl">
                <h2 className="mb-4 font-display text-2xl font-bold">Architecture Diagram</h2>
                <MermaidDiagram chart={architectureDiagram} />
              </div>
              <div className="rounded-[1.5rem] border border-white/70 bg-white/76 p-5 shadow-lg shadow-indigo/8 backdrop-blur-xl">
                <h2 className="mb-4 font-display text-2xl font-bold">Data Flow Diagram</h2>
                <MermaidDiagram chart={dataFlowDiagram} />
              </div>
            </section>

            <section id="api" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <h2 className="font-display text-3xl font-bold">API Documentation</h2>
              <div className="mt-4 grid gap-3">
                {apis.map(([path, method, detail]) => (
                  <div key={path} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[180px_90px_1fr]">
                    <div className="font-mono text-sm font-bold text-forest">{path}</div>
                    <div className="font-mono text-xs font-bold text-ink/55">{method}</div>
                    <div className="text-sm text-ink/64">{detail}</div>
                  </div>
                ))}
              </div>
            </section>

            <section id="data" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <h2 className="font-display text-3xl font-bold">Data Layer</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[
                  ['Sources', 'NCTB-aligned Q&A data, Supabase interaction logs, Neo4j graph memory, Chakma pairs, Marma/Garo prototype resources, user images, voice input, and IsharaKotha SiGML files.'],
                  ['Storage', 'Supabase PostgreSQL, Supabase pgvector, Neo4j, public JSON/JSONL assets, localStorage demo state, and offline subject packs.'],
                  ['Privacy', 'Anonymized question logging, session-based memory, protected routes, text-based emotion hints, and future consent/retention policies.'],
                  ['Quality', 'Unicode preservation, duplicate removal, script validation, structured JSON parsing, diagram fallback, and safe language/sign fallback behavior.'],
                ].map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink/62">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="ai" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <h2 className="font-display text-3xl font-bold">AI Layer</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {[
                  [Volume2, 'Voice + TTS', 'Groq Whisper transcribes voice; browser/local TTS speaks answers with adaptive pacing.'],
                  [BarChart3, 'RAG + GraphRAG', 'Supabase pgvector retrieves curriculum context; Neo4j stores graph-memory paths.'],
                  [Globe2, 'Multilingual branch', 'Chakma Unicode pairs, Marma Myanmar-script validation, and Latin A.chik Garo support.'],
                ].map(([Icon, title, body]) => {
                  const LucideIcon = Icon as typeof Volume2
                  return (
                    <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <LucideIcon className="mb-3 text-forest" size={18} />
                      <h3 className="font-semibold">{String(title)}</h3>
                      <p className="mt-2 text-sm leading-6 text-ink/62">{String(body)}</p>
                    </div>
                  )
                })}
              </div>
            </section>

            <section id="roadmap" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <h2 className="font-display text-3xl font-bold">Product Roadmap</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {roadmap.map(([phase, body]) => (
                  <div key={phase} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo/10 text-forest"><CalendarClock size={17} /></div>
                    <h3 className="font-semibold">{phase}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink/62">{body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="team" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <h2 className="font-display text-3xl font-bold">{config.teamName}</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {config.team.map((member, index) => (
                  <div key={`${member.email}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-4 h-24 w-24 overflow-hidden rounded-2xl border border-indigo/10 bg-gradient-to-br from-indigo/12 to-aqua/30">
                      {member.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={member.image} alt={member.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-display text-2xl font-bold text-forest">{initials(member.name)}</div>
                      )}
                    </div>
                    <h3 className="text-lg font-bold">{member.name}</h3>
                    <p className="mt-1 text-sm text-ink/62">{member.role}</p>
                    <p className="mt-3 break-all font-mono text-xs text-forest">{member.email}</p>
                  </div>
                ))}
              </div>
              {adminMode && (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 font-semibold">Add team member</h3>
                  <div className="grid gap-2 md:grid-cols-4">
                    <input placeholder="Full name" value={draftMember.name} onChange={event => setDraftMember(prev => ({ ...prev, name: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <input placeholder="Role" value={draftMember.role} onChange={event => setDraftMember(prev => ({ ...prev, role: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <input placeholder="Email" value={draftMember.email} onChange={event => setDraftMember(prev => ({ ...prev, email: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <input placeholder="Image URL" value={draftMember.image} onChange={event => setDraftMember(prev => ({ ...prev, image: event.target.value }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <button onClick={addMember} className="mt-3 rounded-full bg-forest px-4 py-2 text-xs font-bold text-white">Add member</button>
                </div>
              )}
            </section>

            <section id="changelog" className="rounded-[1.5rem] border border-white/70 bg-white/76 p-6 shadow-lg shadow-indigo/8 backdrop-blur-xl">
              <h2 className="font-display text-3xl font-bold">Changelog</h2>
              <div className="mt-4 space-y-3">
                {[
                  ...config.versions.map(item => [new Date(item.at).toLocaleString(), `${item.note} (${item.by})`]),
                  ['2026-05-29', 'Live /docs module added with pitch deck, technical documentation, server-backed admin controls, scheduling, search, exports, and team showcase.'],
                  ['BuildFest MVP', 'Voice-to-visual tutoring flow, graph/vector retrieval, PWN prototype, multilingual branch, offline fallback, and BdSL avatar prototype documented.'],
                ].map(([date, item], index) => (
                  <div key={`${date}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="font-mono text-xs font-bold text-forest">{date}</div>
                    <p className="mt-2 text-sm leading-6 text-ink/64">{item}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
