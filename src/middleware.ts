import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getRequiredEnv, hasSupabaseConfig } from '@/lib/supabase/env'

const protectedRoutes = ['/onboarding', '/student-path', '/history', '/profile', '/progress', '/settings', '/chakma', '/pwn', '/study-buddy', '/voice-practice', '/answer-checker', '/docs/admin']
const demoAdminRoutes = ['/docs/admin']

function safeRedirectUrl(request: NextRequest, fallback = '/learn') {
  const redirectUrl = request.nextUrl.clone()
  const next = request.nextUrl.searchParams.get('next')
  const target = !next || !next.startsWith('/') || next.startsWith('//') ? fallback : next
  const parsedTarget = new URL(target, request.url)
  redirectUrl.pathname = parsedTarget.pathname
  redirectUrl.search = parsedTarget.search
  return redirectUrl
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const { pathname, search } = request.nextUrl
  const isProtectedRoute = protectedRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
  const isDemoAdminRoute = demoAdminRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
  const hasDemoSession = request.cookies.get('vp_demo_session')?.value === '1'
  const hasGuestSession = request.cookies.get('vp_guest_session')?.value === '1'
  const hasLocalSession = hasDemoSession || (hasGuestSession && !isDemoAdminRoute)

  if (!hasSupabaseConfig()) {
    if (isProtectedRoute && !hasLocalSession) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('next', `${pathname}${search}`)
      return NextResponse.redirect(redirectUrl)
    }

    if (pathname === '/login' && hasLocalSession) {
      return NextResponse.redirect(safeRedirectUrl(request))
    }

    return response
  }

  const supabase = createServerClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', ['SUPABASE_URL']),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY']),
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: any) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  let hasSupabaseSession = false
  try {
    const { data } = await supabase.auth.getUser()
    hasSupabaseSession = Boolean(data.user)
  } catch {
    // Unreachable Supabase on slow/offline networks — continue as logged out.
  }

  if (isProtectedRoute && !hasSupabaseSession && !hasLocalSession) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname === '/login' && (hasSupabaseSession || hasLocalSession)) {
    return NextResponse.redirect(safeRedirectUrl(request))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-|manifest|api/).*)',
  ],
}
