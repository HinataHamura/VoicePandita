import { createBrowserClient } from '@supabase/ssr'
import {
  DEMO_SUPABASE_ANON_KEY,
  DEMO_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
} from './env'

export function createClient() {
  return createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL || DEMO_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY || DEMO_SUPABASE_ANON_KEY
  )
}

export function hasBrowserSupabaseConfig() {
  return Boolean(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
