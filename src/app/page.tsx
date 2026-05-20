'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mic, BookOpen, Zap, Globe, ChevronRight, Star } from 'lucide-react'

const features = [
  { icon: Mic,      title: 'Voice-First',       desc: 'বাংলায় কথা বলো — AI বুঝবে, উত্তর দেবে',        color: 'bg-saffron/10 text-saffron' },
  { icon: BookOpen, title: 'NCTB Curriculum',    desc: 'SSC/HSC syllabus অনুযায়ী সব উত্তর grounded',     color: 'bg-forest/10 text-forest' },
  { icon: Zap,      title: 'Visual Explanation', desc: 'Diagram + Animation + Step-by-step — তোমার choice', color: 'bg-gold/10 text-gold' },
  { icon: Globe,    title: 'Chakma Support',     desc: 'Chakma, Marma, Garo ভাষায় পড়ার সুযোগ',         color: 'bg-clay/10 text-clay' },
]

const stats = [
  { n: '11M+',  label: 'Rural students served' },
  { n: '4M+',   label: 'Indigenous learners' },
  { n: '< 1s',  label: 'Voice response time' },
  { n: 'BDT 0', label: 'Cost to start' },
]

const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  }),
}

export default function HomePage() {
  return (
    <div className="min-h-dvh flex flex-col">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-cream/80 border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-display text-xl font-bold tracking-tight">
            Voice<span className="text-saffron">Pandita</span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-ink/60 hover:text-ink transition-colors px-3 py-2">
              Login
            </Link>
            <Link href="/onboarding"
              className="bg-forest text-white text-sm px-4 py-2 rounded-full hover:bg-forest/90 transition-colors font-medium">
              শুরু করো
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 pt-20 pb-24 relative overflow-hidden">

        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-[10%] w-72 h-72 bg-saffron/8 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-[8%] w-96 h-96 bg-forest/6 rounded-full blur-3xl" />
        </div>

        <motion.div initial="hidden" animate="visible" className="relative z-10 max-w-4xl">

          <motion.div custom={0} variants={fadeUp}
            className="inline-flex items-center gap-2 bg-saffron/10 text-saffron rounded-full px-4 py-1.5 text-sm font-medium mb-8">
            <Star size={14} fill="currentColor" />
            <span className="bangla">Bangladesh-এর প্রথম Voice AI Tutor</span>
          </motion.div>

          <motion.h1 custom={1} variants={fadeUp}
            className="font-display text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
            শিখো তোমার
            <span className="block text-saffron">নিজের ভাষায়</span>
          </motion.h1>

          <motion.p custom={2} variants={fadeUp}
            className="bangla text-lg md:text-xl text-ink/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Voice দাও — Visual পাও। Bangla-তে প্রশ্ন করো, পাও diagram, animation, step-by-step explanation।
            NCTB curriculum অনুযায়ী, সম্পূর্ণ free-তে।
          </motion.p>

          <motion.div custom={3} variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/onboarding"
              className="group inline-flex items-center gap-2 bg-saffron text-white px-8 py-4 rounded-full text-base font-semibold hover:bg-saffron/90 transition-all shadow-lg shadow-saffron/20 hover:shadow-xl hover:shadow-saffron/30 hover:-translate-y-0.5">
              <span className="bangla">এখনই শুরু করো</span>
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/learn"
              className="inline-flex items-center gap-2 bg-white border border-black/10 text-ink px-8 py-4 rounded-full text-base font-semibold hover:bg-paper transition-all">
              <Mic size={18} className="text-saffron" />
              <span className="bangla">Demo দেখো</span>
            </Link>
          </motion.div>
        </motion.div>

        {/* Floating mic visual */}
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          className="mt-20 w-24 h-24 bg-forest rounded-full flex items-center justify-center shadow-2xl shadow-forest/30">
          <Mic size={40} className="text-white" />
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-forest text-white py-12">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s, i) => (
            <motion.div key={s.label} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              <div className="font-display text-3xl md:text-4xl font-bold text-saffron">{s.n}</div>
              <div className="text-white/70 text-sm mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.h2 initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="font-display text-3xl md:text-4xl font-bold text-center mb-4">
            কেন VoicePandita?
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
            className="bangla text-center text-ink/50 mb-16">
            অন্য সব edtech-এর চেয়ে আলাদা — এটা তোমার জন্য বানানো
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }}
                className="card p-8 hover:-translate-y-1 transition-transform cursor-default">
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center mb-5`}>
                  <f.icon size={22} />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="bangla text-ink/60 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 bg-paper">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            আজই শুরু করো
          </h2>
          <p className="bangla text-ink/60 mb-8">
            Registration করো, ২ মিনিটে onboarding শেষ করো, আর voice দিয়ে প্রথম প্রশ্ন করো।
          </p>
          <Link href="/onboarding"
            className="inline-flex items-center gap-2 bg-saffron text-white px-10 py-4 rounded-full text-base font-semibold hover:bg-saffron/90 transition-all shadow-lg shadow-saffron/20">
            <span className="bangla">শুরু করো — সম্পূর্ণ free</span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display font-bold">Voice<span className="text-saffron">Pandita</span></span>
          <span className="bangla text-sm text-ink/40">
            Built for Bangladesh • The Infinity AI BuildFest 2026
          </span>
        </div>
      </footer>
    </div>
  )
}
