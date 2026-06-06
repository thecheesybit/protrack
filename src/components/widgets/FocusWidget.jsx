import { useState } from 'react'
import { Play, Pause, RotateCcw, Flame, Clock, CloudRain, Waves, Wind, VolumeX, Volume2, TreePine, Headphones, Coffee, Trees, Zap, AudioLines } from 'lucide-react'
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
  { id: 'whitenoise', label: 'White Noise', Icon: AudioLines },
  { id: 'cafe', label: 'Cafe', Icon: Coffee },
  { id: 'forest', label: 'Forest', Icon: Trees },
  { id: 'binaural', label: 'Binaural', Icon: Headphones },
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
  const customTimerSetting = useStore((s) => s.customTimerSetting)
  const audioTracks = useStore((s) => s.audioTracks)
  const setCustomTimer = useStore((s) => s.setCustomTimer)
  const toggleConcurrentTrack = useStore((s) => s.toggleConcurrentTrack)
  const volume = useStore((s) => s.volume)
  const muted = useStore((s) => s.muted)
  const stats = useStore((s) => s.stats)

  const startFocus = useStore((s) => s.startFocus)
  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)
  const reset = useStore((s) => s.reset)
  const setVolume = useStore((s) => s.adjustTrackVolume)
  const toggleMute = useStore((s) => s.toggleMute)

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
  const phaseTotal = phase === 'focus' ? customTimerSetting.work : customTimerSetting.break
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

            {/* custom timers */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={Math.round(customTimerSetting.work / 60)}
                  onChange={(e) => setCustomTimer(Number(e.target.value) * 60, customTimerSetting.break)}
                  disabled={status !== 'idle'}
                  className="w-16 rounded border border-line bg-surface-2 px-2 py-1 text-center text-xs outline-none focus:border-accent disabled:opacity-50"
                  aria-label="Work minutes"
                />
                <span className="text-xs font-medium text-muted">min</span>
                <span className="text-xs font-medium text-muted mx-1">/</span>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={Math.round(customTimerSetting.break / 60)}
                  onChange={(e) => setCustomTimer(customTimerSetting.work, Number(e.target.value) * 60)}
                  disabled={status !== 'idle'}
                  className="w-16 rounded border border-line bg-surface-2 px-2 py-1 text-center text-xs outline-none focus:border-accent disabled:opacity-50"
                  aria-label="Break minutes"
                />
                <span className="text-xs font-medium text-muted">min break</span>
              </div>

              {/* ── Ambient Tracks (Multi) ── */}
              <div className="w-full max-w-[260px]">
                <div className="mb-1 text-center text-[10px] uppercase tracking-wider text-muted">Ambient Tracks</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {AMBIENTS.map(({ id, label, Icon }) => {
                    const isActive = audioTracks.ambient1 === id || audioTracks.ambient2 === id
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          if (isActive) {
                            if (audioTracks.ambient1 === id) toggleConcurrentTrack('ambient1', 'off')
                            else toggleConcurrentTrack('ambient2', 'off')
                          } else {
                            if (!audioTracks.ambient1 || audioTracks.ambient1 === 'off') toggleConcurrentTrack('ambient1', id)
                            else toggleConcurrentTrack('ambient2', id)
                          }
                        }}
                        title={label}
                        className={cn(
                          'flex h-9 items-center justify-center gap-1 rounded-lg border px-2 transition-all',
                          isActive
                            ? 'border-accent/50 bg-accent/10 text-accent shadow-glow-sm'
                            : 'border-line text-muted hover:text-ink hover:border-line/80',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium hidden sm:inline">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Volume Control ── */}
              <div className="flex w-full max-w-[260px] items-center gap-2">
                <button
                  onClick={toggleMute}
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    muted ? 'border-red-500/30 text-red-400' : 'border-line text-muted hover:text-ink'
                  )}
                  title={muted ? 'Unmute' : 'Mute'}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-2 accent-accent [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-glow-sm"
                />
                <span className="w-8 text-right text-[10px] font-medium tabular-nums text-muted">
                  {Math.round(volume * 100)}%
                </span>
              </div>

              {/* Custom Audio URL */}
              <div className="w-full max-w-[260px]">
                <label className="mb-1 block text-center text-[10px] uppercase tracking-wider text-muted">
                  YouTube Background Stream
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={focusAudioUrl}
                    onChange={(e) => updateFocusAudioUrl(e.target.value)}
                    placeholder="YouTube URL..."
                    className="w-full flex-1 rounded-xl border border-line bg-surface-2/60 px-3 py-2 text-xs outline-none focus:border-accent"
                  />
                  <button 
                    onClick={() => toggleConcurrentTrack('ytTrack', focusAudioUrl)}
                    className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs font-semibold text-ink transition-colors hover:bg-surface hover:text-accent"
                  >
                    Load Stream
                  </button>
                </div>
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
