import { useEffect, useState } from 'react'
import { subscribeToLeaderboard } from '@/services/leaderboardService'

/**
 * Live public leaderboard entries, ordered by monthly focus minutes.
 *
 * Mounted only by the leaderboard UI, so the collection listener exists solely
 * while the board is on screen (read-cost discipline). `error` is set when the
 * read is refused — typically because the `leaderboard` Firestore rule has not
 * been deployed yet.
 */
export function useLeaderboard(max = 100) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const unsub = subscribeToLeaderboard(
      (list) => {
        setEntries(list)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
      max,
    )
    return unsub
  }, [max])

  return { entries, loading, error }
}
