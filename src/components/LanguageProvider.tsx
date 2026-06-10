'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, getMessage, normalizeLanguage, type AppLanguage } from '@/lib/i18n'
import { createClient } from '@/lib/supabase/client'

type LanguageContextValue = {
  language: AppLanguage
  setLanguage: (language: AppLanguage) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(DEFAULT_LANGUAGE)

  useEffect(() => {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    setLanguageState(normalizeLanguage(saved))
  }, [])

  function setLanguage(nextLanguage: AppLanguage) {
    const normalized = normalizeLanguage(nextLanguage)
    setLanguageState(normalized)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized)
    document.cookie = `${LANGUAGE_STORAGE_KEY}=${normalized}; path=/; max-age=31536000; samesite=lax`

    const supabase = createClient()
    supabase.auth.getUser().then((result: { data: { user: { id: string; email?: string | null } | null } }) => {
      const { data } = result
      if (!data.user) return
      return supabase
        .from('profiles')
        .upsert({ id: data.user.id, email: data.user.email, preferred_language: normalized, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .then(() => undefined)
    }).catch(() => undefined)
  }

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: string) => getMessage(language, key),
    }),
    [language]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => undefined,
      t: (key: string) => getMessage(DEFAULT_LANGUAGE, key),
    }
  }
  return context
}
