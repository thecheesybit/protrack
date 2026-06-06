import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { subscribeToSlots } from '@/services/timetableService'

/** Realtime timetable slots for the given mode, or aggregated if modeId === 'all' */
export function useTimetable(modeId) {
  const { user } = useAuth()
  const modes = useStore((s) => s.modes)
  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !modeId) {
      setSlots([])
      setLoading(false)
      return undefined
    }

    setLoading(true)

    if (modeId === 'all') {
      if (!modes || modes.length === 0) {
        setSlots([])
        setLoading(false)
        return undefined
      }

      const slotsMap = {}
      const loadedModeIds = new Set()

      const unsubs = modes.map(m => subscribeToSlots(user.uid, m.id, (s) => {
        // Tag slots with their origin mode
        slotsMap[m.id] = s.map(slot => ({
          ...slot,
          _modeName: m.name,
          _modeColor: m.accentColor,
          _modeId: m.id,
          // if no color set on slot, fallback to mode color
          color: slot.color || m.accentColor
        }))
        
        loadedModeIds.add(m.id)
        const allSlots = Object.values(slotsMap)
          .flat()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMin - b.startMin)
        
        setSlots(allSlots)
        
        if (loadedModeIds.size === modes.length) {
          setLoading(false)
        }
      }))
      
      return () => unsubs.forEach(u => u())
    }

    const unsub = subscribeToSlots(user.uid, modeId, (s) => {
      setSlots(s)
      setLoading(false)
    })
    return unsub
  }, [user, modeId, modes])

  return { slots, loading }
}
