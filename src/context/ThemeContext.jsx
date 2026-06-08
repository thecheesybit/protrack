import { createContext, useCallback, useEffect, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'

export const ThemeContext = createContext(null)

function getInitialTheme() {
  if (typeof window === 'undefined') return 'auto'
  const saved = localStorage.getItem(STORAGE_KEYS.theme)
  if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved
  // New default: follow the local clock (light by day, dark by night).
  return 'auto'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    
    if (theme === 'auto') {
       const band = root.dataset.chrono || 'night'
       const isDay = band === 'dawn' || band === 'day'
       root.classList.toggle('dark', !isDay)
    } else {
       root.classList.toggle('dark', theme === 'dark')
    }
    
    localStorage.setItem(STORAGE_KEYS.theme, theme)
  }, [theme])

  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'dark' ? 'light' : t === 'light' ? 'auto' : 'dark')),
    [],
  )

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
