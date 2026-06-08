import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getRequiredEnv, hasSupabaseConfig } from '@/lib/supabase/env'

const protectedRoutes = ['/onboarding', '/student-path', '/learn', '/history', '/profile', '/progress', '/settings', '/chakma', '/pwn', '/study-buddy', '/docs/admin']
const demoAdminRoutes = ['/docs/admin']

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
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/learn'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
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

  const { data } = await supabase.auth.getUser()
  const hasSupabaseSession = Boolean(data.user)

  if (isProtectedRoute && !hasSupabaseSession && !hasLocalSession) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname === '/login' && (hasSupabaseSession || hasLocalSession)) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/learn'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-|manifest|api/).*)',
  ],
}
