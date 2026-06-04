import { createBrowserClient } from '@supabase/ssr'
import { NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL } from './env'

const FALLBACK_SUPABASE_URL = 'https://example.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'demo-anon-key'

export function hasBrowserSupabaseConfig() {
  return Boolean(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function createClient() {
  return createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
  )
}
