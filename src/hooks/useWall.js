import { useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { SEED_PATREONS } from '@/lib/constants'

/**
 * The Wall of Honor entries: live verified patrons merged with the local seed
 * set (so the wall is alive from day one at zero read cost). Live entries win
 * over seeds on id collision. Sorted newest/seed-first then by amount.
 */
export function useWall() {
  const live = useStore((s) => s.verifiedPatreons)
  return useMemo(() => {
    const byId = new Map()
    SEED_PATREONS.forEach((p) => byId.set(p.id, p))
    live.forEach((p) => byId.set(p.id, p))
    return Array.from(byId.values()).sort((a, b) => (b.amount || 0) - (a.amount || 0))
  }, [live])
}

/** Whether the given uid is an established (verified) patron. */
export function useIsPatreon(uid) {
  const live = useStore((s) => s.verifiedPatreons)
  return useMemo(() => Boolean(uid && live.some((p) => p.id === uid)), [live, uid])
}
