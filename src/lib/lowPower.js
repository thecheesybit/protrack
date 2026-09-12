import { useState, useEffect, useCallback } from 'react'

export const LOW_POWER_STORAGE_KEY = 'protrack:low_power_mode'
export const LOW_POWER_EVENT = 'protrack:low-power-changed'

export function isLowPowerMode() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(LOW_POWER_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setLowPowerMode(enabled) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LOW_POWER_STORAGE_KEY, enabled ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent(LOW_POWER_EVENT, { detail: { enabled } }))
  } catch {
    // localStorage unavailable (private mode, quota) — preference just won't persist
  }
}

export function useLowPowerMode() {
  const [enabled, setEnabled] = useState(() => isLowPowerMode())

  useEffect(() => {
    const handleSync = (e) => {
      setEnabled(e?.detail?.enabled ?? isLowPowerMode())
    }
    window.addEventListener(LOW_POWER_EVENT, handleSync)
    return () => window.removeEventListener(LOW_POWER_EVENT, handleSync)
  }, [])

  const toggle = useCallback(() => {
    const next = !isLowPowerMode()
    setLowPowerMode(next)
    setEnabled(next)
  }, [])

  return [enabled, toggle, setLowPowerMode]
}
