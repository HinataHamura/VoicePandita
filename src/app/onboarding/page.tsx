'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Check, ChevronLeft, ChevronRight, GraduationCap, Target } from 'lucide-react'
import { getAuthenticatedStudent } from '@/lib/authFlow'
import { saveStudentProfile } from '@/lib/studentStore'

const steps = [
  {
    id: 'level',
    icon: GraduationCap,
    q: 'তুমি কোন লেভেলের student?',
    sub: 'VoicePandita এখন SSC/HSC/admission focused tutor.',
    opts: [
      { val: 'ssc', label: 'SSC', sub: 'Class 9-10 board preparation' },
      { val: 'hsc', label: 'HSC', sub: 'Class 11-12 board + admission base' },
    ],
  },
  {
    id: 'goal',
    icon: Target,
    q: 'তোমার main target কী?',
    sub: 'Answer format আর follow-up question এই অনুযায়ী বদলাবে।',
    opts: [
      { val: 'board', label: 'Board Exam', sub: 'SSC/HSC CQ, MCQ, short answer practice' },
      { val: 'admission', label: 'Admission', sub: 'Concept-first, fast problem solving' },
    ],
  },
  {
    id: 'group',
    icon: BookOpen,
    q: 'তোমার study group কোনটা?',
    sub: 'Subject selector আর curriculum context personalize হবে।',
    opts: [
      { val: 'science', label: 'Science', sub: 'Physics, Chemistry, Biology, Math' },
      { val: 'humanities', label: 'Humanities', sub: 'Bangla, English, general subjects' },
      { val: 'business', label: 'Business Studies', sub: 'Accounting, finance basics, commerce' },
    ],
  },
]

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center">
          <motion.div
            className={`step-circle ${
              i < current ? 'step-circle-done' : i === current ? 'step-circle-active' : 'step-circle-future'
            }`}
            animate={{ scale: i === current ? 1.08 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {i < current ? <Check size={14} /> : <span>{i + 1}</span>}
          </motion.div>
          {i < total - 1 && (
            <div className={i < current ? 'step-connector' : 'step-connector-future'} style={{ width: 40 }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [dir, setDir] = useState(1)

  useEffect(() => {
    getAuthenticatedStudent().then(student => {
      if (!student) router.replace('/login?next=/onboarding')
    })
  }, [router])

  const current = steps[step]
  const selected = answers[current.id]
  const Icon = current.icon

  function pick(val: string) {
    setAnswers(prev => ({ ...prev, [current.id]: val }))
  }

  function next() {
    if (!selected) return
    if (step < steps.length - 1) {
      setDir(1)
      setStep(prev => prev + 1)
      return
    }
    saveStudentProfile({ ...answers, [current.id]: selected })
    router.push('/student-path')
  }

  function back() {
    if (step === 0) { router.push('/'); return }
    setDir(-1)
    setStep(prev => prev - 1)
  }

  return (
    <div className="ai-shell flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      {/* Step indicator */}
      <div className="mb-10 flex flex-col items-center gap-4">
        <StepIndicator current={step} total={steps.length} />
        <span className="text-xs font-semibold text-ink/40">{step + 1} / {steps.length} ধাপ</span>
      </div>

      <div className="w-full max-w-md" style={{ perspective: '800px' }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 80, rotateY: dir * 8 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            exit={{ opacity: 0, x: -dir * 80, rotateY: -dir * 8 }}
            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-forest to-indigo text-white shadow-xl shadow-forest/20"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon size={24} />
            </motion.div>
            <h2 className="bangla mb-2 text-center font-display text-2xl font-bold leading-snug md:text-3xl">{current.q}</h2>
            <p className="bangla mb-8 text-center text-sm text-ink/55">{current.sub}</p>

            <div className="space-y-3">
              {current.opts.map(opt => (
                <motion.button
                  key={opt.val}
                  onClick={() => pick(opt.val)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative w-full rounded-2xl border p-4 text-left shadow-sm transition-colors ${
                    selected === opt.val
                      ? 'border-forest bg-forest/8 shadow-md shadow-forest/12'
                      : 'border-white/60 bg-white/82 hover:border-forest/30 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      selected === opt.val ? 'border-forest bg-forest' : 'border-forest/25'
                    }`}>
                      <AnimatePresence>
                        {selected === opt.val && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                          >
                            <Check size={13} className="text-white" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div>
                      <div className="font-semibold text-ink">{opt.label}</div>
                      <div className="text-xs text-ink/50 mt-0.5">{opt.sub}</div>
                    </div>
                  </div>
                  {selected === opt.val && (
                    <motion.div
                      layoutId="option-highlight"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-r from-forest/6 to-indigo/4"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 flex w-full max-w-md items-center gap-3">
        <button onClick={back} className="flex items-center gap-1.5 px-3 py-2 text-sm text-ink/45 hover:text-ink">
          <ChevronLeft size={16} /> Back
        </button>
        <motion.button
          onClick={next}
          disabled={!selected}
          whileHover={selected ? { scale: 1.02 } : undefined}
          whileTap={selected ? { scale: 0.97 } : undefined}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-4 text-base font-semibold ${
            selected ? 'soft-button' : 'cursor-not-allowed bg-forest/8 text-ink/30'
          }`}
        >
          {step === steps.length - 1 ? 'Start learning' : 'Next'}
          <ChevronRight size={18} />
        </motion.button>
      </div>
    </div>
  )
}
