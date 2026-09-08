import { useEffect, useState } from 'react'
import { Heart, Github, BadgeCheck, X, Sparkles, ExternalLink } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ContributionCard } from './ContributionCard'
import { WallOfHonor } from './WallOfHonor'
import { useIsPatreon } from '@/hooks/useWall'
import { CREATOR } from '@/lib/constants'
import { APP_VERSION } from '@/lib/version'
import { AnimatePresence, motion } from 'framer-motion'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'

/**
 * Aesthetic, dignified Support Corner modal.
 * Clean, gallery-grade layout celebrating independent software and its supporters.
 */
export function SupportModal({ open, onClose }) {
  const { user } = useAuth()
  const isPatreon = useIsPatreon(user?.uid)
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    if (open && isDesktop && desktopBridge?.appInfo) {
      desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
    }
  }, [open])

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const CreatorNote = (
    <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-5 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Heart className="h-3.5 w-3.5 fill-accent/20" />
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          Independent & Open
        </span>
      </div>

      <h4 className="font-display text-base font-semibold text-ink leading-snug">
        Free forever, built for focus.
      </h4>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        No paywalls, no tracking, and no subscriptions. Every mode and tool is available to all learners. If PRO TRACK brings clarity to your day, your patronage funds the cloud infrastructure and independent craft.
      </p>

      <a
        href={CREATOR.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3.5 flex items-center justify-between rounded-xl border border-line/50 bg-surface/50 px-3 py-2 text-xs text-muted hover:border-line hover:text-ink hover:bg-surface transition-all"
      >
        <span className="flex items-center gap-2 font-medium">
          <Github className="h-3.5 w-3.5" />
          <span>Open-source by {CREATOR.name}</span>
        </span>
        <ExternalLink className="h-3 w-3 opacity-60" />
      </a>
    </div>
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 md:p-8 select-none"
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Main Modal Window */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative flex h-full w-full max-w-5xl max-h-[86vh] flex-col overflow-hidden rounded-3xl border border-line/70 bg-surface/95 shadow-glass-2xl backdrop-blur-3xl md:flex-row"
          >
            {/* LEFT SIDEBAR: Note & Contribution Flow */}
            <div className="flex w-full shrink-0 flex-col border-b border-line/50 bg-surface-2/15 md:w-[22.5rem] md:border-b-0 md:border-r overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-2.5 px-6 py-5 border-b border-line/40">
                <Heart className="h-4 w-4 text-rose-400 fill-rose-400/20" />
                <h3 className="font-display font-semibold text-ink text-base tracking-tight">
                  Support Corner
                </h3>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 p-5 md:p-6 space-y-4">
                {CreatorNote}

                {isPatreon ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                    <BadgeCheck className="h-8 w-8 text-emerald-400" />
                    <p className="font-display text-sm font-semibold text-emerald-400">
                      Established Patron
                    </p>
                    <p className="text-xs text-muted leading-relaxed">
                      Thank you for keeping PRO TRACK alive and free for everyone worldwide.
                    </p>
                  </div>
                ) : (
                  <ContributionCard />
                )}
              </div>
            </div>

            {/* RIGHT MAIN PANE: Wall of Honor */}
            <div className="flex min-h-0 flex-1 flex-col p-6 md:p-8">
              {/* Header */}
              <div className="mb-5 flex items-center justify-between border-b border-line/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink leading-tight">
                      Wall of Honor
                    </h2>
                    <p className="font-mono text-[10px] text-muted font-medium uppercase tracking-wider mt-0.5">
                      Recognizing the supporters of PRO TRACK
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
                  aria-label="Close"
                  title="Close (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Wall of Honor */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <WallOfHonor />
              </div>

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between border-t border-line/30 pt-3 text-[10px] font-mono text-muted select-none">
                <span>PRO TRACK · v{appInfo?.version || APP_VERSION}</span>
                <span>Crafted for focused study</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
