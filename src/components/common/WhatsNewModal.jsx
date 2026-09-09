import { useEffect, useMemo, useState, useRef } from 'react'
import { Sparkles, Check, RotateCcw } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/store/useStore'
import { APP_VERSION } from '@/lib/version'
import { CHANGELOG } from '@/content/changelog'
import whatsNewVideo from '@/assets/video-pack/whats-new.mp4'

const SEEN_KEY = 'protrack:lastSeenVersion'
const MAX_POINTS = 7
const THANKS =
  "Thanks for keeping PRO TRACK part of your day — every release is shaped by people who keep showing up."

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY)
  } catch {
    return null
  }
}

function writeSeen(v) {
  try {
    localStorage.setItem(SEEN_KEY, v)
  } catch {
    /* private mode */
  }
}

/** Light markdown → plain text for a one-line bullet (bold, code, links). */
function stripMd(s) {
  return String(s)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,2}(?=\S)(.+?)(?<=\S)[*_]{1,2}/g, '$1')
    .trim()
}

/**
 * What's New pop-up.
 * Triggered automatically on restart / first-launch after an update (or re-launched from Settings > Updates).
 * Plays the optimized, silent what's new video without controls in a focused container.
 * When the video ends (or on skip), reveals the key update points with thank-you note before returning to normal business.
 */
export function WhatsNewModal() {
  const open = useStore((s) => s.whatsNewOpen)
  const setOpen = useStore((s) => s.setWhatsNewOpen)
  const [stage, setStage] = useState('video') // 'video' | 'summary'
  const [progress, setProgress] = useState(0)
  const videoRef = useRef(null)

  // Notes for the running build
  const entry = useMemo(() => {
    const list = Array.isArray(CHANGELOG) ? CHANGELOG : []
    return list.find((e) => e.version === APP_VERSION) || list[0] || null
  }, [])

  const points = useMemo(
    () => (entry?.highlights || []).map(stripMd).filter(Boolean).slice(0, MAX_POINTS),
    [entry],
  )
  const extra = Math.max(0, (entry?.highlights?.length || 0) - points.length)

  // Auto-launch on first run after update
  useEffect(() => {
    const seen = readSeen()
    if (!seen) {
      writeSeen(APP_VERSION)
      return
    }
    if (seen !== APP_VERSION && points.length > 0) {
      setOpen(true)
    }
  }, [points.length, setOpen])

  // Reset stage and video playback when opened
  useEffect(() => {
    if (open) {
      setStage('video')
      setProgress(0)
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play().catch(() => {})
      }
    }
  }, [open])

  const dismiss = () => {
    writeSeen(APP_VERSION)
    setOpen(false)
  }

  const handleReplay = () => {
    setStage('video')
    setProgress(0)
    if (videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }

  const handleTimeUpdate = (e) => {
    const el = e.currentTarget
    if (el && el.duration) {
      setProgress((el.currentTime / el.duration) * 100)
    }
  }

  const handleVideoEnded = () => {
    setStage('summary')
  }

  return (
    <Modal
      open={open}
      onClose={dismiss}
      className="max-w-2xl"
      title={
        <span className="flex items-center gap-2 font-display">
          <Sparkles className="h-4 w-4 text-accent" />
          {stage === 'video'
            ? `What's New in PRO TRACK v${APP_VERSION}`
            : `PRO TRACK v${APP_VERSION} Release Highlights`}
        </span>
      }
      headerExtra={
        stage === 'video' ? (
          <button
            type="button"
            onClick={() => setStage('summary')}
            className="text-xs font-semibold text-muted hover:text-ink px-2.5 py-1 rounded-xl hover:bg-surface-2 transition-colors mr-1"
          >
            Skip to highlights →
          </button>
        ) : null
      }
    >
      {stage === 'video' ? (
        <div className="space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black/80 shadow-2xl">
            <video
              ref={videoRef}
              src={whatsNewVideo}
              autoPlay
              muted
              playsInline
              controls={false}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              className="h-full w-full object-cover"
            />
            {/* Subtle bottom progress bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/15 backdrop-blur-sm">
              <div
                className="h-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-150 shadow-glow-sm"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-1 text-xs text-muted">
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Playing walkthrough · Silent preview
            </span>
            <button
              type="button"
              onClick={() => setStage('summary')}
              className="font-medium text-accent hover:underline"
            >
              Skip video & view points
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30 shadow-glow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display text-base font-bold tracking-tight text-ink">
                Here's what changed in this update
              </h4>
              <p className="text-xs text-muted">Key enhancements crafted for your workspace</p>
            </div>
          </div>

          <div className="max-h-[42vh] overflow-y-auto space-y-2.5 rounded-2xl border border-line/60 bg-surface-2/25 p-4 shadow-inner">
            {points.map((pt, i) => (
              <div key={i} className="flex items-start gap-3 text-xs sm:text-sm text-ink leading-relaxed">
                <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </span>
                <span className="flex-1">{pt}</span>
              </div>
            ))}
            {extra > 0 && (
              <p className="pt-1 text-xs text-muted/70">
                + {extra} more improvements — view in Settings → Changelog.
              </p>
            )}
          </div>

          {/* Heartfelt thank-you note */}
          <div className="rounded-2xl border border-line/50 bg-surface-2/20 px-4 py-3 text-xs leading-relaxed text-muted">
            <p className="text-ink/90 font-medium">
              &quot;{THANKS}&quot;
            </p>
            <p className="mt-1.5 text-[11px] font-semibold text-accent">
              — Ayush &amp; the PRO TRACK team
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-2 border-t border-line/40">
            <button
              type="button"
              onClick={handleReplay}
              className="flex items-center gap-1.5 rounded-xl border border-line/60 bg-surface px-3.5 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent/40 hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Replay video
            </button>
            <Button size="sm" onClick={dismiss} className="font-bold px-5">
              Back to business
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
