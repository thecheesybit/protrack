import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useTimetable } from '@/hooks/useTimetable'
import { useTodos } from '@/hooks/useWellness'
import {
  isCalendarConnected,
  syncEverything,
  CalendarAuthError,
} from '@/services/calendarService'

const INTERVAL_MS = 5 * 60 * 1000
/** Fire from anywhere (e.g. Settings "Sync now") to force an immediate run. */
export const GCAL_SYNC_NOW_EVENT = 'protrack:gcal-sync-now'

/**
 * "Live while the app is open" Google Calendar sync. Mounted once in Dashboard.
 *
 * Runs `syncEverything` on mount, every 5 minutes, on window focus, and on the
 * `protrack:gcal-sync-now` event. Because the OAuth token can't refresh in the
 * background on the free tier, a lapsed token surfaces ONE sticky Island prompt
 * ("Reconnect Google Calendar") — never an automatic browser re-open. The
 * Island only speaks on a state change (first success, recovery, first failure),
 * not on every quiet tick.
 *
 * Free-tier: no new always-on listeners of its own — it reuses the cross-mode
 * `useTimetable('all')` slot subscriptions (the same ones the hero timetable
 * view uses) and the shared todos listener, and does bounded one-shot Calendar
 * API reads via a persisted syncToken.
 */
export function useCalendarSync() {
  const { user } = useAuth()
  const settings = useStore((s) => s.settings)
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const pushIsland = useStore((s) => s.pushIsland)
  const dismissIsland = useStore((s) => s.dismissIsland)

  const { slots } = useTimetable('all')
  const todos = useTodos()

  const runningRef = useRef(false)
  const lastStateRef = useRef('init') // 'init' | 'ok' | 'auth' | 'error'
  const offlineIslandIdRef = useRef(null)
  // Keep the freshest data without re-arming the interval every render.
  const dataRef = useRef({ slots, todos })
  dataRef.current = { slots, todos }

  const autoSyncOn = settings?.gcalAutoSync !== false

  useEffect(() => {
    if (!user) return undefined

    const run = async ({ manual = false } = {}) => {
      if (runningRef.current) return
      if (!isCalendarConnected()) return
      if (!manual && !autoSyncOn) return
      runningRef.current = true
      try {
        const inboxModeId =
          settings?.gcalInboxModeId ||
          (activeModeId && activeModeId !== 'all' ? activeModeId : modes[0]?.id)

        const res = await syncEverything(user.uid, {
          modes,
          inboxModeId,
          slots: dataRef.current.slots,
          todos: dataRef.current.todos,
          tasks: [],
        })

        const changed = res.pulled + res.pushed + res.patched + res.deleted
        if (lastStateRef.current === 'auth' && offlineIslandIdRef.current != null) {
          dismissIsland(offlineIslandIdRef.current)
          offlineIslandIdRef.current = null
        }
        if (changed > 0 || lastStateRef.current === 'auth' || lastStateRef.current === 'error') {
          pushIsland({
            kind: 'sync-online',
            title: 'Calendar synced',
            detail: changed > 0 ? `${changed} change${changed === 1 ? '' : 's'}` : null,
            duration: 2400,
          })
        }
        lastStateRef.current = 'ok'
      } catch (err) {
        if (err instanceof CalendarAuthError) {
          if (lastStateRef.current !== 'auth') {
            offlineIslandIdRef.current = pushIsland({
              kind: 'sync-offline',
              title: 'Reconnect Google Calendar',
              detail: 'The Google session expired — reconnect in Settings or the calendar header.',
              sticky: true,
            })
          }
          lastStateRef.current = 'auth'
        } else {
          if (lastStateRef.current !== 'error') {
            pushIsland({
              kind: 'sync-offline',
              title: 'Calendar sync failed',
              detail: err.message,
              duration: 5000,
            })
          }
          lastStateRef.current = 'error'
          console.error('[calendar] sync failed', err)
        }
      } finally {
        runningRef.current = false
      }
    }

    run()
    const interval = setInterval(run, INTERVAL_MS)
    const onFocus = () => run()
    const onSyncNow = () => run({ manual: true })
    window.addEventListener('focus', onFocus)
    window.addEventListener(GCAL_SYNC_NOW_EVENT, onSyncNow)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(GCAL_SYNC_NOW_EVENT, onSyncNow)
    }
    // Re-arm when identity / scope / auto-sync preference changes. Slots & todos
    // flow through dataRef so their churn doesn't reset the interval.
  }, [user, autoSyncOn, activeModeId, modes, settings?.gcalInboxModeId, pushIsland, dismissIsland])
}
