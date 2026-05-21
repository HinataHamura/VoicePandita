'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DEMO_EMAIL, DEMO_PASSWORD, setCurrentStudent, startDemoStudent, startGuestStudent } from '@/lib/studentStore'

const AFTER_LOGIN_PATH = '/profile'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [isSignup, setIsSignup] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (!isSignup && email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        startDemoStudent()
        router.push(AFTER_LOGIN_PATH)
        return
      }

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.user) {
          setCurrentStudent({
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.email?.split('@')[0] || 'Student',
          })
        }
        router.push(AFTER_LOGIN_PATH)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.user) {
          setCurrentStudent({
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.email?.split('@')[0] || 'Student',
          })
        }
        router.push(AFTER_LOGIN_PATH)
      }
    } catch (e: any) {
      setError(e.message || 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করো।')
    } finally {
      setLoading(false)
    }
  }

  async function guestLogin() {
    setLoading(true)
    localStorage.setItem('vp_guest', 'true')
    startGuestStudent()
    router.push(AFTER_LOGIN_PATH)
  }

  function fillDemoLogin() {
    setIsSignup(false)
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  return (
    <div className="min-h-dvh bg-cream flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-2xl font-bold">
            Voice<span className="text-saffron">Pandita</span>
          </Link>
          <p className="bangla text-ink/50 mt-2 text-sm">
            {isSignup ? 'নতুন account তৈরি করো' : 'আবার স্বাগতম!'}
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="bangla text-sm font-medium text-ink/70 block mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="তোমার email"
                  className="w-full rounded-lg border border-forest/10 bg-white/78 py-3 pl-9 pr-4 text-sm shadow-sm focus:border-saffron/50 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="bangla text-sm font-medium text-ink/70 block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-forest/10 bg-white/78 py-3 pl-9 pr-10 text-sm shadow-sm focus:border-saffron/50 focus:outline-none" />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60 transition-colors">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="bangla text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-saffron py-3 text-sm font-semibold text-white shadow-lg shadow-saffron/18 hover:bg-saffron/90 disabled:opacity-60">
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span className="bangla">{isSignup ? 'Account তৈরি করো' : 'Login করো'}</span>
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/8" />
            </div>
            <div className="relative flex justify-center bg-white/0 px-3 text-xs text-ink/40">অথবা</div>
          </div>

          <button onClick={guestLogin}
            className="bangla w-full rounded-lg border border-forest/10 bg-white/70 py-3 text-sm font-medium text-ink/70 shadow-sm hover:bg-paper/80">
            Guest হিসেবে চালিয়ে যাও
          </button>

          <button onClick={fillDemoLogin}
            className="mt-3 w-full rounded-lg border border-saffron/30 bg-saffron/5 py-3 text-sm font-semibold text-saffron shadow-sm hover:bg-saffron/10">
            Use judge demo account
          </button>

          <div className="mt-3 rounded-lg border border-forest/8 bg-paper/72 px-3 py-2 text-xs text-ink/55">
            Demo: <span className="font-mono">{DEMO_EMAIL}</span> / <span className="font-mono">{DEMO_PASSWORD}</span>
          </div>
        </div>

        <button onClick={() => setIsSignup(v => !v)}
          className="bangla text-center w-full mt-4 text-sm text-ink/50 hover:text-ink transition-colors">
          {isSignup ? 'আগে থেকে account আছে? Login করো' : 'নতুন user? Account তৈরি করো'}
        </button>
      </motion.div>
    </div>
  )
}
