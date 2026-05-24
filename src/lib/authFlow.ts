'use client'

import { createClient } from '@/lib/supabase/client'
import {
  DEMO_STUDENT,
  getCurrentStudent,
  getStudentProfile,
  isStudentProfileComplete,
  setCurrentStudent,
  type StudentIdentity,
} from '@/lib/studentStore'

const DEMO_COOKIE = 'vp_demo_session'

export function setDemoAuthCookie() {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=2592000; samesite=lax`
}

export function clearDemoAuthCookie() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function hasDemoAuthCookie() {
  return document.cookie.split(';').some(item => item.trim() === `${DEMO_COOKIE}=1`)
}

export async function getAuthenticatedStudent(): Promise<StudentIdentity | null> {
  try {
    const current = getCurrentStudent()
    if (current.isDemo || hasDemoAuthCookie()) {
      if (!current.isDemo) setCurrentStudent(DEMO_STUDENT)
      return current.isDemo ? current : DEMO_STUDENT
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null

    const student = {
      id: data.user.id,
      email: data.user.email || 'student@voicepandita.local',
      name: data.user.email?.split('@')[0] || 'Student',
    }
    setCurrentStudent(student)
    return student
  } catch {
    return null
  }
}

export function nextRouteForStudent(studentId?: string, fallback = '/onboarding') {
  const profile = getStudentProfile(studentId)
  return isStudentProfileComplete(profile) ? '/learn' : fallback
}
