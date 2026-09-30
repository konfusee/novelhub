import { createContext, useContext, useEffect, useMemo, useState } from 'react'
const ThemeContext = createContext(null)
const STORAGE_KEY = 'novelhub.theme'
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const previewTheme = new URLSearchParams(window.location.search).get('theme')
    return ['light', 'dark', 'system'].includes(previewTheme)
      ? previewTheme
      : localStorage.getItem(STORAGE_KEY) || 'system'
  })
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    localStorage.setItem(STORAGE_KEY, theme)
    return () => media.removeEventListener('change', apply)
  }, [theme])
  const resolvedTheme =
    theme === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  const value = useMemo(() => ({ theme, setTheme, resolvedTheme }), [theme, resolvedTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
