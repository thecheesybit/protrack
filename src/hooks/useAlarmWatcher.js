import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import {
  getAlarms,
  isAlarmDue,
  dismissAlarm,
  ALARMS_CHANGED_EVENT,
  formatTime12h,
} from '@/services/alarmService'
import { startAlarmRingtone, playSound } from '@/lib/sound'
import { notifyAlarm, ensureNotificationPermission } from '@/lib/notify'
import { useGlobalTick } from '@/hooks/useGlobalTick'

/**
 * useAlarmWatcher — Watches all active alarms and triggers ringing alert + sound when due.
 *
 * Runs continuously in Dashboard using the unified global 1-second ticker.
 * When an alarm time is reached:
 *  1. Sets `activeRingingAlarm` in uiSlice (surfaces the Phone Alarm Clock overlay).
 *  2. Dispatches looping phone alarm ringtone `startAlarmRingtone()`.
 *  3. Sends desktop / OS notification pinned with click-to-turn-off.
 *  4. Updates recurrence / lastTriggeredTime in localStorage.
 */
export function useAlarmWatcher() {
  const activeRingingAlarm = useStore((s) => s.activeRingingAlarm)
  const setActiveRingingAlarm = useStore((s) => s.setActiveRingingAlarm)
  const pushIsland = useStore((s) => s.pushIsland)

  const activeRingingRef = useRef(activeRingingAlarm)
  activeRingingRef.current = activeRingingAlarm

  // Alarms that became due while another alarm was already ringing on screen.
  // `isAlarmDue` only returns true during the alarm's exact due minute, so
  // without this queue a second alarm due at (or shortly after) the same
  // minute as the first would silently never ring once that minute passed —
  // e.g. two alarms both set for 07:00: the first rings, the second is due
  // the same tick but the screen is occupied; by the time the user dismisses
  // the first (which is the whole point of an alarm — it may take minutes),
  // 07:00 has passed and the second alarm is gone for good.
  const dueQueueRef = useRef([])

  // Request notification permissions proactively
  useEffect(() => {
    ensureNotificationPermission().catch(() => {})
  }, [])

  const ringAlarm = useCallback((alarm) => {
    // Set active ringing alarm for UI Phone Alarm Clock modal
    setActiveRingingAlarm(alarm)

    // Continuous phone alarm ringtone playback
    const soundName = alarm.sound || 'alarm'
    if (soundName === 'alarm') {
      startAlarmRingtone()
    } else {
      playSound(soundName)
    }

    // Desktop OS notification with click-to-turn-off & restore
    notifyAlarm(alarm, {
      onClick: () => {
        try {
          window.focus?.()
          if (typeof window !== 'undefined' && window.protrack?.window?.restore) {
            window.protrack.window.restore()
          }
        } catch {
          // window/protrack bridge unavailable — clicking still dismisses the notification
        }
      },
    })

    // Dynamic Island event
    const { formatted } = formatTime12h(alarm.time)
    const title = alarm.label ? `Alarm: ${alarm.label}` : 'Alarm Reminder'
    pushIsland?.({
      kind: 'alarm',
      title,
      detail: `${formatted} · Click to turn off`,
      duration: 10000,
    })
  }, [setActiveRingingAlarm, pushIsland])

  const checkAlarms = useCallback((nowDate) => {
    const alarms = getAlarms()
    const now = nowDate instanceof Date ? nowDate : new Date()

    for (const alarm of alarms) {
      if (isAlarmDue(alarm, now)) {
        // Mark triggered in storage so it doesn't loop
        dismissAlarm(alarm.id)

        if (activeRingingRef.current || dueQueueRef.current.some((a) => a.id === alarm.id)) {
          // Screen is busy with another alarm — queue this one instead of
          // dropping it; it'll ring the moment the current one is dismissed.
          dueQueueRef.current.push(alarm)
          continue
        }

        ringAlarm(alarm)
        break // one alarm on screen at a time
      }
    }
  }, [ringAlarm])

  // As soon as the screen is free, surface the next queued alarm (if any).
  useEffect(() => {
    if (activeRingingAlarm) return
    const next = dueQueueRef.current.shift()
    if (next) ringAlarm(next)
  }, [activeRingingAlarm, ringAlarm])

  // Synchronized 1-second wall-clock tick
  useGlobalTick(checkAlarms)

  useEffect(() => {
    checkAlarms()

    // Also check on window focus or storage change
    const onSync = () => checkAlarms()
    window.addEventListener(ALARMS_CHANGED_EVENT, onSync)
    window.addEventListener('focus', onSync)

    return () => {
      window.removeEventListener(ALARMS_CHANGED_EVENT, onSync)
      window.removeEventListener('focus', onSync)
    }
  }, [checkAlarms])
}
