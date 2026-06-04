import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/env'

const protectedRoutes = ['/onboarding', '/student-path', '/learn', '/history', '/profile', '/progress', '/settings', '/chakma', '/pwn', '/docs/admin']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })
  const { pathname, search } = request.nextUrl
  const isProtectedRoute = protectedRoutes.some(route => pathname === route || pathname.startsWith(`${route}/`))
  const hasDemoSession = request.cookies.get('vp_demo_session')?.value === '1'
  const supabaseUrl = NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL
  const supabaseAnonKey = NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtectedRoute && !hasDemoSession) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('next', `${pathname}${search}`)
      return NextResponse.redirect(redirectUrl)
    }

    if (pathname === '/login' && hasDemoSession) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/learn'
      redirectUrl.search = ''
      return NextResponse.redirect(redirectUrl)
    }

    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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

  if (isProtectedRoute && !hasSupabaseSession && !hasDemoSession) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname === '/login' && (hasSupabaseSession || hasDemoSession)) {
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
