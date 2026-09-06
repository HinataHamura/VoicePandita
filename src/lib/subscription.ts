import { DEFAULT_GEMINI_MODEL, DEFAULT_GROQ_MODEL } from '@/lib/ai/models'

export type SubscriptionPlan = 'free' | 'pro'

export type AIProviderConfig = {
  plan: SubscriptionPlan
  provider: string
  model: string
  label: string
  priority: boolean
}

export const FREE_DAILY_QUESTION_LIMIT = 30
export const SUBSCRIPTION_CHANGE_EVENT = 'vp-subscription-change'

const PLAN_COOKIE = 'vp_plan'
const PLAN_STORAGE_KEY = 'vp_plan'
const STUDENT_STORAGE_KEY = 'vp_current_student'
const STUDENT_ID_COOKIE = 'vp_student_id'

function isBrowser() {
  return typeof window !== 'undefined'
}

function normalizePlan(value: unknown): SubscriptionPlan {
  return String(value || '').toLowerCase() === 'pro' ? 'pro' : 'free'
}

function getCookie(name: string) {
  if (!isBrowser()) return null
  const match = document.cookie.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.slice(name.length + 1))
}

function setCookie(name: string, value: string, maxAgeSeconds = 60 * 60 * 24 * 365) {
  if (!isBrowser()) return
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; samesite=lax`
}

function readCurrentStudentId() {
  if (!isBrowser()) return null
  try {
    const raw = localStorage.getItem(STUDENT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.id) return String(parsed.id)
    }
  } catch {
    // Ignore malformed local demo state.
  }
  return getCookie(STUDENT_ID_COOKIE)
}

function storageKey(studentId?: string | null) {
  return studentId ? `${PLAN_STORAGE_KEY}:${studentId}` : PLAN_STORAGE_KEY
}

export function getUserPlan(studentId?: string | null): SubscriptionPlan {
  if (!isBrowser()) return 'free'
  const resolvedStudentId = studentId || readCurrentStudentId()
  const studentPlan = resolvedStudentId ? localStorage.getItem(storageKey(resolvedStudentId)) : null
  const globalPlan = localStorage.getItem(PLAN_STORAGE_KEY) || getCookie(PLAN_COOKIE)
  return normalizePlan(studentPlan || globalPlan)
}

export function isProUser(studentId?: string | null) {
  return getUserPlan(studentId) === 'pro'
}

export function setUserPlan(plan: SubscriptionPlan, studentId?: string | null) {
  if (!isBrowser()) return
  const normalized = normalizePlan(plan)
  const resolvedStudentId = studentId || readCurrentStudentId()
  localStorage.setItem(PLAN_STORAGE_KEY, normalized)
  setCookie(PLAN_COOKIE, normalized)
  if (resolvedStudentId) {
    localStorage.setItem(storageKey(resolvedStudentId), normalized)
    setCookie(STUDENT_ID_COOKIE, resolvedStudentId)
  }
  window.dispatchEvent(new Event(SUBSCRIPTION_CHANGE_EVENT))
}

export function getPlanBadgeLabel(plan: SubscriptionPlan = 'free') {
  return plan === 'pro' ? '⭐ Pro Student' : '🆓 Free Plan'
}

export function getAIProvider(plan: SubscriptionPlan = 'free'): AIProviderConfig {
  if (plan === 'pro') {
    const provider = (process.env.PRO_AI_PROVIDER || 'premium-provider-placeholder').trim()
    const model =
      provider === 'groq'
        ? (process.env.PRO_AI_MODEL || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL).trim()
        : provider === 'gemini'
          ? (process.env.PRO_AI_MODEL || process.env.PRO_AI_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-pro').trim()
          : (process.env.PRO_AI_MODEL || 'premium-model-placeholder').trim()

    return {
      plan,
      provider,
      model,
      label: process.env.PRO_AI_LABEL?.trim() || 'Premium AI provider',
      priority: true,
    }
  }

  return {
    plan,
    provider: 'gemini',
    model: (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim(),
    label: 'Gemini Flash',
    priority: false,
  }
}

export function getUsageDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}
