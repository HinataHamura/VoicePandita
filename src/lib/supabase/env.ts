export const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
export const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
export const SUPABASE_URL = process.env.SUPABASE_URL
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const DEMO_SUPABASE_URL = 'http://127.0.0.1:54321'
export const DEMO_SUPABASE_ANON_KEY = 'demo-anon-key'

function resolveEnv(key: string): string | undefined {
  switch (key) {
    case 'NEXT_PUBLIC_SUPABASE_URL':
      return NEXT_PUBLIC_SUPABASE_URL
    case 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
      return NEXT_PUBLIC_SUPABASE_ANON_KEY
    case 'SUPABASE_URL':
      return SUPABASE_URL
    case 'SUPABASE_ANON_KEY':
      return SUPABASE_ANON_KEY
    case 'SUPABASE_SERVICE_ROLE_KEY':
      return SUPABASE_SERVICE_ROLE_KEY
    default:
      return undefined
  }
}

export function getRequiredEnv(key: string, fallbackKeys: string[] = []) {
  const fallbackValue = fallbackKeys.map(k => resolveEnv(k)).find(Boolean)
  const value = resolveEnv(key) ?? fallbackValue

  if (!value) {
    const candidates = [key, ...fallbackKeys].join(' or ')
    throw new Error(
      `Missing environment variable: ${candidates}. Add it to .env.local or your deployment environment and restart the server.`
    )
  }

  return value
}

export function hasSupabaseConfig() {
  return Boolean(
    (NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL) &&
      (NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY)
  )
}
