import { createContext } from 'react'

// Keep identity independent of dictionary/provider updates during development refresh.
export const localeContext = createContext(null)
