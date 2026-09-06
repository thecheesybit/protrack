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
 * naming the current chrono slot, so the canvas turning with the sky reads as
 * deliberate. Label only (no clock — the FlipClock already shows the time).
 * Sits in the drag region so the window is still draggable from here.
 */
export function TimeHud() {
  const slot = useStore((s) => s.chronoSlot)
  const focusLocked = useStore((s) => s.focusLocked)

  if (focusLocked) return null
  const { Icon, label } = SLOT_META[slot] || SLOT_META.morning

  return (
    <div
      className="island-dark fixed left-1/2 top-2 z-20 flex -translate-x-1/2 select-none items-center gap-2 rounded-full px-3.5 py-1.5 shadow-premium-md"
      style={{ WebkitAppRegion: 'drag' }}
      title={`Chrono theme: ${label}`}
    >
      <Icon className="h-3.5 w-3.5 text-accent-2" />
      <span className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] opacity-90">
        {label}
      </span>
    </div>
  )
}
