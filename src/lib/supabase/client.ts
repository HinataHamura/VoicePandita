import { createBrowserClient } from '@supabase/ssr'
import {
  DEMO_SUPABASE_ANON_KEY,
  DEMO_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_URL,
} from './env'

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

let browserClient: BrowserSupabaseClient | null = null

function browserIsOnline() {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine
}

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      NEXT_PUBLIC_SUPABASE_URL || DEMO_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY || DEMO_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: browserIsOnline(),
          detectSessionInUrl: true,
          persistSession: true,
        },
      }
    )
  }
  return browserClient
}

export function hasBrowserSupabaseConfig() {
  return Boolean(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function syncSupabaseAuthRefreshWithNetwork(online = browserIsOnline()) {
  const client = createClient()
  if (online) {
    client.auth.startAutoRefresh()
  } else {
    client.auth.stopAutoRefresh()
  }
}
