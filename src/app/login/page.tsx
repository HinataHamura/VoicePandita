'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/components/LanguageProvider'
import { clearLocalAuthCookies, setDemoAuthCookie, setGuestAuthCookie } from '@/lib/authFlow'
import { createClient, hasBrowserSupabaseConfig } from '@/lib/supabase/client'
import { DEMO_EMAIL, DEMO_PASSWORD, setCurrentStudent, startDemoStudent, startGuestStudent } from '@/lib/studentStore'

const AFTER_LOGIN_PATH = '/profile'

export default function LoginPage() {
  const router = useRouter()
  const { language, t } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignup, setIsSignup] = useState(false)

  function getNextPath() {
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')
    if (!next || !next.startsWith('/') || next.startsWith('//')) return AFTER_LOGIN_PATH
    return next
  }

  function finishLogin() {
    window.dispatchEvent(new Event('vp-auth-change'))
    router.replace(getNextPath())
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const normalizedEmail = email.trim().toLowerCase()

      if (!isSignup && normalizedEmail === DEMO_EMAIL && password === DEMO_PASSWORD) {
        clearLocalAuthCookies()
        startDemoStudent()
        setDemoAuthCookie()
        finishLogin()
        return
      }

      if (!hasBrowserSupabaseConfig()) {
        throw new Error(t('auth.missingSupabase'))
      }

      const supabase = createClient()
      clearLocalAuthCookies()
      localStorage.removeItem('vp_guest')

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password })
        if (error) throw error
        if (data.user) {
          setCurrentStudent({
            id: data.user.id,
            email: data.user.email || normalizedEmail,
            name: data.user.email?.split('@')[0] || 'Student',
          })
        }
        finishLogin()
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        if (error) throw error
        if (data.user) {
          setCurrentStudent({
            id: data.user.id,
            email: data.user.email || normalizedEmail,
            name: data.user.email?.split('@')[0] || 'Student',
          })
        }
        finishLogin()
      }
    } catch (e: any) {
      setError(e.message || t('auth.genericError'))
    } finally {
      setLoading(false)
    }
  }

  async function guestLogin() {
    setLoading(true)
    setError('')
    clearLocalAuthCookies()
    localStorage.setItem('vp_guest', 'true')
    startGuestStudent()
    setGuestAuthCookie()
    finishLogin()
  }

  function demoLogin() {
    setIsSignup(false)
    setError('')
    clearLocalAuthCookies()
    startDemoStudent()
    setDemoAuthCookie()
    finishLogin()
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      if (!hasBrowserSupabaseConfig()) {
        throw new Error(t('auth.missingSupabase'))
      }
      clearLocalAuthCookies()
      localStorage.removeItem('vp_guest')
      localStorage.removeItem('vp_current_student')
      const next = getNextPath()
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&lang=${language}`
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })
      if (error) throw error
    } catch (e: any) {
      setError(e.message || t('auth.genericError'))
      setLoading(false)
    }
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
          <div className="mb-4 flex justify-center">
            <LanguageSwitcher compact />
          </div>
          <Link href="/" className="font-display text-2xl font-bold">
            Voice<span className="text-saffron">Pandita</span>
          </Link>
          <p className="bangla text-ink/50 mt-2 text-sm">
            {isSignup ? t('auth.signupTitle') : t('auth.welcome')}
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="bangla text-sm font-medium text-ink/70 block mb-1.5">{t('auth.email')}</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder={t('auth.emailPlaceholder')}
                  className="w-full rounded-lg border border-forest/10 bg-white/78 py-3 pl-9 pr-4 text-sm shadow-sm focus:border-saffron/50 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="bangla text-sm font-medium text-ink/70 block mb-1.5">{t('auth.password')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-forest/10 bg-white/78 py-3 pl-9 pr-10 text-sm shadow-sm focus:border-saffron/50 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(value => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/30 hover:text-ink/60 transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="bangla text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-saffron py-3 text-sm font-semibold text-white shadow-lg shadow-saffron/18 hover:bg-saffron/90 disabled:opacity-60"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              <span className="bangla">{isSignup ? t('auth.signup') : t('auth.login')}</span>
            </button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-black/8" />
            </div>
            <div className="relative flex justify-center bg-white/0 px-3 text-xs text-ink/40">{t('auth.or')}</div>
          </div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-forest/10 bg-white/90 py-3 text-sm font-semibold text-ink/75 shadow-sm hover:bg-white disabled:opacity-60"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? t('auth.googleLoading') : t('auth.google')}
          </button>

          <button
            onClick={guestLogin}
            disabled={loading}
            className="bangla w-full rounded-lg border border-forest/10 bg-white/70 py-3 text-sm font-medium text-ink/70 shadow-sm hover:bg-paper/80 disabled:opacity-60"
          >
            {t('auth.guest')}
          </button>

          <button
            onClick={demoLogin}
            disabled={loading}
            className="mt-3 w-full rounded-lg border border-saffron/30 bg-saffron/5 py-3 text-sm font-semibold text-saffron shadow-sm hover:bg-saffron/10 disabled:opacity-60"
          >
            {t('auth.demo')}
          </button>

          <div className="mt-3 rounded-lg border border-forest/8 bg-paper/72 px-3 py-2 text-xs text-ink/55">
            Demo: <span className="font-mono">{DEMO_EMAIL}</span> / <span className="font-mono">{DEMO_PASSWORD}</span>
          </div>
        </div>

        <button
          onClick={() => setIsSignup(value => !value)}
          className="bangla text-center w-full mt-4 text-sm text-ink/50 hover:text-ink transition-colors"
        >
          {isSignup ? t('auth.existingUser') : t('auth.newUser')}
        </button>
      </motion.div>
    </div>
  )
}
