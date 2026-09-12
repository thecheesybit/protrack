import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '@/lib/constants'

export const ThemeContext = createContext(null)

function computeIsDark(t) {
  if (t === 'dark') return true
  if (t === 'light') return false
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    const slot = root.dataset.chrono || 'evening'
    const isDaySlot = slot === 'morning' || slot === 'midday' || slot === 'afternoon'
    return !isDaySlot
  }
  return false
}

function getInitialTheme() {
  if (typeof window === 'undefined') return 'auto'
  const saved = localStorage.getItem(STORAGE_KEYS.theme)
  if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved
  return 'auto'
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)
  const [isDark, setIsDark] = useState(() => computeIsDark(getInitialTheme()))

  const applyTheme = useCallback((targetTheme) => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    let darkActive
    if (targetTheme === 'auto') {
      const slot = root.dataset.chrono || 'evening'
      const isDaySlot = slot === 'morning' || slot === 'midday' || slot === 'afternoon'
      darkActive = !isDaySlot
    } else {
      darkActive = targetTheme === 'dark'
    }

    root.classList.toggle('dark', darkActive)
    setIsDark(darkActive)

    try {
      localStorage.setItem(STORAGE_KEYS.theme, targetTheme)
    } catch {
      // localStorage unavailable (private mode, quota) — preference just won't persist
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('protrack:chrono-override'))
    }
  }, [])

  const setTheme = useCallback(
    (newThemeOrFn) => {
      setThemeState((prev) => {
        const next = typeof newThemeOrFn === 'function' ? newThemeOrFn(prev) : newThemeOrFn
        applyTheme(next)
        return next
      })
    },
    [applyTheme],
  )

  // Quick 1-click toggle: always flips between light and dark instantly
  const toggleTheme = useCallback(() => {
    setThemeState(() => {
      const currentlyDark = document.documentElement.classList.contains('dark')
      const next = currentlyDark ? 'light' : 'dark'
      applyTheme(next)
      return next
    })
  }, [applyTheme])

  useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  // Sync isDark when in auto mode and chrono slot changes
  useEffect(() => {
    if (theme !== 'auto') return
    const onSync = () => {
      setIsDark(document.documentElement.classList.contains('dark'))
    }
    window.addEventListener('protrack:chrono-override', onSync)
    return () => window.removeEventListener('protrack:chrono-override', onSync)
  }, [theme])

  const value = useMemo(
    () => ({ theme, isDark, setTheme, toggleTheme }),
    [theme, isDark, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
