import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Moon, MoonStar, Sunrise, Sun, CloudSun, Sunset } from 'lucide-react'
import { useStore } from '@/store/useStore'

const SLOT_META = {
  deep_night: { Icon: MoonStar, label: 'Deep night' },
  dawn: { Icon: Sunrise, label: 'Dawn' },
  morning: { Icon: Sunrise, label: 'Morning' },
  midday: { Icon: Sun, label: 'Midday' },
  afternoon: { Icon: CloudSun, label: 'Afternoon' },
  dusk: { Icon: Sunset, label: 'Dusk' },
  evening: { Icon: Moon, label: 'Evening' },
}

/**
 * Time HUD (DESIGN_SYSTEM.md §6) — a quiet dark-island pill in the title bar
 * naming the current chrono slot.
 *
 * Behavior:
 * - Initially visible for 30 seconds on load (or slot change), then slides up out of view.
 * - When the mouse enters the top-center hover zone, it smoothly and slowly slides back down.
 * - When the mouse leaves the hover zone, it retreats back up after a short grace period.
 */
export function TimeHud() {
  const slot = useStore((s) => s.chronoSlot)
  const focusLocked = useStore((s) => s.focusLocked)

  const [isVisible, setIsVisible] = useState(true)
  const hideTimerRef = useRef(null)

  const clearTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  const startHideTimer = (ms = 30000) => {
    clearTimer()
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false)
    }, ms)
  }

  // Initial 30-second visibility, re-triggers on slot change
  useEffect(() => {
    setIsVisible(true)
    startHideTimer(30000)
    return () => clearTimer()
    // startHideTimer/clearTimer are stable enough; only re-run on slot change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot])

  const handleMouseEnter = () => {
    clearTimer()
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    // Grace period after leaving before sliding back up slowly
    startHideTimer(3500)
  }

  if (focusLocked) return null
  const { Icon, label } = SLOT_META[slot] || SLOT_META.morning

  return (
    <div
      className="fixed left-1/2 top-0 z-20 flex -translate-x-1/2 flex-col items-center pt-2 pb-4 px-10 pointer-events-auto"
      style={{ WebkitAppRegion: 'no-drag' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        initial={{ y: 0, opacity: 1 }}
        animate={{
          y: isVisible ? 0 : -50,
          opacity: isVisible ? 1 : 0,
        }}
        transition={{
          duration: 0.65,
          ease: [0.16, 1, 0.3, 1], // slow and graceful slide
        }}
        className="island-dark flex select-none items-center gap-2 rounded-full px-3.5 py-1.5 shadow-premium-md cursor-default pointer-events-auto"
        title={`Chrono theme: ${label}`}
      >
        <Icon className="h-3.5 w-3.5 text-accent-2" />
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] opacity-90">
          {label}
        </span>
      </motion.div>
    </div>
  )
}
