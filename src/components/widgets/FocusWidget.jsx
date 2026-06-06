import { useState } from 'react'
import { Play, Pause, RotateCcw, Flame, Clock, CloudRain, Waves, Wind, VolumeX, TreePine } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { WidgetFrame } from './WidgetFrame'
import { ForestView } from '@/components/focus/ForestView'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { updateSettings } from '@/services/userService'
import { logFailedFocusSession } from '@/services/focusService'
import { addLedgerEntry } from '@/services/ledgerService'

const PRESETS = [15, 25, 50]
const AMBIENTS = [
  { id: 'none', label: 'Off', Icon: VolumeX },
  { id: 'rain', label: 'Rain', Icon: CloudRain },
  { id: 'waves', label: 'Waves', Icon: Waves },
  { id: 'wind', label: 'Wind', Icon: Wind },
]

function mmss(sec) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

function Ring({ progress, color, size = 200, children }) {
  const r = (size - 16) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

export function FocusWidget({ widget, variant }) {
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const focusMin = useStore((s) => s.focusMin)
  const breakMin = useStore((s) => s.breakMin)
  const session = useStore((s) => s.session)
  const ambient = useStore((s) => s.ambient)
  const stats = useStore((s) => s.stats)

  const startFocus = useStore((s) => s.startFocus)
  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)
  const reset = useStore((s) => s.reset)
  const setDurations = useStore((s) => s.setDurations)
  const setAmbient = useStore((s) => s.setAmbient)

  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const focusAudioUrl = useStore((s) => s.settings?.focusAudioUrl || '')

  const [exitAttempts, setExitAttempts] = useState(0)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  const handleReset = async () => {
    if (status === 'idle' || phase === 'break') {
      reset()
      setExitAttempts(0)
      setShowExitConfirm(false)
      return
    }

    const nextAttempts = exitAttempts + 1
    setExitAttempts(nextAttempts)

    if (nextAttempts < 3) {
      setShowExitConfirm(true)
    } else {
      setShowExitConfirm(false)
      setExitAttempts(0)

      const st = useStore.getState()
      try {
        const uid = user?.uid
        if (uid) {
          await logFailedFocusSession(uid, {
            modeId: st.session?.modeId || activeModeId,
            subjectId: st.session?.subjectId || null,
            startedAt: st.startedAt ? new Date(st.startedAt) : new Date(),
          })
          await addLedgerEntry(uid, {
            kind: 'focus',
            title: `Focus session failed`,
            detail: `Plant died/was not planted successfully`,
            modeId: st.session?.modeId || activeModeId,
          })
        }
      } catch (err) {
        console.error('[focus] failed to log failed session', err)
      }

      reset()
      window.protrack?.window?.setFullScreen?.(false)
      
      useStore.getState().pushIsland({
        kind: 'error',
        title: 'Session failed',
        detail: 'The plant died.',
        duration: 4000,
      })
    }
  }

  const updateFocusAudioUrl = async (url) => {
    try {
      await updateSettings(user.uid, { focusAudioUrl: url })
    } catch (err) {
      console.error('[focus] failed to save audio URL', err)
    }
  }

  const isHero = variant === 'hero'
  const phaseTotal = (phase === 'focus' ? focusMin : breakMin) * 60
  const progress = phaseTotal ? 1 - secondsLeft / phaseTotal : 0
  const color = phase === 'break' ? '#10b981' : session?.color || 'rgb(var(--accent))'

  const onMain = () => {
    if (status === 'idle') startFocus()
    else if (status === 'running') pause()
    else resume()
  }

  const MainBtn = (
    <button
      onClick={onMain}
      className="flex items-center gap-2 rounded-2xl bg-accent px-5 py-2.5 font-semibold text-white shadow-glow transition-transform hover:scale-[1.02] active:scale-95"
    >
      {status === 'running' ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
      {status === 'idle' ? 'Start' : status === 'running' ? 'Pause' : 'Resume'}
    </button>
  )

  const subtitle = `${stats?.currentStreak || 0}-day streak · ${stats?.treesGrown || 0} trees`

  return (
    <WidgetFrame widget={widget} variant={variant} subtitle={subtitle}>
      {isHero ? (
        <div className="flex h-full flex-col gap-6 lg:flex-row">
          {/* Timer */}
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <Ring progress={progress} color={color} size={220}>
              <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
                {phase === 'break' ? 'Break' : 'Focus'}
              </span>
              <span className="text-5xl font-bold tabular-nums">{mmss(secondsLeft)}</span>
              {session?.label && (
                <span className="mt-1 max-w-[160px] truncate text-xs text-muted">
                  {session.label}
                </span>
              )}
            </Ring>

            <div className="flex items-center gap-2">
              {MainBtn}
              <button
                onClick={handleReset}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line text-muted transition-colors hover:text-ink"
                aria-label="Reset"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>

            {/* presets + ambient */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-1.5">
                {PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setDurations(m, breakMin)}
                    disabled={status !== 'idle'}
                    className={cn(
                      'rounded-lg px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40',
                      focusMin === m ? 'bg-accent/20 text-accent' : 'text-muted hover:text-ink',
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {AMBIENTS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setAmbient(id)}
                    title={label}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                      ambient === id ? 'border-accent/50 text-accent' : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>

              {/* Custom Audio URL */}
              <div className="mt-2 w-full max-w-[240px]">
                <label className="mb-1 block text-center text-[10px] uppercase tracking-wider text-muted">
                  Custom Background Audio URL
                </label>
                <input
                  type="text"
                  value={focusAudioUrl}
                  onChange={(e) => updateFocusAudioUrl(e.target.value)}
                  placeholder="e.g. YouTube lo-fi link…"
                  className="w-full rounded-xl border border-line bg-surface-2/60 px-3 py-1.5 text-xs text-center outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Forest + stats */}
          <div className="flex flex-1 flex-col rounded-2xl border border-line/50 bg-surface-2/30 p-4">
            <div className="grid grid-cols-3 gap-2">
              <Stat icon={<Flame className="h-4 w-4" />} label="Streak" value={`${stats?.currentStreak || 0}d`} />
              <Stat icon={<Clock className="h-4 w-4" />} label="Total" value={`${Math.round((stats?.totalFocusMin || 0) / 60)}h`} />
              <Stat icon={<TreePine className="h-4 w-4" />} label="Trees" value={stats?.treesGrown || 0} />
            </div>
            <div className="mb-2 mt-4 text-xs font-medium text-muted">Your forest</div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ForestView count={stats?.treesGrown || 0} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <Ring progress={progress} color={color} size={132}>
            <span className="text-2xl font-bold tabular-nums">{mmss(secondsLeft)}</span>
            <span className="text-[10px] uppercase tracking-widest text-muted">
              {phase === 'break' ? 'Break' : 'Focus'}
            </span>
          </Ring>
          <div className="flex items-center gap-2">
            <button
              onClick={onMain}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              {status === 'running' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
              {status === 'idle' ? 'Start' : status === 'running' ? 'Pause' : 'Resume'}
            </button>
            <button
              onClick={handleReset}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted hover:text-ink"
              aria-label="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="edge-light max-w-sm rounded-3xl border border-line bg-surface p-6 text-center shadow-glass-lg">
            <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <TreePine className="h-6 w-6 animate-pulse" />
            </span>
            <h3 className="mb-2 text-lg font-bold text-ink">A tree is planting!</h3>
            <p className="mb-5 text-sm text-muted">
              Urging you to stay! If you abandon this deep focus session, your plant will die.
            </p>
            <div className="mb-4 text-xs font-semibold text-amber-500">
              Attempt {exitAttempts} of 2 warning pushes.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 rounded-2xl bg-accent py-2.5 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
              >
                Keep Focus
              </button>
              <button
                onClick={handleReset}
                className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink"
              >
                Quit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </WidgetFrame>
  )
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-surface/60 py-2">
      <span className="text-muted">{icon}</span>
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-[10px] text-muted">{label}</span>
    </div>
  )
}
