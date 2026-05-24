'use client'

import { createClient } from '@/lib/supabase/client'
import {
  getCurrentStudent,
  getStudentProfile,
  isStudentProfileComplete,
  setCurrentStudent,
  type StudentIdentity,
} from '@/lib/studentStore'

const DEMO_COOKIE_NAME = 'vp_demo_session'
const DEMO_COOKIE_VALUE = '1'
const DEMO_COOKIE_OPTIONS = 'path=/;max-age=31536000;samesite=lax'

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function getCookie(name: string) {
  if (!isBrowser()) return null
  return document.cookie
    .split('; ')
    .find(cookie => cookie.startsWith(`${name}=`))
    ?.split('=')[1] || null
}

function setCookie(name: string, value: string) {
  if (!isBrowser()) return
  document.cookie = `${name}=${value}; ${DEMO_COOKIE_OPTIONS}`
}

function clearCookie(name: string) {
  if (!isBrowser()) return
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`
}

export function setDemoAuthCookie() {
  setCookie(DEMO_COOKIE_NAME, DEMO_COOKIE_VALUE)
}

export function clearDemoAuthCookie() {
  clearCookie(DEMO_COOKIE_NAME)
}

export async function getAuthenticatedStudent(): Promise<StudentIdentity | null> {
  if (!isBrowser()) return null

  if (getCookie(DEMO_COOKIE_NAME) === DEMO_COOKIE_VALUE) {
    return getCurrentStudent()
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null

  const currentStudent = getCurrentStudent()
  const user = data.user
  const student: StudentIdentity = {
    id: user.id,
    email: user.email || currentStudent.email || 'student@voicepandita.app',
    name:
      (user.user_metadata as any)?.full_name ||
      user.email?.split('@')[0] ||
      currentStudent.name ||
      'Student',
  }

  if (currentStudent.id.startsWith('guest-') || currentStudent.isGuest) {
    setCurrentStudent(student)
  }

  return student
}

export function nextRouteForStudent(studentId: string, fallback = '/learn') {
  const profile = getStudentProfile(studentId)
  if (!isStudentProfileComplete(profile)) {
    return '/onboarding'
  }
  return fallback
}
