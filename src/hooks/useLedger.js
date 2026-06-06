import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { subscribeToLedger } from '@/services/ledgerService'

/** Realtime, bounded achievement log for the read-only history pane. */
export function useLedger() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!user) {
      setEntries([])
      return undefined
    }
    return subscribeToLedger(user.uid, setEntries)
  }, [user])

  return entries
}
