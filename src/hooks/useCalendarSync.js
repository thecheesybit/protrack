import { useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { useTimetable } from '@/hooks/useTimetable'
import { useTodos } from '@/hooks/useWellness'
import { useNotes } from '@/hooks/useNotes'
import {
  isCalendarConnected,
  syncEverything,
  CalendarAuthError,
  CalendarSetupError,
} from '@/services/calendarService'
import { isGisAvailable, ensureFreshToken, msUntilRefresh } from '@/lib/gauth'

const INTERVAL_MS = 5 * 60 * 1000
/** Fire from anywhere (e.g. Settings "Sync now") to force an immediate run. */
export const GCAL_SYNC_NOW_EVENT = 'protrack:gcal-sync-now'

/**
 * "Live while the app is open" Google Calendar sync. Mounted once in Dashboard.
 *
 * PULL is display-only into the local `gcalSlice` cache — every visible calendar
 * (primary, secondary, subscribed, holidays, shared, Gmail-generated) — so it
 * never touches Firestore write quota. PUSH is two-way for the user's own
 * primary calendar (slots / dated to-dos / dated notes).
 *
 * Token: with `VITE_GOOGLE_OAUTH_CLIENT_ID` set, GIS refreshes the token
 * silently in the background (proactive timer + retry inside calFetch), so the
 * connection persists like a login. Without it, a lapse surfaces ONE sticky
 * "Reconnect" Island prompt.
 */
export function useCalendarSync() {
  const { user } = useAuth()
  const settings = useStore((s) => s.settings)
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const pushIsland = useStore((s) => s.pushIsland)
  const dismissIsland = useStore((s) => s.dismissIsland)
  const setGcalEvents = useStore((s) => s.setGcalEvents)
  const setGcalCalendars = useStore((s) => s.setGcalCalendars)
  const setGcalSetupError = useStore((s) => s.setGcalSetupError)

  const { slots } = useTimetable('all')
  const todos = useTodos()
  const notes = useNotes()

  const runningRef = useRef(false)
  const lastStateRef = useRef('init') // 'init' | 'ok' | 'auth' | 'setup' | 'error'
  const scopeNudgedRef = useRef(false)
  const offlineIslandIdRef = useRef(null)
  const refreshTimerRef = useRef(null)
  const dataRef = useRef({ slots, todos, notes })
  dataRef.current = { slots, todos, notes }

  const autoSyncOn = settings?.gcalAutoSync !== false

  useEffect(() => {
    if (!user) return undefined

    // Proactive silent token refresh so the user never sees a reconnect prompt.
    const scheduleRefresh = () => {
      if (!isGisAvailable()) return
      clearTimeout(refreshTimerRef.current)
      const wait = Math.max(30 * 1000, msUntilRefresh() || 45 * 60 * 1000)
      refreshTimerRef.current = setTimeout(async () => {
        try {
          await ensureFreshToken()
        } catch {
          /* the next sync run surfaces the reconnect prompt */
        }
        scheduleRefresh()
      }, wait)
    }

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
          notes: dataRef.current.notes,
          tasks: [],
        })

        setGcalEvents(res.events || [])
        if (res.calendars?.length) setGcalCalendars(res.calendars)
        setGcalSetupError(null)
        scheduleRefresh()

        // Token works but lacks the wide read scope → syncing primary only.
        // Nudge once (non-sticky) to reconnect for holidays / all calendars.
        if (res.scopeLimited && !scopeNudgedRef.current) {
          scopeNudgedRef.current = true
          pushIsland({
            kind: 'info',
            title: 'Syncing your primary calendar',
            detail: 'Reconnect Google Calendar to also pull holidays & shared calendars.',
            duration: 6000,
          })
        } else if (!res.scopeLimited) {
          scopeNudgedRef.current = false
        }

        const changed = res.pushed + res.patched + res.deleted
        if (lastStateRef.current !== 'ok' && offlineIslandIdRef.current != null) {
          dismissIsland(offlineIslandIdRef.current)
          offlineIslandIdRef.current = null
        }
        if (changed > 0 || lastStateRef.current === 'auth' || lastStateRef.current === 'setup' || lastStateRef.current === 'error') {
          pushIsland({
            kind: 'sync-online',
            title: 'Calendar synced',
            detail: changed > 0 ? `${changed} pushed` : `${res.events?.length || 0} events`,
            duration: 2400,
          })
        }
        lastStateRef.current = 'ok'
      } catch (err) {
        if (err instanceof CalendarSetupError) {
          setGcalSetupError({ message: err.message, consoleUrl: err.consoleUrl })
          if (lastStateRef.current !== 'setup') {
            offlineIslandIdRef.current = pushIsland({
              kind: 'sync-offline',
              title: 'Google Calendar not enabled',
              detail: 'Enable the Calendar API in Google Cloud Console, then reconnect.',
              sticky: true,
            })
          }
          lastStateRef.current = 'setup'
        } else if (err instanceof CalendarAuthError) {
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
    scheduleRefresh()
    const interval = setInterval(run, INTERVAL_MS)
    const onFocus = () => run()
    const onSyncNow = () => run({ manual: true })
    window.addEventListener('focus', onFocus)
    window.addEventListener(GCAL_SYNC_NOW_EVENT, onSyncNow)

    return () => {
      clearInterval(interval)
      clearTimeout(refreshTimerRef.current)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(GCAL_SYNC_NOW_EVENT, onSyncNow)
    }
  }, [
    user,
    autoSyncOn,
    activeModeId,
    modes,
    settings?.gcalInboxModeId,
    pushIsland,
    dismissIsland,
    setGcalEvents,
    setGcalCalendars,
    setGcalSetupError,
  ])
}
