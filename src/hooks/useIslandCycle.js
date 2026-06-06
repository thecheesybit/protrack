import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

/**
 * Owns the Dynamic Island's auto-advance timer. When a non-sticky event becomes
 * active, schedules advanceIsland() after its duration. Keys on id + duration so
 * progress patches to a live event don't reset the dismiss clock. Sticky events
 * (duration === null) persist until explicitly dismissed. Mounted once via the
 * DynamicIsland component.
 */
export function useIslandCycle() {
  const activeId = useStore((s) => s.islandActive?.id)
  const duration = useStore((s) => s.islandActive?.duration)
  const advanceIsland = useStore((s) => s.advanceIsland)

  useEffect(() => {
    if (activeId == null || duration == null) return undefined
    const t = setTimeout(() => advanceIsland(), duration)
    return () => clearTimeout(t)
  }, [activeId, duration, advanceIsland])
}
