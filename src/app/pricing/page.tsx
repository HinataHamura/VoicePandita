'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, BarChart3, Check, Infinity, LayoutGrid, Sparkles, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getPlanBadgeLabel, getUserPlan, setUserPlan, SUBSCRIPTION_CHANGE_EVENT, type SubscriptionPlan } from '@/lib/subscription'

const FEATURES = [
  ['AI model', 'Gemini Flash', 'Premium provider placeholder'],
  ['Questions/day', '30', 'Unlimited'],
  ['Visual mode', 'Basic visual mode', 'Advanced visual mode'],
  ['History', 'Limited history', 'Full history'],
  ['Learning analytics', 'Not included', 'Included'],
  ['Priority responses', 'Standard', 'Priority'],
]

const freeHighlights = [
  'Bangla-first tutoring',
  'Curriculum grounded answers',
  'Basic visual explanations',
]

const proHighlights = [
  'Unlimited daily questions',
  'Advanced diagrams and visual mode',
  'Full history and analytics',
]

export default function PricingPage() {
  const [plan, setPlan] = useState<SubscriptionPlan>('free')
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    const syncPlan = () => setPlan(getUserPlan())
    syncPlan()
    window.addEventListener(SUBSCRIPTION_CHANGE_EVENT, syncPlan)
    return () => window.removeEventListener(SUBSCRIPTION_CHANGE_EVENT, syncPlan)
  }, [])

  const currentLabel = useMemo(() => getPlanBadgeLabel(plan), [plan])

  async function upgradeDemo() {
    setUpgrading(true)
    try {
      setUserPlan('pro')
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Student',
            avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null,
            plan: 'pro',
            plan_expires_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
      }
      setPlan('pro')
    } finally {
      setUpgrading(false)
    }
  }

  async function switchDemoPlan(nextPlan: SubscriptionPlan) {
    setUpgrading(true)
    try {
      setUserPlan(nextPlan)
      const supabase = createClient()
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            email: data.user.email,
            plan: nextPlan,
            plan_expires_at: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
      }
      setPlan(nextPlan)
    } finally {
      setUpgrading(false)
    }
  }

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-20 border-x-0 border-t-0 px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/learn" className="soft-button flex h-10 w-10 items-center justify-center" aria-label="Back to learn">
              <ArrowLeft size={16} />
            </Link>
            <div>
              <div className="font-display text-lg font-bold">Pricing</div>
              <div className="text-xs text-ink/50">Plan controls for demo and judge review</div>
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${plan === 'pro' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-indigo/15 bg-indigo/8 text-indigo'}`}>
            {currentLabel}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[1.4rem] border border-white/70 bg-gradient-to-br from-forest/12 via-white to-indigo/10 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        >
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo/15 bg-white/80 px-3 py-1.5 text-xs font-semibold text-indigo">
              <Sparkles size={12} /> Modern learning plans
            </div>
            <h1 className="font-display text-3xl font-bold text-ink md:text-4xl">Choose a plan that feels fast, calm, and judge-ready.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/60">
              Free gives students a solid tutor with a daily cap. Pro unlocks unlimited questions, richer visuals, better history, and analytics for serious review.
            </p>
          </div>
        </motion.section>

        <section className="grid gap-4 lg:grid-cols-2">
          <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.4rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-forest/5 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/45">Free</div>
                <h2 className="mt-1 font-display text-2xl font-bold">Free Plan</h2>
                <p className="mt-2 text-sm text-ink/55">Enough for everyday revision and concept clarity.</p>
              </div>
              <div className="rounded-2xl bg-forest/10 p-3 text-forest">
                <LayoutGrid size={20} />
              </div>
            </div>
            <div className="mt-5 text-3xl font-bold text-ink">Tk 0</div>
            <div className="mt-4 space-y-2">
              {freeHighlights.map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-ink/70">
                  <Check size={14} className="text-forest" />
                  {item}
                </div>
              ))}
            </div>
          </motion.article>

          <motion.article initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-[1.4rem] border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-indigo/8 p-6 shadow-lg shadow-amber-100/50 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Pro</div>
                <h2 className="mt-1 font-display text-2xl font-bold text-ink">Pro Student</h2>
                <p className="mt-2 text-sm text-ink/55">Built for long study sessions, mock practice, and deeper review.</p>
              </div>
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Zap size={20} />
              </div>
            </div>
            <div className="mt-5 flex items-end gap-2">
              <div className="text-3xl font-bold text-ink">Tk 0</div>
              <div className="pb-1 text-xs text-ink/45">demo unlock</div>
            </div>
            <div className="mt-4 space-y-2">
              {proHighlights.map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-ink/70">
                  <Check size={14} className="text-amber-700" />
                  {item}
                </div>
              ))}
            </div>
            <button
              onClick={upgradeDemo}
              disabled={upgrading || plan === 'pro'}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-forest to-indigo px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-forest/20 disabled:opacity-60"
            >
              {upgrading ? <span className="animate-pulse">Upgrading...</span> : <><Sparkles size={14} /> Upgrade demo to Pro</>}
            </button>
            {plan === 'pro' && (
              <button
                onClick={() => switchDemoPlan('free')}
                disabled={upgrading}
                className="ml-3 mt-6 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/75 px-5 py-3 text-sm font-semibold text-ink/60 shadow-sm hover:bg-white"
              >
                Reset to Free
              </button>
            )}
          </motion.article>
        </section>

        <section className="rounded-[1.4rem] border border-white/70 bg-white/80 p-6 shadow-lg shadow-forest/5 backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
            <BarChart3 size={16} className="text-forest" />
            Feature comparison
          </div>
          <div className="overflow-x-auto rounded-2xl border border-white/70">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-ink/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">
                <div>Feature</div>
                <div>Free</div>
                <div>Pro</div>
              </div>
              {FEATURES.map(([feature, freeValue, proValue], index) => (
                <div key={feature} className={`grid grid-cols-[1.2fr_1fr_1fr] px-4 py-3 text-sm ${index % 2 === 0 ? 'bg-white' : 'bg-cream/40'}`}>
                  <div className="font-medium text-ink">{feature}</div>
                  <div className="text-ink/65">{freeValue}</div>
                  <div className="text-ink/65">{proValue}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Sparkles, title: 'Soft academic colors', text: 'Clean contrast with a modern classroom feel.' },
            { icon: Infinity, title: 'Unlimited practice', text: 'Pro removes the daily question cap entirely.' },
            { icon: Zap, title: 'Priority answers', text: 'Pro responses can be routed to a premium provider.' },
          ].map(item => (
            <div key={item.title} className="rounded-[1.2rem] border border-white/70 bg-white/75 p-5 shadow-sm shadow-forest/5">
              <item.icon size={18} className="text-forest" />
              <div className="mt-3 font-semibold text-ink">{item.title}</div>
              <p className="mt-1 text-sm leading-relaxed text-ink/55">{item.text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}
