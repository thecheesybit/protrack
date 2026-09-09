import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BellRing, BellOff, Clock, RotateCcw, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { snoozeAlarm, formatTime12h } from '@/services/alarmService'
import { playSound, startAlarmRingtone, stopAlarmRingtone } from '@/lib/sound'
import { closeActiveAlarmNotification } from '@/lib/notify'

/**
 * Phone Alarm Clock Modal / Overlay — Full tactile phone-style ringing experience.
 *
 * Requirements:
 *  - Continuous phone alarm ringtone playback while ringing.
 *  - Shockwave animation + vibrating bell.
 *  - Real-time digital clock display.
 *  - Big tactile "TURN OFF ALARM" button.
 *  - "SNOOZE (+5m)" button.
 *  - Keyboard shortcuts (Space / Enter / Esc) to turn off immediately.
 *  - Closes desktop OS notification cleanly upon interaction.
 */
export function AlarmRingingBanner() {
  const activeRingingAlarm = useStore((s) => s.activeRingingAlarm)
  const setActiveRingingAlarm = useStore((s) => s.setActiveRingingAlarm)

  // Live real-time digital clock display
  const [currentTime, setCurrentTime] = useState(() => new Date())
  useEffect(() => {
    if (!activeRingingAlarm) return
    const timer = setInterval(() => setCurrentTime(new Date()), 500)
    return () => clearInterval(timer)
  }, [activeRingingAlarm])

  // Continuous phone alarm music / audio loop while active
  useEffect(() => {
    if (!activeRingingAlarm) return

    const soundName = activeRingingAlarm.sound || 'alarm'
    if (soundName === 'alarm') {
      startAlarmRingtone()
      return () => {
        stopAlarmRingtone()
      }
    }

    // Fallback for custom sound selection
    playSound(soundName)
    const soundInterval = setInterval(() => {
      playSound(soundName)
    }, 2800)

    return () => clearInterval(soundInterval)
  }, [activeRingingAlarm])

  // Turn off alarm completely
  const handleTurnOff = () => {
    stopAlarmRingtone()
    closeActiveAlarmNotification()
    setActiveRingingAlarm(null)
    toast.success('Alarm turned off', { icon: '🔕' })
  }

  // Snooze for 5 minutes
  const handleSnooze = () => {
    if (!activeRingingAlarm) return
    stopAlarmRingtone()
    closeActiveAlarmNotification()
    snoozeAlarm(activeRingingAlarm.id, 5)
    setActiveRingingAlarm(null)
    toast('Snoozed for 5 minutes', { icon: '⏰' })
  }

  // Keyboard shortcut listener (Space, Enter, Esc to turn off)
  useEffect(() => {
    if (!activeRingingAlarm) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        handleTurnOff()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeRingingAlarm]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeRingingAlarm) return null

  const { formatted } = formatTime12h(activeRingingAlarm.time)
  const label = activeRingingAlarm.label || 'Alarm Reminder'

  // Format real-time live clock (hours:minutes)
  const hours = currentTime.getHours()
  const minutes = String(currentTime.getMinutes()).padStart(2, '0')
  const seconds = String(currentTime.getSeconds()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHours = String(hours % 12 || 12).padStart(2, '0')

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl select-none">
        {/* Ambient pulsing aura lights */}
        <div className="pointer-events-none absolute h-96 w-96 rounded-full bg-rose-500/20 blur-[130px] animate-pulse" />
        <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-amber-500/15 blur-[120px] animate-pulse" style={{ animationDelay: '-1s' }} />

        <motion.div
          key="ringing-phone-alarm"
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 24 }}
          className="relative w-full max-w-md rounded-3xl border border-white/20 bg-surface/95 p-6 sm:p-8 shadow-2xl backdrop-blur-2xl ring-2 ring-rose-500/40 text-center flex flex-col items-center gap-6 overflow-hidden"
        >
          {/* Subtle top indicator bar */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono font-semibold">
            <Volume2 className="h-3.5 w-3.5 animate-pulse" />
            <span>ALARM RINGING</span>
          </div>

          {/* Shockwave Ripples + Vibrating Bell Avatar */}
          <div className="relative flex items-center justify-center my-1">
            {/* Concentric pulsing shockwave rings */}
            <div className="absolute h-24 w-24 rounded-full border border-rose-500/40 animate-ping pointer-events-none" />
            <div className="absolute h-32 w-32 rounded-full border border-rose-500/20 animate-ping pointer-events-none" style={{ animationDuration: '1.8s' }} />

            <motion.div
              animate={{
                rotate: [-16, 16, -12, 12, -6, 6, 0],
                scale: [1, 1.08, 1],
              }}
              transition={{
                repeat: Infinity,
                repeatDelay: 0.6,
                duration: 0.8,
              }}
              className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-rose-500/50 bg-gradient-to-br from-rose-500/30 to-rose-600/20 text-rose-400 shadow-glow"
            >
              <BellRing className="h-10 w-10 drop-shadow-md" />
            </motion.div>
          </div>

          {/* Live Real-Time Digital Clock */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-baseline gap-2 font-outfit text-5xl sm:text-6xl font-black tracking-tight text-ink">
              <span>{displayHours}:{minutes}</span>
              <span className="text-xl sm:text-2xl font-bold font-mono text-muted/80">{ampm}</span>
              <span className="text-xs font-mono text-muted/60">:{seconds}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-muted">
              <Clock className="h-3.5 w-3.5 text-accent" />
              <span>Alarm set for {formatted}</span>
            </div>
          </div>

          {/* Alarm Label Title */}
          <div className="px-2">
            <h2 className="font-outfit text-xl sm:text-2xl font-bold text-ink tracking-tight break-words">
              {label}
            </h2>
          </div>

          {/* Phone Alarm Clock Buttons */}
          <div className="flex flex-col gap-3 w-full pt-2">
            {/* Primary Action: Big Tactile TURN OFF Button */}
            <motion.button
              type="button"
              onClick={handleTurnOff}
              whileTap={{ scale: 0.96 }}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-rose-500 hover:from-rose-600 hover:to-rose-700 text-white font-outfit text-lg font-extrabold tracking-wide shadow-xl hover:shadow-glow active:scale-95 transition-all flex items-center justify-center gap-3 cursor-pointer border-b-[3px] border-b-black/30"
              title="Turn off alarm"
            >
              <BellOff className="h-5 w-5" />
              <span>TURN OFF ALARM</span>
            </motion.button>

            {/* Secondary Action: Snooze 5 Minutes */}
            <motion.button
              type="button"
              onClick={handleSnooze}
              whileTap={{ scale: 0.97 }}
              className="w-full py-3.5 px-6 rounded-2xl bg-surface-2 hover:bg-surface-2/80 text-ink border border-line/60 font-semibold text-base shadow-sm active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              title="Snooze for 5 minutes"
            >
              <RotateCcw className="h-4 w-4 text-accent" />
              <span>Snooze for 5 minutes</span>
            </motion.button>
          </div>

          {/* Keyboard Hint */}
          <p className="text-[11px] font-mono tracking-wider text-muted/60 -mt-2">
            Press SPACE or ESC to turn off
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
