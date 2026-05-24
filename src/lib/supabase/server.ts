import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getRequiredEnv } from './env'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY']),
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }) },
        remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }) },
      },
    }
  )
}
