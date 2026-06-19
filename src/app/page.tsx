'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Accessibility,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  GraduationCap,
  Languages,
  Mic2,
  Network,
  Radio,
  Sparkles,
  Wifi,
} from 'lucide-react'

const proofPoints = [
  { label: 'Bangla-first tutor', value: 'বাংলা' },
  { label: 'Offline packs', value: 'Low data' },
  { label: 'BdSL support', value: 'Accessible' },
  { label: 'Graph memory', value: 'Personal' },
]

const demoRoutes = [
  { href: '/learn', icon: Mic2, title: 'Live AI Tutor', desc: 'Voice, text, OCR, diagram, and animation-based answers.' },
  { href: '/study-buddy', icon: GraduationCap, title: 'Bondhu Study Room', desc: 'AI-hosted group practice for confused learners.' },
  { href: '/chakma', icon: Languages, title: 'Language Bridge', desc: 'Verified-first Chakma, Marma, and Garo learning support.' },
  { href: '/progress', icon: BrainCircuit, title: 'Student Analytics', desc: 'Weak-topic signals and progress for repeat practice.' },
]

const pillars = [
  {
    icon: BookOpenCheck,
    title: 'Curriculum-grounded answers',
    desc: 'NCTB-style explanations, concept diagrams, and safer fallback behavior when context is thin.',
  },
  {
    icon: Radio,
    title: 'Rural-ready flows',
    desc: 'Short answers, offline content packs, browser TTS, and lightweight screens for weak connections.',
  },
  {
    icon: Accessibility,
    title: 'Inclusive by design',
    desc: 'Bangla, BdSL, and indigenous language bridge modes keep learning close to identity and access.',
  },
]

const deploymentLinks = [
  'https://voice-pandita.vercel.app/',
  'https://voice-pandita-9my2c0pen-esha-s-projects5.vercel.app/',
  'https://voice-pandita-esha-s-projects5.vercel.app',
  'https://voice-pandita-eshafarzana666-6279-esha-s-projects5.vercel.app',
]

const answerSteps = ['প্রশ্ন বুঝি', 'Context খুঁজি', 'ধাপে ধাপে বুঝাই', 'Practice দিই']

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: (index = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.08, duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  }),
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="VoicePandita home">
      <Image src="/icon.jpg" alt="" width={42} height={42} className="h-10 w-10 rounded-md object-cover shadow-lg shadow-forest/20" priority />
      <span className="font-display text-xl font-bold tracking-tight text-ink">
        Voice<span className="text-forest">Pandita</span>
      </span>
    </Link>
  )
}

function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <div className="mx-auto mb-9 max-w-2xl text-center">
      <div className="vp-kicker mx-auto mb-3 w-fit">{eyebrow}</div>
      <h2 className="font-display text-3xl font-bold leading-tight text-ink md:text-5xl">{title}</h2>
      <p className="mt-4 text-sm leading-relaxed text-ink/60 md:text-base">{sub}</p>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="ai-shell min-h-dvh overflow-hidden">
      <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <BrandMark />
          <div className="flex items-center gap-2">
            <Link href="/docs" className="hidden items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-white hover:text-ink sm:inline-flex">
              <FileText size={16} />
              Docs
            </Link>
            <Link href="/login" className="hidden rounded-md px-4 py-2 text-sm font-semibold text-ink/60 hover:bg-white hover:text-ink sm:inline-flex">
              Login
            </Link>
            <Link href="/learn" className="soft-button inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold">
              Demo চালাও
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-8 px-4 pb-16 pt-10 lg:grid-cols-[1fr_0.92fr]">
        <div className="hero-ribbon" aria-hidden="true" />

        <motion.div initial="hidden" animate="visible" className="relative z-10">
          <motion.div variants={fadeUp} custom={0} className="vp-kicker mb-5 w-fit">
            <Sparkles size={15} />
            Bangladesh-first AI tutor
          </motion.div>
          <motion.h1 variants={fadeUp} custom={1} className="max-w-4xl font-display text-5xl font-bold leading-[1.02] text-ink md:text-7xl">
            প্রত্যেক শিক্ষার্থীর জন্য personal AI শিক্ষক।
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="bangla mt-6 max-w-2xl text-lg leading-relaxed text-ink/60">
            VoicePandita বাংলা ভাষায় প্রশ্ন নেয়, curriculum context ধরে উত্তর দেয়, diagram বানায়, voice পড়ে শোনায়, আর weak topic মনে রেখে পরের practice সাজায়।
          </motion.p>
          <motion.div variants={fadeUp} custom={3} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/learn" className="soft-button inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-bold">
              Tutor খুলুন
              <ArrowRight size={18} />
            </Link>
            <Link href="/study-buddy" className="inline-flex items-center justify-center gap-2 rounded-md border border-forest/15 bg-white/80 px-7 py-4 text-base font-bold text-ink shadow-lg shadow-forest/10 backdrop-blur-xl hover:-translate-y-0.5 hover:border-forest/30 hover:bg-white">
              Study Room দেখুন
              <Network size={18} className="text-forest" />
            </Link>
          </motion.div>

          <motion.div variants={fadeUp} custom={4} className="mt-6 max-w-3xl rounded-md border border-forest/15 bg-white/75 p-4 shadow-sm shadow-forest/10 backdrop-blur-xl">
            <div className="flex items-start gap-3">
              <ExternalLink className="mt-0.5 flex-shrink-0 text-forest" size={18} />
              <div>
                <p className="text-sm font-bold text-ink">Main link na khulle ei mirror links try korun</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {deploymentLinks.map((url, index) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-forest/15 bg-paper/80 px-3 py-2 text-xs font-semibold text-forest hover:border-forest/30 hover:bg-white"
                    >
                      Link {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} custom={5} className="mt-9 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            {proofPoints.map(item => (
              <div key={item.label} className="rounded-md border border-white/70 bg-white/70 p-4 shadow-sm shadow-forest/6 backdrop-blur-xl">
                <div className="text-lg font-bold text-ink">{item.value}</div>
                <div className="mt-1 text-xs font-semibold text-ink/50">{item.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="relative"
        >
          <div className="demo-device">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-ink">Live Tutor Preview</div>
                <div className="text-xs font-medium text-ink/45">Bangla voice + RAG + graph memory</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-md bg-forest/10 px-3 py-1.5 text-xs font-bold text-forest">
                <Wifi size={13} />
                Low-data ready
              </div>
            </div>

            <div className="space-y-4">
              <div className="ml-auto max-w-[82%] rounded-md bg-gradient-to-br from-forest to-indigo px-5 py-3 text-white shadow-xl shadow-forest/20">
                সালোকসংশ্লেষণ সহজ করে বুঝাও
              </div>
              <div className="rounded-md border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur-xl">
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="rounded-md bg-forest/10 px-3 py-1 text-xs font-bold text-forest">Curriculum grounded</span>
                  <span className="rounded-md bg-saffron/20 px-3 py-1 text-xs font-bold text-orange-700">Confused learner</span>
                </div>
                <p className="bangla leading-relaxed text-ink/75">
                  গাছ সূর্যের আলো, পানি এবং কার্বন ডাই-অক্সাইড ব্যবহার করে নিজের খাবার তৈরি করে। এই খাবারের নাম গ্লুকোজ, আর পাশে অক্সিজেন বের হয়।
                </p>
                <div className="mt-5 grid grid-cols-4 items-center gap-2 text-center text-xs font-bold text-ink/60">
                  {answerSteps.map((step, index) => (
                    <div key={step} className="relative rounded-md bg-gradient-to-br from-white to-paper px-2 py-3 shadow-sm">
                      {step}
                      {index < answerSteps.length - 1 && <span className="absolute -right-2 top-1/2 hidden h-px w-4 bg-forest/25 md:block" />}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['Diagram', 'Voice', 'Practice'].map(item => (
                  <div key={item} className="rounded-md border border-white/70 bg-white/60 p-3 text-center text-xs font-bold text-ink/60 shadow-sm">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <SectionHeading
          eyebrow="Judge-ready demo paths"
          title="এক ক্লিকেই strongest features"
          sub="Hackathon demo-te judges যেন immediately product depth, inclusion, and working routes বুঝতে পারেন।"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {demoRoutes.map((route, index) => (
            <motion.div key={route.href} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={index}>
              <Link href={route.href} className="card group block h-full p-5">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/20">
                  <route.icon size={21} />
                </div>
                <h3 className="text-base font-bold text-ink">{route.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink/55">{route.desc}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-forest">
                  Open
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14">
        <div className="showcase-band">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1fr] lg:items-center">
            <div>
              <div className="vp-kicker mb-4 w-fit">
                <Globe2 size={15} />
                Inclusion with proof
              </div>
              <h2 className="font-display text-3xl font-bold leading-tight text-ink md:text-5xl">
                শুধু সুন্দর না, mission-aligned সুন্দর।
              </h2>
              <p className="bangla mt-4 leading-relaxed text-ink/60">
                UI ta Bangla-first learning, low connectivity, indigenous language safety, BdSL accessibility, and privacy-first product story ke সামনে আনে।
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {pillars.map((pillar, index) => (
                <motion.article key={pillar.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={index} className="rounded-md border border-white/70 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
                  <pillar.icon className="mb-5 text-forest" size={25} />
                  <h3 className="font-bold text-ink">{pillar.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/55">{pillar.desc}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 pt-12">
        <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr]">
          <div className="card p-7 md:p-9">
            <div className="vp-kicker mb-4 w-fit">Why judges remember it</div>
            <h2 className="font-display text-3xl font-bold text-ink md:text-4xl">A real learning product, not only a chatbot.</h2>
            <div className="mt-6 grid gap-3">
              {[
                'Voice, OCR, diagram, animation, PDF summary, and study buddy routes already visible.',
                'Low-resource language output is handled with verified-first safety rules.',
                'Student memory, peer wisdom, and graph paths make learning feel personal.',
              ].map(item => (
                <div key={item} className="flex gap-3 rounded-md bg-paper/60 p-3 text-sm font-semibold leading-relaxed text-ink/70">
                  <CheckCircle2 className="mt-0.5 flex-shrink-0 text-forest" size={18} />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-md border border-white/70 bg-ink p-7 text-white shadow-2xl shadow-forest/20">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.45),transparent_45%),linear-gradient(315deg,rgba(253,186,116,0.25),transparent_40%)]" />
            <div className="relative">
              <div className="text-sm font-bold text-white/70">Final demo CTA</div>
              <h2 className="mt-4 font-display text-4xl font-bold leading-tight">Ask in Bangla. Learn with dignity.</h2>
              <p className="bangla mt-4 leading-relaxed text-white/70">
                Underserved learners der jonno AI ke approachable, visual, and trustworthy kore তোলাই VoicePandita-r core।
              </p>
              <Link href="/learn" className="mt-8 inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-sm font-bold text-ink shadow-xl hover:-translate-y-0.5">
                Start live demo
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
