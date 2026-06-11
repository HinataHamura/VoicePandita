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
const GUEST_COOKIE = 'vp_guest_session'

export function setDemoAuthCookie() {
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=2592000; samesite=lax`
}

export function clearDemoAuthCookie() {
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function setGuestAuthCookie() {
  document.cookie = `${GUEST_COOKIE}=1; path=/; max-age=2592000; samesite=lax`
}

export function clearGuestAuthCookie() {
  document.cookie = `${GUEST_COOKIE}=; path=/; max-age=0; samesite=lax`
}

export function hasDemoAuthCookie() {
  return document.cookie.split(';').some(item => item.trim() === `${DEMO_COOKIE}=1`)
}

export function hasGuestAuthCookie() {
  return document.cookie.split(';').some(item => item.trim() === `${GUEST_COOKIE}=1`)
}

export async function getAuthenticatedStudent(): Promise<StudentIdentity | null> {
  try {
    const current = getCurrentStudent()
    if (current.isGuest) return current
    if (current.isDemo || hasDemoAuthCookie()) {
      if (!current.isDemo) setCurrentStudent(DEMO_STUDENT)
      return current.isDemo ? current : DEMO_STUDENT
    }

    if (current.isGuest || hasGuestAuthCookie()) {
      return current
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null

    const student = {
      id: data.user.id,
      email: data.user.email || 'student@voicepandita.local',
      name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'Student',
      avatarUrl: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture,
    }
    setCurrentStudent(student)
    return student
  } catch {
    return null
  }
}

export async function getVisibleStudent(): Promise<StudentIdentity | null> {
  try {
    if (typeof window === 'undefined') return null

    const saved = localStorage.getItem('vp_current_student')
    if (saved) {
      try {
        return JSON.parse(saved) as StudentIdentity
      } catch {
        localStorage.removeItem('vp_current_student')
      }
    }

    if (hasDemoAuthCookie()) {
      setCurrentStudent(DEMO_STUDENT)
      return DEMO_STUDENT
    }

    if (hasGuestAuthCookie()) {
      const sessionId = localStorage.getItem('vp_session_id') || crypto.randomUUID()
      const guest = { id: `guest-${sessionId}`, email: 'guest@voicepandita.local', name: 'Guest Student', isGuest: true }
      setCurrentStudent(guest)
      return guest
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
