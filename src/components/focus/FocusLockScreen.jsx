import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/store/useStore'
import { FocusWidget } from '@/components/widgets/FocusWidget'
import { cn } from '@/utils/cn'

/**
 * Full-viewport lockout overlay during Deep Focus sessions.
 *
 * When a YouTube URL is configured in settings and `focusVideoEnabled` is true,
 * the video is rendered as a fullscreen cover-fill background with the timer +
 * controls displayed on a frosted-glass panel above it.
 *
 * Without a video URL (or when disabled), the original dark radial-gradient +
 * frosted-blur treatment is used.
 */

const YT_PATTERN =
  /(?:youtube\.fr\/|youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i

export function FocusLockScreen() {
  const focusLocked = useStore((s) => s.focusLocked)
  const phase = useStore((s) => s.phase)
  const session = useStore((s) => s.session)
  const focusAudioUrl = useStore((s) => s.settings?.focusAudioUrl || '')
  // Default true — if the user has a URL set, show the video unless they
  // explicitly turned it off (focusVideoEnabled === false).
  const focusVideoEnabled = useStore((s) => s.settings?.focusVideoEnabled !== false)

  const ytMatch = focusAudioUrl.match(YT_PATTERN)
  const videoId = ytMatch?.[1]
  const showVideo = Boolean(focusVideoEnabled && videoId)

  // autoplay=1, loop=1, controls=0 → seamless ambient playback
  const embedUrl = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&rel=0&showinfo=0&enablejsapi=1`
    : ''

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
          {showVideo ? (
            <>
              {/* ── Video background ─────────────────────────────────── */}
              {/* Cover-fill: make the iframe larger than the viewport and
                  center it so it always covers the whole screen regardless
                  of aspect ratio. Pointer events off so it can't steal focus. */}
              <div className="absolute inset-0 overflow-hidden">
                <iframe
                  src={embedUrl}
                  allow="autoplay; fullscreen"
                  title="Focus Background"
                  style={{
                    border: 0,
                    pointerEvents: 'none',
                    position: 'absolute',
                    /* 16:9 cover fill */
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
              {/* Dim overlay so the timer panel stays readable */}
              <div className="absolute inset-0 bg-black/55" />
            </>
          ) : (
            <>
              {/* ── Original gradient background ─────────────────────── */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    phase === 'break'
                      ? 'radial-gradient(ellipse at center, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0.92) 70%)'
                      : session?.color
                        ? `radial-gradient(ellipse at center, ${session.color}12 0%, rgba(0,0,0,0.92) 70%)`
                        : 'radial-gradient(ellipse at center, rgba(99,102,241,0.08) 0%, rgba(0,0,0,0.92) 70%)',
                }}
              />
              <div className="absolute inset-0 backdrop-blur-3xl" />
              <div className="absolute inset-0 opacity-[0.03] bg-grid" />
            </>
          )}

          {/* ── Focus widget ──────────────────────────────────────────── */}
          {/* Plain wrapper without video; frosted-glass panel when video is on */}
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'relative z-10 w-full max-w-4xl px-6',
              showVideo &&
                'rounded-3xl bg-black/60 p-8 shadow-glass-lg backdrop-blur-2xl',
            )}
          >
            <FocusWidget
              widget={{ id: 'focus', icon: 'Timer', label: 'Focus' }}
              variant="hero"
            />
          </motion.div>

          {/* Phase indicator glow ring (no-video only) */}
          {!showVideo && (
            <div
              className="pointer-events-none absolute inset-0 transition-opacity duration-1000"
              style={{
                boxShadow:
                  phase === 'break'
                    ? 'inset 0 0 200px 80px rgba(16,185,129,0.04)'
                    : `inset 0 0 200px 80px ${session?.color || 'rgba(99,102,241,0.04)'}08`,
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
