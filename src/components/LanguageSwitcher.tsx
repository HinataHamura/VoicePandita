'use client'

import { Languages } from 'lucide-react'
import { useLanguage } from '@/components/LanguageProvider'
import type { AppLanguage } from '@/lib/i18n'

const options: { value: AppLanguage; label: string }[] = [
  { value: 'bn', label: 'বাংলা' },
  { value: 'en', label: 'EN' },
]

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 p-1 text-xs font-semibold shadow-sm backdrop-blur-xl" aria-label={t('common.language')}>
      {!compact && <Languages size={14} className="ml-2 text-forest" />}
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLanguage(option.value)}
          className={`rounded-full px-3 py-1.5 transition ${
            language === option.value
              ? 'bg-gradient-to-r from-forest to-indigo text-white shadow-sm'
              : 'text-ink/55 hover:bg-white hover:text-forest'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
