import { useEffect } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useStore } from '@/store/useStore'

/**
 * Auto-hiding ambient chrome (title bar + top nav + mode switcher).
 *
 * - Always shown when a panel/overlay is open or the user prefers reduced motion.
 * - Boolean state only → no re-render storms.
 */
export function useAutoHideChrome() {
  const setChromeHidden = useStore((s) => s.setChromeHidden)
  const aiOpen = useStore((s) => s.aiOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const focusContext = useStore((s) => s.focusContext)
  const reduceMotion = useReducedMotion()

  const forceShow = aiOpen || settingsOpen || Boolean(focusContext)

  // Any open overlay (or reduced motion) keeps chrome pinned visible.
  useEffect(() => {
    if (forceShow || reduceMotion) {
      setChromeHidden(false)
    }
  }, [forceShow, reduceMotion, setChromeHidden])
}
