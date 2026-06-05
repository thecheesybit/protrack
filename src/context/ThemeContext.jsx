import { createContext, useCallback, useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'

export const ThemeContext = createContext(null)

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const saved = localStorage.getItem(STORAGE_KEYS.theme)
  if (saved === 'light' || saved === 'dark') return saved
  // Default to dark (the app's signature look), but respect explicit OS light.
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches
  return prefersLight ? 'light' : 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEYS.theme, theme)
  }, [theme])

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  )

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
