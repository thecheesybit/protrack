import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  Pause,
  Plus,
  Minus,
  Volume2,
  VolumeX,
  Volume1,
  Music2,
  TreePine,
  Sunrise,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { useYouTubeVolume } from '@/hooks/useYouTubeVolume'
import { bandForHour, CHRONO_ACCENT } from '@/hooks/useChronoTheme'
import { logFailedFocusSession } from '@/services/focusService'
import { addLedgerEntry } from '@/services/ledgerService'
import { updateSettings } from '@/services/userService'
import { VIDEO_PRESETS } from '@/lib/focusScenes'
import { withAlpha } from '@/lib/color'
import { cn } from '@/utils/cn'

/**
 * Full-viewport Deep Focus lock screen. A premium, distraction-free panel over
 * a curated YouTube scene (or a gradient fallback). The app's volume + mute now
 * drive the background video via the IFrame API; time can be added/removed live.
 */

const YT_PATTERN =
  /(?:youtube\.fr\/|youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i

const BAND_META = {
  dawn: { Icon: Sunrise, label: 'Dawn' },
  day: { Icon: Sun, label: 'Daytime' },
  dusk: { Icon: Sunset, label: 'Evening' },
  night: { Icon: Moon, label: 'Night' },
}

function mmss(sec) {
  const s = Math.max(0, sec)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Ring({ progress, color, size = 300, children }) {
  const stroke = 8
  const r = (size - stroke * 2) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{
            transition: 'stroke-dashoffset 1s linear',
            filter: `drop-shadow(0 0 8px ${withAlpha(color, 0.6)})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}

function TimePill({ label, onClick, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur-md transition-all hover:border-white/30 hover:bg-white/10 hover:text-white active:scale-95"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  )
}

export function FocusLockScreen() {
  const { user } = useAuth()
  const focusLocked = useStore((s) => s.focusLocked)
  const status = useStore((s) => s.status)
  const phase = useStore((s) => s.phase)
  const session = useStore((s) => s.session)
  const secondsLeft = useStore((s) => s.secondsLeft)
  const phaseTotalSec = useStore((s) => s.phaseTotalSec)
  const volume = useStore((s) => s.volume)
  const muted = useStore((s) => s.muted)
  const activeModeId = useStore((s) => s.activeModeId)

  const pause = useStore((s) => s.pause)
  const resume = useStore((s) => s.resume)
  const reset = useStore((s) => s.reset)
  const adjustSeconds = useStore((s) => s.adjustSeconds)
  const setVolume = useStore((s) => s.adjustTrackVolume)
  const toggleMute = useStore((s) => s.toggleMute)

  const focusAudioUrl = useStore((s) => s.settings?.focusAudioUrl || '')
  const focusVideoEnabled = useStore((s) => s.settings?.focusVideoEnabled !== false)
  const customPresets = useStore((s) => s.settings?.customPresets || [])

  const [confirmQuit, setConfirmQuit] = useState(false)
  const [showScenes, setShowScenes] = useState(false)

  const iframeRef = useRef(null)
  const onIframeLoad = useYouTubeVolume(iframeRef, volume, muted)

  const ytMatch = focusAudioUrl.match(YT_PATTERN)
  const videoId = ytMatch?.[1]
  const showVideo = Boolean(focusVideoEnabled && videoId)

  const band = bandForHour(new Date().getHours())
  const { Icon: BandIcon, label: bandLabel } = BAND_META[band] || BAND_META.night

  const isBreak = phase === 'break'
  const accentHex = isBreak ? '#10b981' : session?.color || CHRONO_ACCENT[band]?.hex || '#6366f1'

  const total = phaseTotalSec || secondsLeft || 1
  const progress = Math.min(1, Math.max(0, 1 - secondsLeft / total))

  // NOTE: mute is intentionally NOT in the URL — toggling it would reload the
  // iframe and restart the video. Mute/volume are driven via the IFrame API
  // (useYouTubeVolume) so the scene plays continuously.
  //
  // Do NOT add `&origin=` here. The packaged app loads over file://, so
  // window.location.origin is "file://" — YouTube's enablejsapi origin check
  // then rejects that opaque origin and the player never starts (black screen).
  // postMessage volume control still works without it (see useYouTubeVolume).
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&rel=0&showinfo=0&modestbranding=1&enablejsapi=1`
    : ''

  const onMain = () => (status === 'running' ? pause() : resume())

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  // Live ambient-scene picker — available right here in the lock screen so the
  // user can start/change the background music or scene without leaving Deep
  // Focus. Writes settings; the iframe above reacts to focusAudioUrl.
  const allScenes = [...VIDEO_PRESETS, ...customPresets]
  const activeScene = allScenes.find((p) => p.url === focusAudioUrl)
  const activeSceneLabel = activeScene?.label || (focusAudioUrl ? 'Custom scene' : 'No music')

  const applyScene = async (url) => {
    if (!user?.uid) return
    try {
      await updateSettings(
        user.uid,
        url ? { focusAudioUrl: url, focusVideoEnabled: true } : { focusAudioUrl: '' },
      )
    } catch (err) {
      console.error('[focus] scene change failed', err)
    }
  }

  const giveUp = async () => {
    const st = useStore.getState()
    try {
      if (user?.uid) {
        await logFailedFocusSession(user.uid, {
          modeId: st.session?.modeId || activeModeId,
          subjectId: st.session?.subjectId || null,
          startedAt: st.startedAt ? new Date(st.startedAt) : new Date(),
        })
        await addLedgerEntry(user.uid, {
          kind: 'focus',
          title: 'Focus session abandoned',
          detail: 'The plant did not survive',
          modeId: st.session?.modeId || activeModeId,
        })
      }
    } catch (err) {
      console.error('[focus] give-up log failed', err)
    }
    reset()
    window.protrack?.window?.setFullScreen?.(false)
    useStore.getState().pushIsland({
      kind: 'error',
      title: 'Session ended',
      detail: 'The plant withered.',
      duration: 4000,
    })
    setConfirmQuit(false)
  }

  return (
    <AnimatePresence>
      {focusLocked && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[45] flex items-center justify-center overflow-hidden"
        >
          {/* ── Background ─────────────────────────────────────────── */}
          {showVideo ? (
            <>
              <div className="absolute inset-0 overflow-hidden">
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  onLoad={onIframeLoad}
                  allow="autoplay; fullscreen"
                  title="Focus Background"
                  style={{
                    border: 0,
                    pointerEvents: 'none',
                    position: 'absolute',
                    width: '177.78vh',
                    height: '56.25vw',
                    minWidth: '100%',
                    minHeight: '100%',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
              {/* Cinematic vignette + dim so the panel stays readable */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80" />
              <div
                className="absolute inset-0"
                style={{ boxShadow: `inset 0 0 320px 60px ${withAlpha(accentHex, 0.18)}` }}
              />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at 50% 35%, ${withAlpha(accentHex, 0.16)} 0%, rgba(0,0,0,0.94) 70%)`,
                }}
              />
              <div className="absolute inset-0 backdrop-blur-3xl" />
              <div className="absolute inset-0 opacity-[0.03] bg-grid" />
            </>
          )}

          {/* ── Foreground panel ───────────────────────────────────── */}
          <motion.div
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 16, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 flex w-full max-w-md flex-col items-center gap-7 rounded-[2rem] border border-white/10 bg-black/40 px-8 py-10 shadow-glass-lg backdrop-blur-2xl"
          >
            {/* Header: time-of-day + phase */}
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white/70">
                <BandIcon className="h-3.5 w-3.5" style={{ color: accentHex }} />
                {bandLabel}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: accentHex, background: withAlpha(accentHex, 0.12) }}
              >
                {isBreak ? 'Break' : 'Deep Focus'}
              </span>
            </div>

            {/* Ring timer */}
            <Ring progress={progress} color={accentHex} size={288}>
              <span className="text-6xl font-bold tabular-nums tracking-tight text-white">
                {mmss(secondsLeft)}
              </span>
              {session?.label && (
                <span className="mt-2 max-w-[200px] truncate text-sm text-white/60">
                  {session.label}
                </span>
              )}
            </Ring>

            {/* Time adjust */}
            <div className="flex items-center gap-2">
              <TimePill label="5 min" icon={Minus} onClick={() => adjustSeconds(-5 * 60)} />
              <TimePill label="1 min" icon={Minus} onClick={() => adjustSeconds(-60)} />
              <TimePill label="1 min" icon={Plus} onClick={() => adjustSeconds(60)} />
              <TimePill label="5 min" icon={Plus} onClick={() => adjustSeconds(5 * 60)} />
            </div>

            {/* Main controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={onMain}
                className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{ background: accentHex, boxShadow: `0 8px 30px ${withAlpha(accentHex, 0.5)}` }}
                aria-label={status === 'running' ? 'Pause' : 'Resume'}
              >
                {status === 'running' ? (
                  <Pause className="h-7 w-7 fill-white" />
                ) : (
                  <Play className="h-7 w-7 fill-white" />
                )}
              </button>
            </div>

            {/* Volume — now drives the video scene too */}
            <div className="flex w-full items-center gap-3">
              <button
                onClick={toggleMute}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors',
                  muted
                    ? 'border-rose-400/40 bg-rose-500/10 text-rose-300'
                    : 'border-white/15 bg-white/5 text-white/70 hover:text-white',
                )}
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                <VolIcon className="h-4 w-4" />
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={muted ? 0 : Math.round(volume * 100)}
                onChange={(e) => {
                  const v = Number(e.target.value) / 100
                  setVolume(v)
                  if (muted && v > 0) toggleMute()
                }}
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                style={{ accentColor: accentHex }}
                aria-label="Volume"
              />
              <span className="w-9 text-right text-[11px] tabular-nums text-white/50">
                {muted ? 'Off' : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            {/* Scene / music picker — start or change the ambient background live */}
            <div className="w-full">
              <button
                onClick={() => setShowScenes((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-white/80 backdrop-blur-md transition-colors hover:border-white/30 hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <Music2 className="h-4 w-4" />
                  {activeSceneLabel}
                </span>
                <span className="text-[11px] font-medium text-white/40">
                  {showScenes ? 'Hide' : 'Music'}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {showScenes && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {allScenes.map((p) => (
                        <button
                          key={p.url}
                          onClick={() => applyScene(p.url)}
                          title={p.label}
                          className={cn(
                            'truncate rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                            focusAudioUrl === p.url
                              ? 'border-white/60 bg-white/15 text-white'
                              : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40 hover:text-white',
                          )}
                        >
                          {p.label}
                        </button>
                      ))}
                      <button
                        onClick={() => applyScene('')}
                        className={cn(
                          'truncate rounded-lg border px-2 py-1.5 text-[10px] transition-colors',
                          !focusAudioUrl
                            ? 'border-white/60 bg-white/15 text-white'
                            : 'border-white/15 bg-white/5 text-white/70 hover:border-white/40 hover:text-white',
                        )}
                      >
                        Off
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Give up */}
            <button
              onClick={() => setConfirmQuit(true)}
              className="text-xs font-medium text-white/40 transition-colors hover:text-rose-300"
            >
              Give up session
            </button>
          </motion.div>

          {/* ── Give-up confirmation ───────────────────────────────── */}
          <AnimatePresence>
            {confirmQuit && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-md"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 12 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 12 }}
                  className="max-w-sm rounded-3xl border border-white/10 bg-surface/95 p-6 text-center shadow-glass-lg"
                >
                  <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                    <TreePine className="h-6 w-6 animate-pulse" />
                  </span>
                  <h3 className="mb-2 text-lg font-bold text-ink">Abandon this session?</h3>
                  <p className="mb-5 text-sm text-muted">
                    Your growing plant will wither if you leave now. Stay a little longer?
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmQuit(false)}
                      className="flex-1 rounded-2xl py-2.5 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
                      style={{ background: accentHex }}
                    >
                      Keep going
                    </button>
                    <button
                      onClick={giveUp}
                      className="rounded-2xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink"
                    >
                      Quit anyway
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
