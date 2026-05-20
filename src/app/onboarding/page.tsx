'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft } from 'lucide-react'

const steps = [
  {
    id: 'level',
    q: 'তুমি এখন কোথায় আছ?',
    sub: 'তোমার পড়াশোনার স্তর বেছে নাও',
    opts: [
      { val: 'hsc',        label: 'HSC',        sub: 'একাদশ-দ্বাদশ শ্রেণি' },
      { val: 'university', label: 'University',  sub: 'স্নাতক পর্যায়' },
      { val: 'graduate',   label: 'Graduate',    sub: 'স্নাতকোত্তর' },
      { val: 'job',        label: 'Job Seeker',  sub: 'চাকরির প্রস্তুতি' },
    ],
  },
  {
    id: 'goal',
    q: 'তোমার মূল লক্ষ্য কী?',
    sub: 'এটা জানলে আমরা তোমার path customize করতে পারব',
    opts: [
      { val: 'admission', label: 'Admission',    sub: 'বিশ্ববিদ্যালয়ে ভর্তি' },
      { val: 'skill',     label: 'Skill Build',  sub: 'নতুন দক্ষতা অর্জন' },
      { val: 'english',   label: 'English',      sub: 'English ভালো করতে চাই' },
      { val: 'job',       label: 'Job Prep',     sub: 'চাকরির ইন্টার্ভিউ' },
    ],
  },
  {
    id: 'english',
    q: 'তোমার English এখন কেমন?',
    sub: 'সৎভাবে বলো — judgment নেই, শুধু সাহায্য করতে চাই',
    opts: [
      { val: 'weak',     label: 'খুব দুর্বল',  sub: 'বুঝতে পারি না' },
      { val: 'moderate', label: 'মোটামুটি',    sub: 'কিছুটা পারি' },
      { val: 'good',     label: 'ভালো',        sub: 'স্বাচ্ছন্দ্য আছে' },
    ],
  },
  {
    id: 'resume',
    q: 'Resume আছে তোমার?',
    sub: 'আমরা CV review করতে পারব',
    opts: [
      { val: 'yes',      label: 'হ্যাঁ, আছে',    sub: 'Upload করব' },
      { val: 'no',       label: 'নেই',           sub: 'AI দিয়ে বানাব' },
      { val: 'building', label: 'বানাচ্ছি',      sub: 'Help দরকার' },
    ],
  },
  {
    id: 'interview',
    q: 'আগে কোনো Interview দিয়েছ?',
    sub: 'এটা জানলে mock interview customize করা যাবে',
    opts: [
      { val: 'never',  label: 'কখনো না',   sub: 'একদম নতুন' },
      { val: 'few',    label: 'কয়েকবার',   sub: 'কিছু experience আছে' },
      { val: 'regular',label: 'নিয়মিত',    sub: 'তবুও improve করতে চাই' },
    ],
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]       = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [dir, setDir]         = useState(1)

  const current  = steps[step]
  const selected = answers[current.id]

  function pick(val: string) {
    setAnswers(a => ({ ...a, [current.id]: val }))
  }

  function next() {
    if (!selected) return
    if (step < steps.length - 1) {
      setDir(1)
      setStep(s => s + 1)
    } else {
      // Save to localStorage and go to dashboard
      localStorage.setItem('vp_profile', JSON.stringify({ ...answers, [current.id]: selected }))
      router.push('/learn')
    }
  }

  function back() {
    if (step === 0) { router.push('/'); return }
    setDir(-1)
    setStep(s => s - 1)
  }

  const progress = ((step + 1) / steps.length) * 100

  return (
    <div className="min-h-dvh bg-cream flex flex-col items-center justify-center px-4 py-12">

      {/* Progress */}
      <div className="w-full max-w-md mb-10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-ink/40 font-mono">{step + 1} / {steps.length}</span>
          <span className="bangla text-xs text-ink/40">প্রায় শেষ…</span>
        </div>
        <div className="h-1.5 bg-black/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-saffron rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -dir * 60 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="bangla font-display text-2xl md:text-3xl font-bold text-center mb-2 leading-snug">
              {current.q}
            </h2>
            <p className="bangla text-center text-ink/50 text-sm mb-8">{current.sub}</p>

            <div className="space-y-3">
              {current.opts.map(opt => (
                <button
                  key={opt.val}
                  onClick={() => pick(opt.val)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    selected === opt.val
                      ? 'border-saffron bg-saffron/5 shadow-md shadow-saffron/10'
                      : 'border-black/8 bg-white hover:border-saffron/40 hover:bg-saffron/2'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${
                      selected === opt.val ? 'border-saffron bg-saffron' : 'border-black/20'
                    }`}>
                      {selected === opt.val && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-full h-full rounded-full bg-white scale-50"
                        />
                      )}
                    </div>
                    <div>
                      <div className="bangla font-semibold text-ink">{opt.label}</div>
                      <div className="bangla text-xs text-ink/50 mt-0.5">{opt.sub}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav buttons */}
      <div className="flex items-center gap-3 mt-8 w-full max-w-md">
        <button
          onClick={back}
          className="flex items-center gap-1.5 text-ink/40 hover:text-ink transition-colors text-sm px-3 py-2">
          <ChevronLeft size={16} /> Back
        </button>
        <button
          onClick={next}
          disabled={!selected}
          className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-full text-base font-semibold transition-all ${
            selected
              ? 'bg-saffron text-white shadow-lg shadow-saffron/20 hover:bg-saffron/90 hover:-translate-y-0.5'
              : 'bg-black/5 text-ink/30 cursor-not-allowed'
          }`}
        >
          <span className="bangla">
            {step === steps.length - 1 ? 'শুরু করো' : 'পরের প্রশ্ন'}
          </span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
