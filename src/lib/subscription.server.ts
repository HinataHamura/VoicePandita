import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { type NextRequest } from 'next/server'
import { getRequiredEnv } from './supabase/env'
import { FREE_DAILY_QUESTION_LIMIT, type SubscriptionPlan } from './subscription'

type SupabaseLike = ReturnType<typeof createSupabaseClient>

function normalizePlan(value: unknown): SubscriptionPlan {
  return String(value || '').toLowerCase() === 'pro' ? 'pro' : 'free'
}

function getSupabaseAdmin(): SupabaseLike | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function createRequestClient(request: NextRequest) {
  return createServerClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY']),
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set() {
          // Read-only request client.
        },
        remove() {
          // Read-only request client.
        },
      },
    }
  )
}

async function getAuthenticatedUserId(request: NextRequest) {
  try {
    const supabase = createRequestClient(request)
    const { data } = await supabase.auth.getUser()
    return data.user?.id || null
  } catch {
    return null
  }
}

function readCookie(request: NextRequest, name: string) {
  return request.cookies.get(name)?.value || null
}

function getStudentKey(request: NextRequest, authUserId: string | null) {
  return authUserId || readCookie(request, 'vp_student_id') || readCookie(request, 'vp_session_id') || 'guest'
}

async function getProfilePlan(authUserId: string | null) {
  if (!authUserId) return null
  const supabase = getSupabaseAdmin()
  if (!supabase) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', authUserId)
    .maybeSingle()

  if (error || !data) return null

  const plan = normalizePlan(data.plan)
  if (plan !== 'pro') return plan
  if (data.plan_expires_at && new Date(data.plan_expires_at).getTime() < Date.now()) return 'free'
  return plan
}

export async function getUserPlan(request: NextRequest): Promise<SubscriptionPlan> {
  const authUserId = await getAuthenticatedUserId(request)
  const profilePlan = await getProfilePlan(authUserId)
  if (profilePlan) return profilePlan
  return normalizePlan(readCookie(request, 'vp_plan'))
}

export async function isProUser(request: NextRequest) {
  return (await getUserPlan(request)) === 'pro'
}

export async function getSubscriptionContext(request: NextRequest) {
  const authUserId = await getAuthenticatedUserId(request)
  const plan = (await getProfilePlan(authUserId)) || normalizePlan(readCookie(request, 'vp_plan'))
  const userId = getStudentKey(request, authUserId)

  return {
    plan,
    userId,
    authUserId,
    isPro: plan === 'pro',
    dailyLimit: FREE_DAILY_QUESTION_LIMIT,
  }
}

export async function getDailyUsageCount(request: NextRequest, dateKey: string) {
  const supabase = getSupabaseAdmin()
  const { userId } = await getSubscriptionContext(request)
  if (!supabase || !userId) return 0

  const { data, error } = await supabase
    .from('daily_usage')
    .select('question_count')
    .eq('user_id', userId)
    .eq('date', dateKey)
    .maybeSingle()

  if (error || !data) return 0
  return Number(data.question_count || 0)
}

export async function incrementDailyUsage(request: NextRequest, dateKey: string, amount = 1) {
  const supabase = getSupabaseAdmin()
  const { userId } = await getSubscriptionContext(request)
  if (!supabase || !userId) return false

  const current = await getDailyUsageCount(request, dateKey)
  const nextCount = current + amount
  const { error } = await supabase.from('daily_usage').upsert(
    {
      user_id: userId,
      date: dateKey,
      question_count: nextCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date' }
  )
  return !error
}

