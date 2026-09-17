import { useState, useEffect, useMemo, memo } from 'react'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw, Flame, Clock, TreePine, Sprout, PictureInPicture2, Maximize2, Flower2, Trophy } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { WidgetFrame } from './WidgetFrame'
import { MonthlyForest } from '@/components/focus/MonthlyForest'
import { FocusSetup } from '@/components/focus/FocusSetup'
import { SpriteTree, SpriteFoliage, formatFloraBreakdown } from '@/components/focus/ForestSprites'
import { useFocusSessions } from '@/hooks/useFocusSessions'
import { cn } from '@/utils/cn'
import { useAuth } from '@/hooks/useAuth'
import { formatFocusClock as mmss } from '@/lib/focusClock'
import { updateSettings } from '@/services/userService'
import { logFailedFocusSession } from '@/services/focusService'
import { addLedgerEntry } from '@/services/ledgerService'
import { youtubeId, toCanonicalYouTubeUrl } from '@/lib/focusScenes'
import { enterPip } from '@/lib/pip'

import f1 from '@/assets/f1.jpg'
import f2 from '@/assets/f2.jpg'
import f3 from '@/assets/f3.jpg'
import f4 from '@/assets/f4.jpg'
import f5 from '@/assets/f5.jpg'

const FOCUS_IMAGES = [f1, f2, f3, f4, f5]

const MOTIVATION_LINES = [
  'Press start — a tree takes root the moment you begin.',
  'One session, one tree. Your forest is waiting.',
  'Stay till the timer ends and this sapling grows tall.',
  'Every focused minute is a ring in the trunk.',
  'Plant something today your future self will walk through.',
]


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

// ── FocusTimerLeaf ───────────────────────────────────────────────────────────
// Isolated leaf component subscribing to 1s tick (secondsLeft).
// Prevents the rest of the 600+ line FocusWidget from re-rendering every second.
const FocusTimerLeaf = memo(function FocusTimerLeaf({
  isHero = false,
  size = 220,
  color,
  isRunning,
  isIdle,
  phase,
  sessionLabel,
}) {
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
  const customTimerSetting = useStore((s) => s.customTimerSetting)

  const phaseTotal =
    phaseTotalSec ||
    (phase === 'focus' ? customTimerSetting?.work : customTimerSetting?.break) ||
    secondsLeft ||
    1
  const progress = 1 - (secondsLeft || 0) / phaseTotal

  return (
    <Ring progress={progress} color={color} size={size} isRunning={isRunning}>
      {isHero ? (
        <>
          <span className="text-[11px] uppercase tracking-[0.25em] text-muted">
            {phase === 'break' ? 'Break' : isIdle ? 'Ready' : 'Focus'}
          </span>
          <span className="text-5xl font-light tracking-[0.1em] tabular-nums text-white drop-shadow-lg">
            {mmss(secondsLeft || 0)}
          </span>
          {sessionLabel && (
            <span className="mt-1 max-w-[160px] truncate text-xs text-white/60">
              {sessionLabel}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-2xl font-light tracking-[0.1em] tabular-nums text-white drop-shadow-lg">
            {mmss(secondsLeft || 0)}
          </span>
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/50">
            {phase === 'break' ? 'Break' : isIdle ? 'Ready' : 'Focus'}
          </span>
        </>
      )}
    </Ring>
  )
})

// ── ExitConfirmDialog ─────────────────────────────────────────────────────────
const ExitConfirmDialog = memo(function ExitConfirmDialog({
  exitAttempts,
  onCancel,
  onReset,
  onComplete,
}) {
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
  const elapsedSec = Math.max(0, (phaseTotalSec || 0) - (secondsLeft || 0))
  const elapsedMin = Math.max(0, Math.floor(elapsedSec / 60))
  const earlyPlantType = elapsedMin < 10 ? 'flower' : elapsedMin <= 15 ? 'shrub' : 'tree'

  return (
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
          className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"
        >
          <SpriteFoliage
            type={earlyPlantType}
            height={earlyPlantType === 'flower' ? 38 : earlyPlantType === 'shrub' ? 44 : 50}
          />
        </motion.span>
        <h3 className="mb-2 text-lg font-bold text-ink">
          {elapsedMin >= 1
            ? `A ${earlyPlantType} is growing!`
            : 'A plant takes root!'}
        </h3>
        <p className="mb-5 text-sm text-muted">
          {elapsedMin >= 1
            ? `You've focused for ${elapsedMin} min! You can finish now to plant a ${earlyPlantType} on today's calendar, or keep going.`
            : 'Urging you to stay! If you abandon this deep focus session, your plant will die.'}
        </p>
        {elapsedMin < 1 && (
          <div className="mb-4 text-xs font-semibold text-amber-500">
            Attempt {exitAttempts} of 2 warning pushes.
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {elapsedMin >= 1 && (
            <button
              onClick={() => onComplete(elapsedSec)}
              className="w-full rounded-2xl py-2.5 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95 shadow-md bg-emerald-600 hover:bg-emerald-500"
            >
              Finish &amp; Plant ({elapsedMin}m {earlyPlantType})
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 rounded-2xl bg-accent py-2.5 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
            >
              Keep Focus
            </button>
            <button
              onClick={onReset}
              className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-rose-400"
            >
              Abandon
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
})

// ── FocusWidget ──────────────────────────────────────────────────────────────

export function FocusWidget({ widget, variant }) {
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const session = useStore((s) => s.session)
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
  const completeFocus = useStore((s) => s.completeFocus)
  const setVolume = useStore((s) => s.adjustTrackVolume)
  const toggleMute = useStore((s) => s.toggleMute)

  const { user } = useAuth()
  const activeModeId = useStore((s) => s.activeModeId)
  const focusAudioUrl = useStore((s) => s.settings?.focusAudioUrl || '')
  const customPresets = useStore((s) => s.settings?.customPresets || [])
  const timerPresets = useStore((s) => s.settings?.timerPresets || [])
  const { sessions } = useFocusSessions()

  const [exitAttempts, setExitAttempts] = useState(0)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('timer')
  const [motivation] = useState(
    () => MOTIVATION_LINES[Math.floor(Math.random() * MOTIVATION_LINES.length)],
  )

  const floraSummary = useMemo(() => {
    return formatFloraBreakdown(sessions)
  }, [sessions])

  const floraCounts = useMemo(() => {
    let trees = 0
    let shrubs = 0
    let flowers = 0
    for (const s of sessions || []) {
      if (s.completed === false || s.failedReason || (s.durationMin !== undefined && s.durationMin <= 0)) continue
      const dur = Number(s.durationMin) || 25
      const plantType = s.plantType || (dur < 10 ? 'flower' : dur <= 15 ? 'shrub' : 'tree')
      if (plantType === 'flower') flowers++
      else if (plantType === 'shrub') shrubs++
      else trees++
    }
    const total = trees + shrubs + flowers
    return { trees, shrubs, flowers, total }
  }, [sessions])

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

  // ── Timer helpers ──────────────────────────────────────────────────────────
  const workMin = Math.round(customTimerSetting.work / 60)
  const breakMin = Math.round(customTimerSetting.break / 60)
  const setWork = (m) => setCustomTimer(Math.max(1, Math.min(240, m)) * 60, customTimerSetting.break)
  const setBreak = (m) => setCustomTimer(customTimerSetting.work, Math.max(0, Math.min(60, m)) * 60)

  const saveTimerPreset = async () => {
    if (timerPresets.some((p) => p.work === workMin && p.break === breakMin)) {
      toast('That timer is already saved')
      return
    }
    try {
      await updateSettings(user.uid, {
        timerPresets: [...timerPresets, { work: workMin, break: breakMin }].slice(-8),
      })
      toast.success(`Saved ${workMin}m focus · ${breakMin}m break`)
    } catch (err) {
      console.error('[focus] failed to save timer preset', err)
      toast.error('Could not save preset')
    }
  }
  const removeTimerPreset = async (idx) => {
    try {
      await updateSettings(user.uid, { timerPresets: timerPresets.filter((_, i) => i !== idx) })
    } catch (err) {
      console.error('[focus] failed to remove timer preset', err)
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
  const color = phase === 'break' ? '#10b981' : session?.color || 'rgb(var(--accent))'
  const isRunning = status === 'running'
  const isIdle = status === 'idle'

  const onMain = () => {
    if (status === 'idle') startFocus()
    else if (status === 'running') pause()
    else resume()
  }

  const subtitle = `${stats?.currentStreak || 0}-day streak · ${floraSummary}`

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
                <FocusTimerLeaf
                  isHero
                  size={220}
                  color={color}
                  isRunning={isRunning}
                  isIdle={isIdle}
                  phase={phase}
                  sessionLabel={session?.label}
                />
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

            {/* Idle: a sapling waiting to be planted + a nudge to begin */}
            {isIdle && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex w-full max-w-[300px] items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-2"
              >
                <SpriteTree species="pine" variant={2} height={44} />
                <span className="text-[11px] leading-snug text-emerald-200/80">{motivation}</span>
              </motion.div>
            )}

            <FocusSetup
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isIdle={isIdle}
              workMin={workMin}
              breakMin={breakMin}
              setWork={setWork}
              setBreak={setBreak}
              setCustomTimer={setCustomTimer}
              timerPresets={timerPresets}
              saveTimerPreset={saveTimerPreset}
              removeTimerPreset={removeTimerPreset}
              audioTracks={audioTracks}
              toggleConcurrentTrack={toggleConcurrentTrack}
              volume={volume}
              setVolume={setVolume}
              muted={muted}
              toggleMute={toggleMute}
              focusAudioUrl={focusAudioUrl}
              updateFocusAudioUrl={updateFocusAudioUrl}
              loadStream={loadStream}
              selectVideoPreset={selectVideoPreset}
              customPresets={customPresets}
            />
            {/* Close Inner content wrapper */}
            </div>
          </div>

          {/* Right: Forest + stats */}
          <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-black/30 to-emerald-950/20 p-4 backdrop-blur-sm my-3">
            {/* Stats row */}
            <div className="mb-4 grid grid-cols-3 gap-2">
              <GlassStat
                icon={<Flame className="h-3.5 w-3.5" />}
                label="Streak"
                value={`${stats?.currentStreak || 0}d`}
                tooltip={`${stats?.currentStreak || 0}-day consecutive streak`}
                colorScheme="amber"
              />
              <GlassStat
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Total"
                value={`${Math.round((stats?.totalFocusMin || 0) / 60)}h`}
                tooltip={`${stats?.totalFocusMin || 0} total focus minutes`}
                colorScheme="sky"
              />
              <GlassStat
                icon={<TreePine className="h-3.5 w-3.5" />}
                label="Forest"
                value={floraCounts.total}
                subValue={
                  <div className="flex items-center gap-1 text-[10px] font-medium text-white/70">
                    <span className="flex items-center text-emerald-300" title={`${floraCounts.trees} trees`}>
                      <TreePine className="h-2.5 w-2.5 mr-0.5" />{floraCounts.trees}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="flex items-center text-teal-300" title={`${floraCounts.shrubs} shrubs`}>
                      <Sprout className="h-2.5 w-2.5 mr-0.5" />{floraCounts.shrubs}
                    </span>
                    <span className="text-white/20">·</span>
                    <span className="flex items-center text-rose-300" title={`${floraCounts.flowers} flowers`}>
                      <Flower2 className="h-2.5 w-2.5 mr-0.5" />{floraCounts.flowers}
                    </span>
                  </div>
                }
                tooltip={`${floraCounts.total} total flora (${floraCounts.trees} trees, ${floraCounts.shrubs} shrubs, ${floraCounts.flowers} flowers)`}
                colorScheme="emerald"
              />
            </div>

            {/* This month's forest — one tree per completed session. */}
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sprout className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white/70">Your Forest</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('protrack:open-zen', { detail: { tab: 'leaderboard' } }))}
                  className="flex items-center gap-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 transition-all hover:border-amber-500/40 hover:bg-amber-500/20 active:scale-95"
                  title="See the public focus leaderboard"
                >
                  <Trophy className="h-3 w-3" />
                  <span>Leaderboard</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('protrack:open-zen', { detail: { tab: 'forest' } }))}
                  className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/20 active:scale-95"
                  title="Open full-screen Sanctuary mode (Ctrl+F) — Drag to rotate 360°"
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>Sanctuary</span>
                </button>
              </div>
            </div>
            <div
              className="flex-1 flex flex-col min-h-0 cursor-pointer"
              onDoubleClick={() => window.dispatchEvent(new CustomEvent('protrack:open-zen', { detail: { tab: 'forest' } }))}
              title="Double-click to open full-screen Sanctuary mode (Ctrl+F)"
            >
              <MonthlyForest sessions={sessions} currentStreak={stats?.currentStreak || 0} />
            </div>
          </div>
        </div>
      ) : (
        /* ════════════════════════ COMPACT / GRID VARIANT ════════════════════════ */
        <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto py-2">
         <div className="m-auto flex w-full flex-col items-center gap-3.5">
          {/* Breathing animation when idle */}
          <motion.div
            animate={isIdle ? { scale: [1, 1.03, 1] } : { scale: 1 }}
            transition={isIdle ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            <FocusTimerLeaf
              isHero={false}
              size={120}
              color={color}
              isRunning={isRunning}
              isIdle={isIdle}
              phase={phase}
            />
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

          {/* Idle: a little nudge to plant today's tree */}
          {isIdle && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-1.5">
              <SpriteTree species="pine" variant={2} height={26} />
              <span className="max-w-[190px] text-[10px] leading-snug text-emerald-200/75">
                {motivation}
              </span>
            </div>
          )}

          {/* Same Time / Audio / Scene customization as full-screen */}
          <div className="w-full max-w-[300px]">
            <FocusSetup
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isIdle={isIdle}
              workMin={workMin}
              breakMin={breakMin}
              setWork={setWork}
              setBreak={setBreak}
              setCustomTimer={setCustomTimer}
              timerPresets={timerPresets}
              saveTimerPreset={saveTimerPreset}
              removeTimerPreset={removeTimerPreset}
              audioTracks={audioTracks}
              toggleConcurrentTrack={toggleConcurrentTrack}
              volume={volume}
              setVolume={setVolume}
              muted={muted}
              toggleMute={toggleMute}
              focusAudioUrl={focusAudioUrl}
              updateFocusAudioUrl={updateFocusAudioUrl}
              loadStream={loadStream}
              selectVideoPreset={selectVideoPreset}
              customPresets={customPresets}
              maxWidth={300}
            />
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
              {floraSummary}
            </span>
          </div>
         </div>
        </div>
      )}

      {/* Exit confirm dialog */}
      {showExitConfirm && (
        <ExitConfirmDialog
          exitAttempts={exitAttempts}
          onCancel={() => setShowExitConfirm(false)}
          onReset={handleReset}
          onComplete={(elapsed) => {
            setShowExitConfirm(false)
            setExitAttempts(0)
            completeFocus?.(elapsed)
          }}
        />
      )}
    </WidgetFrame>
  )
}

function GlassStat({ icon, label, value, subValue, tooltip, colorScheme = 'emerald' }) {
  const accentGlow =
    colorScheme === 'amber'
      ? 'from-amber-500/10 via-amber-500/[0.03] to-transparent'
      : colorScheme === 'sky'
      ? 'from-sky-500/10 via-sky-500/[0.03] to-transparent'
      : 'from-emerald-500/10 via-emerald-500/[0.03] to-transparent'

  const iconBg =
    colorScheme === 'amber'
      ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
      : colorScheme === 'sky'
      ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'

  return (
    <div
      title={tooltip}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b ${accentGlow} p-2.5 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.06] shadow-sm`}
    >
      <div className="flex items-center justify-between w-full mb-1">
        <div className={`flex h-6 w-6 items-center justify-center rounded-lg border ${iconBg} shadow-xs`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold tracking-wider uppercase text-white/45">{label}</span>
      </div>

      <div className="flex items-baseline justify-between gap-1">
        <span className="text-xl font-bold tracking-tight text-white/95 font-mono">{value}</span>
        {subValue && <div className="ml-auto">{subValue}</div>}
      </div>
    </div>
  )
}
