import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { en } from './en'
import { ar } from './ar'

export type Locale = 'ar' | 'en'

const dictionaries = { ar, en }

interface LanguageState {
  locale: Locale
  dir: 'rtl' | 'ltr'
  t: typeof en
  toggle: () => void
  setLocale: (l: Locale) => void
}

const LanguageContext = createContext<LanguageState | undefined>(undefined)

const STORAGE_KEY = 'rime_locale'

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Locale) || 'ar'
    } catch {
      return 'ar'
    }
  })

  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = locale
  }, [dir, locale])

  function setLocale(l: Locale) {
    setLocaleState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      /* ignore */
    }
  }

  function toggle() {
    setLocale(locale === 'ar' ? 'en' : 'ar')
  }

  return (
    <LanguageContext.Provider value={{ locale, dir, t: dictionaries[locale], toggle, setLocale }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
