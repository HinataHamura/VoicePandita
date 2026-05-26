'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useSessionSync(onLogout?: () => void) {
  useEffect(() => {
    const supabase = createClient()
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('vp_current_student')
        localStorage.removeItem('vp_concept_memory')
        onLogout?.()
      }
    })

    return () => data.subscription.unsubscribe()
  }, [onLogout])
}
