import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, RotateCcw, Flame, Clock, CloudRain, Waves, Wind, VolumeX, Volume2, TreePine, Headphones, Coffee, Trees, AudioLines, Sprout, PictureInPicture2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { WidgetFrame } from './WidgetFrame'
import { ForestView } from '@/components/focus/ForestView'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { updateSettings } from '@/services/userService'
import { logFailedFocusSession } from '@/services/focusService'
import { addLedgerEntry } from '@/services/ledgerService'
import { VIDEO_PRESETS, youtubeId, toCanonicalYouTubeUrl } from '@/lib/focusScenes'
import { enterPip } from '@/lib/pip'

import f1 from '@/assets/f1.jpg'
import f2 from '@/assets/f2.jpg'
import f3 from '@/assets/f3.jpg'
import f4 from '@/assets/f4.jpg'
import f5 from '@/assets/f5.jpg'

const FOCUS_IMAGES = [f1, f2, f3, f4, f5]

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

// ── Enhanced Ring with gradient stroke + glow ────────────────────────────────

function Ring({ progress, color, size = 200, isRunning, children }) {
  const r = (size - 18) / 2
  const c = 2 * Math.PI * r
  const rOuter = (size - 6) / 2

  // Calculate sparkle position (tip of progress arc)
  const angle = progress * 2 * Math.PI - Math.PI / 2
  const sparkleX = size / 2 + r * Math.cos(angle)
  const sparkleY = size / 2 + r * Math.sin(angle)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Soft glow behind the ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}25 0%, transparent 70%)`,
        }}
        animate={isRunning ? { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] } : { scale: 1, opacity: 0.4 }}
        transition={isRunning ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : {}}
      />

      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* Decorative outer ring */}
        <circle
          cx={size / 2} cy={size / 2} r={rOuter}
          fill="none" stroke="rgb(var(--line))" strokeWidth="1" opacity="0.3"
        />

        {/* Track ring */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgb(var(--surface-2))" strokeWidth="10" opacity="0.5"
        />

        {/* Progress ring with gradient */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={`url(#ring-grad-${size})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear', filter: `drop-shadow(0 0 6px ${color}60)` }}
        />

        {/* Sparkle dot at progress tip */}
        {isRunning && progress > 0.01 && (
          <circle
            cx={sparkleX} cy={sparkleY} r="4"
            fill="white" opacity="0.9"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

// ── Background Layer ─────────────────────────────────────────────────────────

function FocusBackground({ bgImage, className }) {
  return (
    <div className={cn("pointer-events-none absolute overflow-hidden", className)}>
      <img
        src={bgImage}
        alt=""
        className="h-full w-full object-cover opacity-25"
      />
    </div>
  )
}

// ── FocusWidget ──────────────────────────────────────────────────────────────

export function FocusWidget({ widget, variant }) {
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const session = useStore((s) => s.session)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
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
  const customPresets = useStore((s) => s.settings?.customPresets || [])

  const [exitAttempts, setExitAttempts] = useState(0)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('timer')

  const [bgImage, setBgImage] = useState(() => {
    const idx = Math.floor(Math.random() * FOCUS_IMAGES.length)
    return FOCUS_IMAGES[idx]
  })

  useEffect(() => {
    const idx = Math.floor(Math.random() * FOCUS_IMAGES.length)
    setBgImage(FOCUS_IMAGES[idx])
  }, [variant, activeModeId])

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

  const updateFocusAudioUrl = async (url, enableVideo = false) => {
    try {
      const patch = enableVideo
        ? { focusAudioUrl: url, focusVideoEnabled: true }
        : { focusAudioUrl: url, focusVideoEnabled: Boolean(url) }
      await updateSettings(user.uid, patch)
    } catch (err) {
      console.error('[focus] failed to save audio URL', err)
    }
  }

  const loadStream = async () => {
    const raw = focusAudioUrl.trim()
    if (!raw) {
      toast.error('Paste a YouTube or audio URL first')
      return
    }
    const id = youtubeId(raw)
    if (id) {
      const canonical = toCanonicalYouTubeUrl(id)
      await updateFocusAudioUrl(canonical, true)
      toast.success('YouTube background saved — plays when focus begins')
    } else if (raw.startsWith('http')) {
      await updateFocusAudioUrl(raw)
      toast.success('Audio URL saved — plays when focus begins')
    } else {
      toast.error('Not a recognised YouTube or audio URL')
    }
  }

  const selectVideoPreset = async (url) => {
    try {
      const canonical = toCanonicalYouTubeUrl(url) || url
      await updateFocusAudioUrl(canonical, true)
      toast.success('Video background set')
    } catch (err) {
      console.error('[focus] failed to set preset', err)
    }
  }

  const isHero = variant === 'hero'
  const phaseTotal =
    phaseTotalSec ||
    (phase === 'focus' ? customTimerSetting.work : customTimerSetting.break) ||
    secondsLeft ||
    1
  const progress = 1 - secondsLeft / phaseTotal
  const color = phase === 'break' ? '#10b981' : session?.color || 'rgb(var(--accent))'
  const isRunning = status === 'running'
  const isIdle = status === 'idle'

  const onMain = () => {
    if (status === 'idle') startFocus()
    else if (status === 'running') pause()
    else resume()
  }

  const subtitle = `${stats?.currentStreak || 0}-day streak · ${stats?.treesGrown || 0} trees`

  const pipHeaderAction = !isIdle ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        enterPip()
      }}
      className="flex items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-semibold text-amber-400 backdrop-blur-md transition-all hover:scale-105 hover:bg-white/20 hover:text-amber-300 active:scale-95"
      title="Picture-in-Picture mode"
    >
      <PictureInPicture2 className="h-3.5 w-3.5" />
      <span>PiP</span>
    </button>
  ) : null

  return (
    <WidgetFrame widget={widget} variant={variant} subtitle={subtitle} headerActions={pipHeaderAction}>
      {/* ── Background layer for compact mode ── */}
      {!isHero && (
        <FocusBackground bgImage={bgImage} className="inset-0 rounded-3xl" />
      )}

      {isHero ? (
        /* ════════════════════════ HERO VARIANT ════════════════════════ */
        <div className="relative z-10 flex h-full flex-col gap-5 lg:flex-row">
          {/* Left: Timer + controls — card within card */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-6 backdrop-blur-sm flex flex-1 flex-col items-center justify-center gap-5 my-3">
            <FocusBackground bgImage={bgImage} className="inset-0 rounded-2xl" />
            
            {/* Inner content wrapper above background */}
            <div className="relative z-10 flex flex-col items-center gap-5 w-full">
              {/* Breathing idle animation wrapper */}
              <motion.div
                animate={isIdle ? { scale: [1, 1.02, 1] } : { scale: 1 }}
                transition={isIdle ? { duration: 3, repeat: Infinity, ease: 'easeInOut' } : {}}
              >
                <Ring progress={progress} color={color} size={220} isRunning={isRunning}>
                  <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
                    {phase === 'break' ? 'Break' : isIdle ? 'Ready' : 'Focus'}
                  </span>
                  <span className="text-5xl font-light tracking-[0.1em] tabular-nums text-white drop-shadow-lg">
                    {mmss(secondsLeft)}
                  </span>
                  {session?.label && (
                    <span className="mt-1 max-w-[160px] truncate text-xs text-white/60">
                      {session.label}
                    </span>
                  )}
                </Ring>
              </motion.div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <motion.button
                  onClick={onMain}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-br from-accent via-accent to-accent-2 px-6 py-3 font-semibold text-white shadow-glow transition-shadow hover:shadow-glow-lg"
                >
                  {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
                  {isIdle ? 'Start' : isRunning ? 'Pause' : 'Resume'}
                </motion.button>
                <button
                  onClick={handleReset}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-black/60 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80 hover:text-white"
                  aria-label="Reset"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                {!isIdle && (
                  <button
                    type="button"
                    onClick={enterPip}
                    className="flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-black/60 px-4 text-xs font-semibold text-amber-400 backdrop-blur-sm transition-all hover:scale-105 hover:border-amber-400/40 hover:bg-black/80 hover:text-amber-300 active:scale-95"
                    title="Float timer in Picture-in-Picture mode"
                  >
                    <PictureInPicture2 className="h-4 w-4" />
                    <span>PiP</span>
                  </button>
                )}
              </div>

            {/* Elegant glassmorphic Tab Switcher */}
            <div className="flex w-full max-w-[300px] rounded-2xl bg-black/40 p-1 border border-white/10 backdrop-blur-md">
              <button
                onClick={() => setActiveTab('timer')}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all",
                  activeTab === 'timer'
                    ? "bg-white/10 text-white border border-white/10 shadow-glow-sm"
                    : "text-white/50 hover:text-white border border-transparent"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Time
              </button>
              <button
                onClick={() => setActiveTab('sounds')}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all",
                  activeTab === 'sounds'
                    ? "bg-white/10 text-white border border-white/10 shadow-glow-sm"
                    : "text-white/50 hover:text-white border border-transparent"
                )}
              >
                <AudioLines className="h-3.5 w-3.5" />
                Audio
              </button>
              <button
                onClick={() => setActiveTab('scenes')}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl transition-all",
                  activeTab === 'scenes'
                    ? "bg-white/10 text-white border border-white/10 shadow-glow-sm"
                    : "text-white/50 hover:text-white border border-transparent"
                )}
              >
                <TreePine className="h-3.5 w-3.5" />
                Scene
              </button>
            </div>

            {/* Dynamic Tab Contents */}
            <div className="w-full flex justify-center min-h-[110px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="w-full flex justify-center"
                >
                  {activeTab === 'timer' && (
                    <div className="flex flex-col items-center gap-3 w-full max-w-[300px]">
                      <div className="flex items-center gap-1 w-full rounded-2xl border border-white/10 bg-black/30 p-1 backdrop-blur-sm">
                        {PRESETS.map((p) => {
                          const active = Math.round(customTimerSetting.work / 60) === p
                          return (
                            <button
                              key={p}
                              disabled={!isIdle}
                              onClick={() => setCustomTimer(p * 60, customTimerSetting.break)}
                              className={cn(
                                'flex-1 rounded-xl py-1.5 text-xs font-semibold transition-all disabled:opacity-50',
                                active
                                  ? 'bg-accent text-white shadow-glow-sm'
                                  : 'text-white/70 hover:text-white',
                              )}
                            >
                              {p}m
                            </button>
                          )
                        })}
                      </div>

                      {/* Custom timer inputs */}
                      <div className="flex items-center justify-between w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                        <span className="text-[11px] font-medium text-white/50">Custom Duration</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min="1" max="120"
                            value={Math.round(customTimerSetting.work / 60)}
                            onChange={(e) => setCustomTimer(Number(e.target.value) * 60, customTimerSetting.break)}
                            disabled={!isIdle}
                            className="w-12 rounded-lg border border-white/20 bg-black/60 px-1.5 py-1 text-center text-xs text-white outline-none backdrop-blur-sm focus:border-accent disabled:opacity-40"
                          />
                          <span className="text-[10px] text-white/40">/</span>
                          <input
                            type="number" min="1" max="60"
                            value={Math.round(customTimerSetting.break / 60)}
                            onChange={(e) => setCustomTimer(customTimerSetting.work, Number(e.target.value) * 60)}
                            disabled={!isIdle}
                            className="w-12 rounded-lg border border-white/20 bg-black/60 px-1.5 py-1 text-center text-xs text-white outline-none backdrop-blur-sm focus:border-accent disabled:opacity-40"
                          />
                          <span className="text-[10px] text-white/40">min</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'sounds' && (
                    <div className="flex flex-col gap-3 w-full max-w-[300px]">
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
                                'group flex h-10 items-center justify-center rounded-xl border transition-all',
                                isActive
                                  ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm ring-1 ring-accent/30'
                                  : 'border-white/20 bg-black/60 text-white/70 hover:text-white hover:bg-black/80 hover:border-white/40',
                              )}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          )
                        })}
                      </div>

                      {/* Volume */}
                      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-1.5">
                        <button
                          onClick={toggleMute}
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors bg-black/60 border-white/20 text-white/70 hover:bg-black/80 hover:text-white/90',
                            muted && 'border-red-500/30 text-red-400'
                          )}
                          title={muted ? 'Unmute' : 'Mute'}
                        >
                          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </button>
                        <input
                          type="range" min="0" max="100"
                          value={Math.round(volume * 100)}
                          onChange={(e) => setVolume(Number(e.target.value) / 100)}
                          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-black/60 accent-accent [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-glow-sm"
                        />
                        <span className="w-8 text-right text-[10px] font-medium tabular-nums text-white/60">
                          {Math.round(volume * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {activeTab === 'scenes' && (
                    <div className="flex flex-col gap-2.5 w-full max-w-[300px]">
                      <div className="grid grid-cols-3 gap-1">
                        {VIDEO_PRESETS.map((p) => {
                          const isSelected =
                            focusAudioUrl === p.url ||
                            (Boolean(focusAudioUrl) && youtubeId(focusAudioUrl) === youtubeId(p.url))
                          return (
                            <button
                              key={p.url}
                              onClick={() => selectVideoPreset(p.url)}
                              className={cn(
                                'truncate rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                                isSelected
                                  ? 'border-accent/50 bg-accent/15 text-accent'
                                  : 'border-white/20 bg-black/60 text-white/70 hover:border-accent/50 hover:text-white hover:bg-black/80',
                              )}
                              title={p.label}
                            >
                              {p.label}
                            </button>
                          )
                        })}
                        {customPresets.map((p, idx) => {
                          const isSelected =
                            focusAudioUrl === p.url ||
                            (Boolean(focusAudioUrl) && youtubeId(focusAudioUrl) === youtubeId(p.url))
                          return (
                            <button
                              key={p.url + idx}
                              onClick={() => selectVideoPreset(p.url)}
                              className={cn(
                                'truncate rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                                isSelected
                                  ? 'border-accent/50 bg-accent/15 text-accent'
                                  : 'border-white/20 bg-black/60 text-white/70 hover:border-accent/50 hover:text-white hover:bg-black/80',
                              )}
                              title={p.label}
                            >
                              {p.label}
                            </button>
                          )
                        })}
                        <button
                          onClick={() => updateFocusAudioUrl('')}
                          className={cn(
                            'truncate rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                            !focusAudioUrl
                              ? 'border-accent/50 bg-accent/15 text-accent'
                              : 'border-white/20 bg-black/60 text-white/70 hover:border-accent/50 hover:text-white hover:bg-black/80',
                          )}
                        >
                          Off
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={focusAudioUrl}
                          onChange={(e) => updateFocusAudioUrl(e.target.value)}
                          placeholder="Custom YouTube URL..."
                          className="w-full flex-1 rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-xs text-white outline-none backdrop-blur-sm placeholder:text-white/40 focus:border-accent"
                        />
                        <button
                          onClick={loadStream}
                          className="shrink-0 rounded-xl border border-white/20 bg-black/60 px-3 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-black/80 hover:text-white"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
            {/* Close Inner content wrapper */}
            </div>
          </div>

          {/* Right: Forest + stats */}
          <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-black/30 to-emerald-950/20 p-4 backdrop-blur-sm my-3">
            {/* Stats row */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              <GlassStat icon={<Flame className="h-4 w-4 text-amber-400" />} label="Streak" value={`${stats?.currentStreak || 0}d`} />
              <GlassStat icon={<Clock className="h-4 w-4 text-sky-400" />} label="Total" value={`${Math.round((stats?.totalFocusMin || 0) / 60)}h`} />
              <GlassStat icon={<TreePine className="h-4 w-4 text-emerald-400" />} label="Trees" value={stats?.treesGrown || 0} />
            </div>

            {/* Forest */}
            <div className="mb-2 flex items-center gap-2">
              <Sprout className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white/70">Your Forest</span>
              <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                {stats?.treesGrown || 0}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3">
              <ForestView count={stats?.treesGrown || 0} />
            </div>
          </div>
        </div>
      ) : (
        /* ════════════════════════ COMPACT / GRID VARIANT ════════════════════════ */
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-4">
          {/* Breathing animation when idle */}
          <motion.div
            animate={isIdle ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={isIdle ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            <Ring progress={progress} color={color} size={120} isRunning={isRunning}>
              <span className="text-2xl font-light tracking-[0.1em] tabular-nums text-white drop-shadow-lg">
                {mmss(secondsLeft)}
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
                {phase === 'break' ? 'Break' : isIdle ? 'Ready' : 'Focus'}
              </span>
            </Ring>
          </motion.div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <motion.button
              onClick={onMain}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-white shadow-glow"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
              {isIdle ? 'Start' : isRunning ? 'Pause' : 'Resume'}
            </motion.button>
            <button
              onClick={handleReset}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Reset"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {!isIdle && (
              <button
                type="button"
                onClick={enterPip}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-amber-400 transition-colors hover:bg-white/10 hover:text-amber-300"
                title="Float in Picture-in-Picture mode"
                aria-label="Picture-in-Picture"
              >
                <PictureInPicture2 className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Mini stat strip */}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
            <span className="flex items-center gap-1 text-xs text-white/60">
              <Flame className="h-3 w-3 text-amber-400" />
              {stats?.currentStreak || 0}d
            </span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1 text-xs text-white/60">
              <TreePine className="h-3 w-3 text-emerald-400" />
              {stats?.treesGrown || 0} trees
            </span>
          </div>
        </div>
      )}

      {/* Exit confirm dialog */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="edge-light max-w-sm rounded-3xl border border-red-500/30 bg-surface p-6 text-center shadow-glass-lg"
            style={{ animation: 'pulse 2s ease-in-out infinite', borderColor: 'rgba(239,68,68,0.3)' }}
          >
            <motion.span
              animate={{ rotate: [-5, 5, -5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-amber-500"
            >
              <TreePine className="h-8 w-8" />
            </motion.span>
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
          </motion.div>
        </div>
      )}
    </WidgetFrame>
  )
}

function GlassStat({ icon, label, value }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 py-2.5 backdrop-blur-sm">
      <span>{icon}</span>
      <span className="font-display text-lg font-semibold leading-none tracking-tight text-white">{value}</span>
      <span className="text-[10px] text-white/40">{label}</span>
    </div>
  )
}
