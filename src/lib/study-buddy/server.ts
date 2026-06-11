import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export function isStudyBuddyEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_STUDY_BUDDY !== 'false'
}

export function getStudyBuddyConfig() {
  return {
    minMembers: Number(process.env.STUDY_BUDDY_MIN_MEMBERS || 3),
    maxMembers: Number(process.env.STUDY_BUDDY_MAX_MEMBERS || 5),
    waitTimeoutSeconds: Number(process.env.STUDY_BUDDY_WAIT_TIMEOUT_SECONDS || 90),
    durationMinutes: Number(process.env.STUDY_BUDDY_ROOM_DURATION_MINUTES || 10),
  }
}

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
}

export function getOrCreateAnonymousSessionId(input?: string) {
  if (input && /^[0-9a-f-]{36}$/i.test(input)) return input
  const cookieStore = cookies()
  const existing = cookieStore.get('vp_study_session_id')?.value
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing
  const next = crypto.randomUUID()
  cookieStore.set('vp_study_session_id', next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
    sameSite: 'lax',
    httpOnly: true,
  })
  return next
}

export async function logStudyBuddyEvent(eventName: string, metadata: Record<string, unknown>) {
  console.info(`[study_buddy] ${eventName}`, metadata)
}
