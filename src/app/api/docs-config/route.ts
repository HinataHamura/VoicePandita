import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { readDocsConfig, writeDocsConfig } from '@/lib/docs/store'
import { getRequiredEnv } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

async function isAdmin(req: NextRequest) {
  if (req.cookies.get('vp_demo_session')?.value === '1') return true
  if (process.env.DOCS_ADMIN_TOKEN && req.headers.get('x-docs-admin-token') === process.env.DOCS_ADMIN_TOKEN) return true

  try {
    const res = NextResponse.next()
    const supabase = createServerClient(
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']),
      getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY']),
      {
        cookies: {
          get(name: string) { return req.cookies.get(name)?.value },
          set(name: string, value: string, options: any) { res.cookies.set({ name, value, ...options }) },
          remove(name: string, options: any) { res.cookies.set({ name, value: '', ...options }) },
        },
      },
    )
    const { data } = await supabase.auth.getUser()
    return Boolean(data.user)
  } catch {
    return false
  }
}

export async function GET() {
  return NextResponse.json({ config: await readDocsConfig() })
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid config' }, { status: 400 })
  }

  const config = await writeDocsConfig(body.config ?? body, req.cookies.get('vp_demo_session')?.value === '1' ? 'demo-admin' : 'admin')
  return NextResponse.json({ config })
}
