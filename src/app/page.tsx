'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import {
  BookOpen,
  Brain,
  ChevronRight,
  Compass,
  Ear,
  FileText,
  Globe2,
  HeartHandshake,
  Map,
  Mic,
  Network,
  Radio,
  Sparkles,
  Trees,
  Waves,
  Youtube,
  Zap,
} from 'lucide-react'

const features = [
  { icon: Mic, title: 'Voice tutor', desc: 'Ask in Bangla, get calm step-by-step help with speech, text, and photo input.' },
  { icon: Network, title: 'Graph learning', desc: 'Every answer connects concepts, weak topics, and practice paths into a visual map.' },
  { icon: Brain, title: 'Emotion aware', desc: 'Confused, confident, or frustrated: the tutor adapts tone and explanation depth.' },
  { icon: BookOpen, title: 'Student memory', desc: 'History, progress, and peer wisdom help students see what to study next.' },
]

const works = [
  { icon: Mic, title: 'Voice Question', desc: 'Students speak or type naturally in Bangla, mixed English, or a mother-tongue mode.' },
  { icon: Brain, title: 'AI Understanding', desc: 'The tutor reads intent, emotion, subject, and previous learning memory.' },
  { icon: Map, title: 'Visual Learning', desc: 'The answer becomes a calm explanation, concept diagram, and next practice path.' },
]

const learners = [
  { icon: BookOpen, title: 'Bangla learners', desc: 'Conversational Bangla explanations without textbook intimidation.' },
  { icon: Trees, title: 'Rural students', desc: 'Low-friction learning flows designed for slow networks and shared devices.' },
  { icon: Ear, title: 'Deaf students', desc: 'BdSL avatar mode turns lessons into accessible visual support.' },
  { icon: Globe2, title: 'Indigenous communities', desc: 'Chakma, Marma, and Garo bridge modes keep learning close to identity.' },
  { icon: Radio, title: 'Low bandwidth users', desc: 'Offline-friendly packs and short answers reduce load when signal is weak.' },
]

const adaptive = [
  'Emotion-aware tutoring',
  'Personalized explanations',
  'Concept graph memory',
  'Adaptive difficulty',
]

const testimonials = [
  { name: 'Class 10 learner', quote: 'I can ask the same thing twice without feeling embarrassed. The answer gets simpler.' },
  { name: 'Rural science student', quote: 'The diagram helps me see the chapter instead of memorizing lines blindly.' },
  { name: 'Future classroom vision', quote: 'A tutor that remembers confusion patterns can guide whole communities, not just one student.' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 28, filter: 'blur(12px)' },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: i * 0.08, duration: 0.72, ease: [0.16, 1, 0.3, 1] },
  }),
}

function RevealSection({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '-120px' })

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 38, filter: 'blur(14px)' }}
      animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
      transition={{ type: 'spring', stiffness: 72, damping: 18 }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <div className="mb-3 inline-flex rounded-full border border-white/70 bg-white/64 px-4 py-2 text-xs font-semibold text-forest shadow-sm backdrop-blur-xl">
        {eyebrow}
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">{title}</h2>
      <p className="mt-4 text-sm leading-relaxed text-ink/58 md:text-base">{sub}</p>
    </div>
  )
}

function FeatureReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })

  return (
    <section ref={ref} className="mx-auto max-w-6xl px-4 pb-28 pt-20 md:pt-32">
      <motion.div
        initial={{ opacity: 0, y: 34, filter: 'blur(16px)' }}
        animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : undefined}
        transition={{ type: 'spring', stiffness: 70, damping: 18 }}
        className="mb-8 text-center"
      >
        <p className="text-sm font-semibold text-forest">The learning experience opens up as you scroll</p>
        <h2 className="mt-2 font-display text-3xl font-bold text-slate-900 md:text-4xl">Four ways VoicePandita feels different</h2>
      </motion.div>
      <div className="grid gap-4 md:grid-cols-4">
        {features.map((feature, index) => (
          <motion.article
            key={feature.title}
            initial={{ opacity: 0, y: 46, filter: 'blur(18px)', scale: 0.96 }}
            animate={inView ? { opacity: 1, y: [34, -6, 0], filter: 'blur(0px)', scale: 1 } : undefined}
            transition={{ delay: index * 0.12, type: 'spring', stiffness: 92, damping: 16 }}
            whileHover={{ y: -8, transition: { type: 'spring', stiffness: 260, damping: 18 } }}
            className="card group p-6"
          >
            <motion.div
              animate={inView ? { y: [0, -5, 0] } : undefined}
              transition={{ delay: 0.4 + index * 0.12, duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-forest/12 to-aqua/30"
            >
              <feature.icon size={21} className="text-forest" />
            </motion.div>
            <h3 className="font-semibold text-ink">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/55">{feature.desc}</p>
          </motion.article>
        ))}
      </div>
    </section>
  )
}

function GraphPreview() {
  const nodes = [
    { label: 'Question', x: '10%', y: '45%' },
    { label: 'Minerals', x: '36%', y: '28%' },
    { label: 'Examples', x: '62%', y: '48%' },
    { label: 'Weak Topic', x: '42%', y: '70%' },
    { label: 'Next Practice', x: '78%', y: '26%' },
  ]

  return (
    <div className="card relative mx-auto h-[360px] max-w-4xl overflow-hidden p-6">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.08),transparent_42%),linear-gradient(240deg,rgba(165,243,252,0.16),transparent_48%)]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 900 360" aria-hidden="true">
        <motion.path d="M150 170 C290 90 430 105 540 175 S710 225 785 105" fill="none" stroke="rgba(99,102,241,.38)" strokeWidth="2" strokeDasharray="8 10" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.5, ease: 'easeInOut' }} />
        <motion.path d="M150 170 C280 250 370 275 450 255 S640 135 785 105" fill="none" stroke="rgba(14,116,144,.28)" strokeWidth="2" strokeDasharray="6 12" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.8, delay: 0.2, ease: 'easeInOut' }} />
      </svg>
      {nodes.map((node, index) => (
        <motion.div
          key={node.label}
          initial={{ opacity: 0, scale: 0.82, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.12, type: 'spring', stiffness: 120, damping: 16 }}
          className="absolute rounded-2xl border border-white/70 bg-white/78 px-4 py-3 text-sm font-semibold text-ink shadow-xl shadow-forest/10 backdrop-blur-xl"
          style={{ left: node.x, top: node.y }}
        >
          {node.label}
        </motion.div>
      ))}
      <div className="relative z-10 max-w-xs">
        <div className="mb-2 inline-flex rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">Neo4j-inspired memory</div>
        <h3 className="font-display text-2xl font-bold text-slate-900">A graph that remembers learning, not just chats.</h3>
      </div>
    </div>
  )
}

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const meshY = useTransform(scrollYProgress, [0, 1], [0, 80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.72])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="ai-shell min-h-dvh overflow-hidden">
      <nav className="sticky top-0 z-50 border-b border-white/50 bg-white/54 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-display text-xl font-bold tracking-tight">
            Voice<span className="bg-gradient-to-r from-forest to-indigo bg-clip-text text-transparent">Pandita</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/docs" className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-ink/58 hover:bg-white/70 hover:text-ink">
              <FileText size={15} className="text-forest" />
              Docs
            </Link>
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-medium text-ink/58 hover:bg-white/70 hover:text-ink">
              Login
            </Link>
            <motion.div whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.98 }}>
              <Link href="/learn" className="soft-button inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold">
                শুরু করো
                <ChevronRight size={16} />
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      <main>
        <section ref={heroRef} className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 pb-28 pt-20 lg:grid-cols-[1fr_0.85fr]">
          <motion.div style={{ y: meshY, opacity: heroOpacity }} className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(196,181,253,.18),transparent_36%),linear-gradient(245deg,rgba(165,243,252,.22),transparent_44%),linear-gradient(15deg,rgba(253,186,116,.12),transparent_52%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-16 -z-10 h-72 bg-[linear-gradient(90deg,transparent,rgba(99,102,241,.10),rgba(165,243,252,.10),transparent)] blur-3xl" />

          <motion.div initial="hidden" animate="visible" className="relative z-10">
            <motion.div custom={0} variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/66 px-4 py-2 text-sm font-semibold text-forest shadow-sm backdrop-blur-xl">
              <Sparkles size={15} />
              Bangladesh-first AI learning companion
            </motion.div>
            <motion.h1 custom={1} variants={fadeUp} className="relative max-w-3xl font-display text-5xl font-bold leading-[1.03] tracking-tight text-slate-900 md:text-6xl">
              <span className="absolute inset-x-0 top-1/2 -z-10 h-16 -translate-y-1/2 bg-gradient-to-r from-forest/10 via-aqua/10 to-transparent blur-2xl" />
              Learn with a tutor that feels calm, visual, and alive.
            </motion.h1>
            <motion.p custom={2} variants={fadeUp} className="bangla mt-6 max-w-2xl text-lg leading-relaxed text-ink/62">
              বাংলায় প্রশ্ন করো, AI tutor উত্তর দেবে conversational ভাবে। Concept diagram, voice, history, progress, and GraphDB memory এক জায়গায়।
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-9 flex flex-col gap-3 sm:flex-row">
              <motion.div whileHover={{ scale: 1.035, y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link href="/learn" className="soft-button inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold">
                  শুরু করো - সম্পূর্ণ free
                  <ChevronRight size={18} />
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.025, y: -2 }} whileTap={{ scale: 0.98 }}>
                <Link href="/profile" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/70 bg-white/68 px-8 py-4 text-base font-semibold text-ink shadow-lg shadow-forest/5 backdrop-blur-xl hover:bg-white">
                  <Brain size={18} className="text-forest" />
                  Student space
                </Link>
              </motion.div>
            </motion.div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="relative">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} className="card relative p-5 md:p-6">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">AI Tutor Studio</div>
                  <div className="text-xs text-ink/45">Live learning preview</div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-aqua/35 px-3 py-1 text-xs font-semibold text-cyan-700">
                  <Waves size={13} /> Calm mode
                </div>
              </div>
              <div className="space-y-4">
                <div className="ml-auto max-w-[82%] rounded-[1.35rem] rounded-br-md bg-gradient-to-br from-forest to-indigo px-5 py-3 text-white shadow-xl shadow-forest/20">
                  খনিজ পদার্থ কী?
                </div>
                <div className="rounded-[1.35rem] border border-white/70 bg-white/72 p-5 shadow-sm backdrop-blur-xl">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="rounded-full bg-aqua/35 px-3 py-1 text-xs font-semibold text-cyan-700">Confident</span>
                    <span className="rounded-full bg-forest/10 px-3 py-1 text-xs font-semibold text-forest">Geography → Minerals</span>
                  </div>
                  <p className="bangla leading-relaxed text-ink/76">
                    খনিজ পদার্থ হলো প্রাকৃতিকভাবে পাওয়া পদার্থ, যেমন লোহা, তামা, কয়লা, লবণ ও চুনাপাথর। এগুলো শিল্প, জ্বালানি ও দৈনন্দিন জীবনে কাজে লাগে।
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-white/70 bg-white/62 p-4 backdrop-blur-xl">
                  <div className="mb-3 text-xs font-semibold text-forest">Concept map</div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-ink/70">
                    {['প্রাকৃতিক উৎস', 'খনিজ পদার্থ', 'ব্যবহার'].map(item => (
                      <div key={item} className="rounded-2xl bg-gradient-to-br from-white to-paper px-3 py-3 shadow-sm">{item}</div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>

        <FeatureReveal />

        <RevealSection className="mx-auto max-w-6xl px-4 pb-28">
          <SectionHeading eyebrow="How it works" title="From question to understanding" sub="A three-step learning flow that feels conversational, visual, and personal." />
          <div className="relative grid gap-5 md:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-12 hidden h-px bg-gradient-to-r from-transparent via-forest/35 to-transparent md:block" />
            {works.map((item, index) => (
              <motion.article key={item.title} custom={index} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover={{ y: -6 }} className="card p-6">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-forest/12 to-aqua/30">
                  <item.icon className="text-forest" size={23} />
                </div>
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/56">{item.desc}</p>
              </motion.article>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="mx-auto max-w-6xl px-4 pb-28">
          <SectionHeading eyebrow="Built for every learner" title="Warm technology for real classrooms" sub="VoicePandita is designed around access, confidence, language, and different ways of learning." />
          <div className="grid gap-4 md:grid-cols-5">
            {learners.map((item, index) => (
              <motion.article key={item.title} custom={index} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover={{ y: -6 }} className="card p-5">
                <item.icon className="mb-5 text-forest" size={24} />
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-ink/55">{item.desc}</p>
              </motion.article>
            ))}
          </div>
        </RevealSection>

        <RevealSection className="mx-auto max-w-6xl px-4 pb-28">
          <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <div className="mb-3 inline-flex rounded-full border border-white/70 bg-white/64 px-4 py-2 text-xs font-semibold text-forest shadow-sm backdrop-blur-xl">Adaptive AI Experience</div>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">A tutor that notices how learning feels.</h2>
              <p className="mt-4 leading-relaxed text-ink/58">
                The platform combines emotion cues, concept history, graph memory, and explanation modes so each answer can become simpler, more visual, or more exam-ready.
              </p>
            </div>
            <div className="card p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                {adaptive.map((item, index) => (
                  <motion.div key={item} custom={index} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="rounded-2xl border border-white/70 bg-white/58 p-4">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-forest/10">
                      <Zap size={18} className="text-forest" />
                    </div>
                    <div className="font-semibold text-ink">{item}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </RevealSection>

        <RevealSection className="mx-auto max-w-6xl px-4 pb-28">
          <SectionHeading eyebrow="Why not just YouTube?" title="Passive watching is not the same as being taught" sub="VoicePandita responds to the exact question, remembers patterns, and adapts the next explanation." />
          <div className="grid gap-5 md:grid-cols-2">
            <motion.article whileHover={{ y: -5 }} className="card p-7">
              <Youtube className="mb-5 text-clay" size={28} />
              <h3 className="font-display text-2xl font-bold">YouTube</h3>
              <ul className="mt-5 space-y-3 text-sm text-ink/58">
                <li>One-way passive content</li>
                <li>Hard to ask follow-up questions</li>
                <li>No memory of weak topics</li>
                <li>Same explanation for every student</li>
              </ul>
            </motion.article>
            <motion.article whileHover={{ y: -5 }} className="card p-7">
              <Compass className="mb-5 text-forest" size={28} />
              <h3 className="font-display text-2xl font-bold">VoicePandita</h3>
              <ul className="mt-5 space-y-3 text-sm text-ink/58">
                <li>Two-way adaptive tutoring</li>
                <li>Voice, text, image, and diagram modes</li>
                <li>Concept graph and history memory</li>
                <li>Emotion-aware explanations for real students</li>
              </ul>
            </motion.article>
          </div>
        </RevealSection>

        <RevealSection className="mx-auto max-w-6xl px-4 pb-28">
          <SectionHeading eyebrow="Knowledge graph visualization" title="Learning becomes a living map" sub="A modern AI memory layer can show concepts, questions, answers, and weak topics as connected learning paths." />
          <GraphPreview />
        </RevealSection>

        <RevealSection className="mx-auto max-w-6xl px-4 pb-28">
          <SectionHeading eyebrow="Future vision" title="A softer AI classroom for Bangladesh" sub="These are the learning moments VoicePandita is being shaped around." />
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((item, index) => (
              <motion.article key={item.name} custom={index} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover={{ y: -6 }} className="card p-6">
                <HeartHandshake className="mb-5 text-forest" size={24} />
                <p className="leading-relaxed text-ink/66">"{item.quote}"</p>
                <div className="mt-5 text-sm font-semibold text-ink">{item.name}</div>
              </motion.article>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/learn" className="soft-button inline-flex items-center gap-2 px-8 py-4 text-base font-semibold">
              Open the tutor
              <ChevronRight size={18} />
            </Link>
          </div>
        </RevealSection>
      </main>
    </motion.div>
  )
}
