import bn from '../../messages/bn.json'
import en from '../../messages/en.json'

export type AppLanguage = 'bn' | 'en'

export const DEFAULT_LANGUAGE: AppLanguage = 'bn'
export const LANGUAGE_STORAGE_KEY = 'vp_language'

const dictionaries = { bn, en }

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === 'en' ? 'en' : 'bn'
}

export function getMessage(language: AppLanguage, key: string) {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part]
    }
    return undefined
  }, dictionaries[language])

  if (typeof value === 'string') return value
  if (language !== DEFAULT_LANGUAGE) return getMessage(DEFAULT_LANGUAGE, key)
  return key
}
