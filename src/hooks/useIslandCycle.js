import { useEffect, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { playSound, chimeForIslandKind } from '@/lib/sound'

/**
 * Owns the Dynamic Island's auto-advance timer, and (P5) plays one fitting
 * chime when a genuinely new event becomes active. Keys on id + duration so
 * progress patches to a live event don't reset the dismiss clock or re-chime.
 * Sticky events (duration === null) persist until explicitly dismissed.
 * Mounted once via the DynamicIsland component.
 *
 * `SELF_CHIMED` kinds are skipped here because their call sites already play a
 * sound at that exact moment — useFocusEngine plays its completion chime right
 * before pushing `focus`/`break`/`success`, and MicroKanban plays `playSuccess`
 * as a task lands in Done before pushing `progress`. Chiming again would double
 * up. Everything else — sync state, deadlines, hydration, plain info — has no
 * existing sound and is exactly what "notifications should chime" is about.
 */
const SELF_CHIMED = new Set(['focus', 'break', 'progress', 'success', 'temple', 'hourly', 'alarm'])

export function useIslandCycle() {
  const activeId = useStore((s) => s.islandActive?.id)
  const activeKind = useStore((s) => s.islandActive?.kind)
  const duration = useStore((s) => s.islandActive?.duration)
  const advanceIsland = useStore((s) => s.advanceIsland)

  const lastSoundedIdRef = useRef(null)

  // Chime once per new event id (guarded against replay on re-render / patch).
  useEffect(() => {
    if (activeId == null || activeId === lastSoundedIdRef.current) return
    lastSoundedIdRef.current = activeId
    if (!SELF_CHIMED.has(activeKind)) {
      playSound(chimeForIslandKind(activeKind))
    }
  }, [activeId, activeKind])

  useEffect(() => {
    if (activeId == null || duration == null) return undefined
    const t = setTimeout(() => advanceIsland(), duration)
    return () => clearTimeout(t)
  }, [activeId, duration, advanceIsland])
}
