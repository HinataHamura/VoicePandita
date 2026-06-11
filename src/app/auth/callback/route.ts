import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getRequiredEnv } from '@/lib/supabase/env'
import { normalizeLanguage } from '@/lib/i18n'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/learn'
  const preferredLanguage = normalizeLanguage(requestUrl.searchParams.get('lang'))
  let response = NextResponse.redirect(new URL(next.startsWith('/') ? next : '/learn', request.url))

  if (!code) return response

  const supabase = createServerClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY']),
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error && data.user) {
    const profile = {
      id: data.user.id,
      email: data.user.email,
      full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Student',
      avatar_url: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null,
      preferred_language: preferredLanguage,
      updated_at: new Date().toISOString(),
    }

    try {
      await supabase.from('profiles').upsert(profile, { onConflict: 'id' })
    } catch {
      // Profiles table is optional for demo deployments.
    }
  }

  return response
}
