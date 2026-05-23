'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { BookOpen, ChevronRight, Globe, Mic, Star, Zap } from 'lucide-react'

const features = [
  { icon: Mic, title: 'Voice-First', desc: 'বাংলায় কথা বলো - AI বুঝবে, উত্তর দেবে', color: 'bg-saffron/10 text-saffron' },
  { icon: BookOpen, title: 'NCTB Curriculum', desc: 'SSC/HSC syllabus অনুযায়ী সব উত্তর grounded', color: 'bg-forest/10 text-forest' },
  { icon: Zap, title: 'Visual Explanation', desc: 'Diagram + Animation + Step-by-step - তোমার choice', color: 'bg-gold/15 text-gold' },
  { icon: Globe, title: 'Chakma Support', desc: 'Chakma, Marma, Garo ভাষায় পড়ার সুযোগ', color: 'bg-indigo/10 text-indigo' },
]

const stats = [
  { n: '11M+', label: 'Rural students served' },
  { n: '4M+', label: 'Indigenous learners' },
  { n: '< 1s', label: 'Voice response time' },
  { n: 'BDT 0', label: 'Cost to start' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.58, ease: [0.16, 1, 0.3, 1] },
  }),
}

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <nav className="sticky top-0 z-50 border-b border-forest/10 bg-cream/78 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <span className="font-display text-xl font-bold tracking-tight">
            Voice<span className="text-saffron">Pandita</span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-3 py-2 text-sm text-ink/60 hover:text-ink">
              Login
            </Link>
            <Link href="/learn" className="rounded-full bg-forest px-4 py-2 text-sm font-medium text-white shadow-sm shadow-forest/20 hover:bg-forest/90">
              শুরু করো
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative flex-1 overflow-hidden px-4 pb-24 pt-20 text-center">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-paper/70 to-transparent pointer-events-none" />

        <motion.div initial="hidden" animate="visible" className="relative z-10 mx-auto max-w-4xl">
          <motion.div custom={0} variants={fadeUp} className="mb-8 inline-flex items-center gap-2 rounded-full border border-saffron/20 bg-white/78 px-4 py-1.5 text-sm font-medium text-saffron shadow-sm">
            <Star size={14} fill="currentColor" />
            <span className="bangla">Bangladesh-এর প্রথম Voice AI Tutor</span>
          </motion.div>

          <motion.h1 custom={1} variants={fadeUp} className="mb-6 font-display text-5xl font-bold leading-[1.08] text-ink md:text-7xl">
            শিখো তোমার
            <span className="block text-forest">নিজের ভাষায়</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp} className="bangla mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-ink/64 md:text-xl">
            Voice দাও, visual পাও। Bangla-তে প্রশ্ন করো, diagram, animation, step-by-step explanation পেয়ে যাও।
            NCTB curriculum অনুযায়ী, student-first learning flow।
          </motion.p>

          <motion.div custom={3} variants={fadeUp} className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/learn" className="group inline-flex items-center gap-2 rounded-full bg-saffron px-8 py-4 text-base font-semibold text-white shadow-lg shadow-saffron/20 hover:-translate-y-0.5 hover:bg-saffron/90 hover:shadow-xl hover:shadow-saffron/25">
              <span className="bangla">এখনই শুরু করো</span>
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/learn" className="inline-flex items-center gap-2 rounded-full border border-forest/12 bg-white/86 px-8 py-4 text-base font-semibold text-ink shadow-sm hover:border-forest/24 hover:bg-paper/80">
              <Mic size={18} className="text-saffron" />
              <span className="bangla">Demo দেখো</span>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="mx-auto mt-20 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-forest to-indigo shadow-2xl shadow-forest/24"
        >
          <Mic size={40} className="text-white" />
        </motion.div>
      </section>

      <section className="bg-gradient-to-r from-forest via-indigo to-forest py-12 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 text-center md:grid-cols-4">
          {stats.map((s, i) => (
            <motion.div key={s.label} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="font-display text-3xl font-bold text-gold md:text-4xl">{s.n}</div>
              <div className="mt-1 text-sm text-white/70">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-4 text-center font-display text-3xl font-bold md:text-4xl">
            কেন VoicePandita?
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="bangla mb-16 text-center text-ink/54">
            অন্য সব edtech-এর চেয়ে আলাদা - এটা তোমার জন্য বানানো
          </motion.p>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {features.map((f, i) => (
              <motion.div key={f.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} className="card cursor-default p-8 hover:-translate-y-1">
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg ${f.color}`}>
                  <f.icon size={22} />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="bangla leading-relaxed text-ink/60">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-paper/72 px-4 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-display text-3xl font-bold md:text-4xl">আজই শুরু করো</h2>
          <p className="bangla mb-8 text-ink/60">
            Registration করো, ২ মিনিটে onboarding শেষ করো, আর voice দিয়ে প্রথম প্রশ্ন করো।
          </p>
          <Link href="/learn" className="inline-flex items-center gap-2 rounded-full bg-saffron px-10 py-4 text-base font-semibold text-white shadow-lg shadow-saffron/20 hover:bg-saffron/90">
            <span className="bangla">শুরু করো - সম্পূর্ণ free</span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-forest/10 px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <span className="font-display font-bold">Voice<span className="text-saffron">Pandita</span></span>
          <span className="bangla text-sm text-ink/40">Built for Bangladesh - The Infinity AI BuildFest 2026</span>
        </div>
      </footer>
    </div>
  )
}

