import { useEffect, useRef } from 'react'
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

/**
 * useAlarmWatcher — Watches all active alarms and triggers ringing alert + sound when due.
 *
 * Runs continuously in Dashboard. When an alarm time is reached:
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

  // Request notification permissions proactively
  useEffect(() => {
    ensureNotificationPermission().catch(() => {})
  }, [])

  useEffect(() => {
    const checkAlarms = () => {
      // If an alarm is already actively ringing on screen, wait until user addresses it
      if (activeRingingRef.current) return

      const alarms = getAlarms()
      const now = new Date()

      for (const alarm of alarms) {
        if (isAlarmDue(alarm, now)) {
          // Mark triggered in storage so it doesn't loop
          dismissAlarm(alarm.id)

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
              } catch {}
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

          break // one alarm at a time
        }
      }
    }

    const timer = setInterval(checkAlarms, 1000)
    checkAlarms()

    // Also check on window focus or storage change
    window.addEventListener(ALARMS_CHANGED_EVENT, checkAlarms)
    window.addEventListener('focus', checkAlarms)

    return () => {
      clearInterval(timer)
      window.removeEventListener(ALARMS_CHANGED_EVENT, checkAlarms)
      window.removeEventListener('focus', checkAlarms)
    }
  }, [setActiveRingingAlarm, pushIsland])
}
