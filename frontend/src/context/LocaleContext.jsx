import { useContext, useMemo } from 'react'
import vi from '../locales/vi.json'
import { localeContext } from './localeContextValue'

function resolveMessage(dictionary, key) {
  return key.split('.').reduce((value, segment) => value?.[segment], dictionary)
}

function interpolate(message, variables = {}) {
  return message.replace(/\{\{(\w+)\}\}/g, (_, key) => String(variables[key] ?? `{{${key}}}`))
}

export function LocaleProvider({ children }) {
  const dictionary = vi
  const value = useMemo(
    () => ({
      locale: 'vi',
      t: (key, variables) => {
        const message = resolveMessage(dictionary, key)
        if (typeof message !== 'string') {
          if (import.meta.env.DEV) console.warn(`[content] Thiếu nội dung tiếng Việt: ${key}`)
          return key
        }
        return interpolate(message, variables)
      },
      formatDate: valueToFormat =>
        new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' }).format(new Date(valueToFormat)),
      formatNumber: valueToFormat => new Intl.NumberFormat('vi-VN').format(valueToFormat),
      // Instants shown with their time in Vietnam time (UTC+7), e.g. claim expiry or history.
      formatDateTime: valueToFormat =>
        new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Ho_Chi_Minh',
        }).format(new Date(valueToFormat)),
    }),
    [dictionary],
  )

  return <localeContext.Provider value={value}>{children}</localeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useLocale = () => {
  const value = useContext(localeContext)
  if (!value) throw new Error('useLocale must be used inside LocaleProvider')
  return value
}
