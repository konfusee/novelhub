import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import en from '../locales/en.json'
import vi from '../locales/vi.json'

const LocaleContext = createContext(null)
const dictionaries = { en, vi }
const supportedLocales = Object.keys(dictionaries)

function resolveMessage(dictionary, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], dictionary)
}

function interpolate(message, variables = {}) {
  return message.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? `{{${key}}}`))
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem('novelhub.locale')
    return supportedLocales.includes(saved) ? saved : 'en'
  })
  const setLocale = nextLocale => {
    if (supportedLocales.includes(nextLocale)) setLocaleState(nextLocale)
  }

  useEffect(() => {
    localStorage.setItem('novelhub.locale', locale)
    document.documentElement.lang = locale
  }, [locale])

  const value = useMemo(() => ({
    locale,
    setLocale,
    t: (key, variables) => {
      const message = resolveMessage(dictionaries[locale], key)
      if (typeof message !== 'string') {
        if (import.meta.env.DEV) console.warn(`[i18n] Missing ${locale} translation: ${key}`)
        return key
      }
      return interpolate(message, variables)
    },
    formatDate: valueToFormat => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium' }).format(new Date(valueToFormat)),
    formatNumber: valueToFormat => new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(valueToFormat),
  }), [locale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLocale = () => {
  const value = useContext(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside LocaleProvider')
  return value
}
