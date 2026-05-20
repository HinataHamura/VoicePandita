'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        router.push('/onboarding')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/learn')
      }
    } catch (e: any) {
      setError(e.message || 'কিছু সমস্যা হয়েছে। আবার চেষ্টা করো।')
    } finally {
      setLoading(false)
    }
  }

  async function guestLogin() {
    setLoading(true)
    // Guest: just go to onboarding with no auth
    localStorage.setItem('vp_guest', 'true')
    router.push('/onboarding')
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
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-black/10 bg-cream/50 text-sm focus:outline-none focus:border-saffron/50 transition-colors" />
              </div>
            </div>

            <div>
              <label className="bangla text-sm font-medium text-ink/70 block mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 rounded-xl border border-black/10 bg-cream/50 text-sm focus:outline-none focus:border-saffron/50 transition-colors" />
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
              className="w-full bg-saffron text-white py-3 rounded-xl font-semibold text-sm hover:bg-saffron/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span className="bangla">{isSignup ? 'Account তৈরি করো' : 'Login করো'}</span>
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/8" />
            </div>
            <div className="relative flex justify-center text-xs text-ink/40 bg-white px-3">অথবা</div>
          </div>

          <button onClick={guestLogin}
            className="w-full border border-black/10 text-ink/70 py-3 rounded-xl text-sm font-medium hover:bg-paper transition-all bangla">
            Guest হিসেবে চালিয়ে যাও
          </button>
        </div>

        <button onClick={() => setIsSignup(v => !v)}
          className="bangla text-center w-full mt-4 text-sm text-ink/50 hover:text-ink transition-colors">
          {isSignup ? 'আগে থেকে account আছে? Login করো' : 'নতুন user? Account তৈরি করো'}
        </button>
      </motion.div>
    </div>
  )
}
