import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { buildLeaderboardEntry, isLeaderboardOptedOut, needsLeaderboardNotice } from '@/lib/leaderboard'
import { publishLeaderboardEntry, removeLeaderboardEntry } from '@/services/leaderboardService'

const SIG_KEY = 'protrack:lb_sig'
const REMOVED_KEY = 'protrack:lb_removed'

function readLS(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLS(key, val) {
  try {
    localStorage.setItem(key, val)
  } catch {
    /* private mode */
  }
}
function clearLS(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* private mode */
  }
}

/**
 * Publishes the signed-in user's display-safe aggregate to the public
 * leaderboard. Mounted once in the Dashboard.
 *
 * Behaviour:
 *  - **Default on**, but never publishes until the user has acknowledged the
 *    one-time disclosure (`settings.leaderboardNoticeSeen`) — so nothing is
 *    published silently.
 *  - **Opt-out** (`settings.leaderboardOptOut`) removes the entry once — but
 *    opt-out is currently PAUSED (`LEADERBOARD_OPT_OUT_ENABLED`), so the flag is
 *    ignored and a previously opted-out user is re-notified before publishing.
 *  - **Write-coalesced** via a localStorage signature so it writes only when the
 *    published numbers actually change (free-tier discipline).
 */
export function useLeaderboardPublish() {
  const { user } = useAuth()
  const uid = user?.uid
  const displayName = user?.displayName
  const photoURL = user?.photoURL
  const settings = useStore((s) => s.settings)
  const stats = useStore((s) => s.stats)
  const { sessions } = useFocusSessions()

  const optedOut = isLeaderboardOptedOut(settings)
  const noticePending = needsLeaderboardNotice(settings)

  useEffect(() => {
    if (!uid) return

    // Opted out → ensure the entry is gone (once).
    if (optedOut) {
      if (readLS(REMOVED_KEY) === uid) return
      removeLeaderboardEntry(uid).then(() => {
        writeLS(REMOVED_KEY, uid)
        clearLS(SIG_KEY)
      })
      return
    }

    // Re-enabled after an opt-out — clear the removed marker so a republish fires.
    if (readLS(REMOVED_KEY)) clearLS(REMOVED_KEY)

    // Wait until settings load and the user has acknowledged the disclosure.
    if (!settings || noticePending) return

    const entry = buildLeaderboardEntry(sessions, {
      displayName: displayName || 'Explorer',
      photoURL: photoURL || null,
      currentStreak: stats?.currentStreak || 0,
      allTimeMin: stats?.totalFocusMin || 0,
    })

    const sig = JSON.stringify([
      uid,
      entry.displayName,
      entry.photoURL,
      entry.weeklyMin,
      entry.monthlyMin,
      entry.allTimeMin,
      entry.currentStreak,
      entry.weeklyForest.length,
      entry.monthlyForest.length,
    ])
    if (readLS(SIG_KEY) === sig) return

    publishLeaderboardEntry(uid, entry)
      .then(() => writeLS(SIG_KEY, sig))
      .catch((err) => console.warn('[leaderboard] publish failed', err))
  }, [uid, optedOut, noticePending, settings, sessions, stats, displayName, photoURL])
}
