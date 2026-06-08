import { useEffect } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useStore } from '@/store/useStore'

/**
 * Auto-hiding ambient chrome (title bar + top nav + mode switcher).
 *
 * - Reveals when the pointer approaches the top edge; hides after a delay once
 *   it leaves — snappier while a Pomodoro is running (deep-focus immersion).
 * - Always shown when a panel/overlay is open or the user prefers reduced motion.
 * - One rAF-throttled pointer listener, hysteresis thresholds, boolean state →
 *   no re-render storms.
 */
const REVEAL_Y = 72 // px from top that reveals
const HIDE_Y = 150 // must move below this before the hide timer arms

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
