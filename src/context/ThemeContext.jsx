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
       // Follow the 7-slot sky: light during the working day, dark otherwise.
       // (useChronoTheme keeps this in sync every minute; this handles the
       // moment the user switches back to auto.)
       const slot = root.dataset.chrono || 'evening'
       const isDaySlot = slot === 'morning' || slot === 'midday' || slot === 'afternoon'
       root.classList.toggle('dark', !isDaySlot)
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
