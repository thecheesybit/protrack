import { useEffect, useState } from 'react'
import { Heart, Github, BadgeCheck, X, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ContributionCard } from './ContributionCard'
import { WallOfHonor } from './WallOfHonor'
import { useIsPatreon } from '@/hooks/useWall'
import { CREATOR } from '@/lib/constants'
import { APP_VERSION } from '@/lib/version'
import { AnimatePresence, motion } from 'framer-motion'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'

export function SupportModal({ open, onClose }) {
  const { user } = useAuth()
  const isPatreon = useIsPatreon(user?.uid)
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    if (open && isDesktop && desktopBridge?.appInfo) {
      desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
    }
  }, [open])

  if (!open) return null

  const Philosophy = (
    <div className="rounded-2xl border border-line bg-surface-2/30 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Heart className="h-4 w-4 text-rose-400 fill-rose-400/20" /> PRO TRACK is free, forever
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted font-medium">
        No premium tier, no paywall, no locked features — everyone runs the latest, most powerful
        version. If it helps you, help us keep the servers running.
      </p>
      <a
        href={CREATOR.githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      >
        <Github className="h-3.5 w-3.5" /> Open-source by {CREATOR.name}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 md:p-8"
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Main Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative flex h-full w-full max-w-5xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-line bg-surface/90 shadow-glass backdrop-blur-3xl md:flex-row"
          >
            {/* Left Sidebar Pane: Header & Philosophy/Contribution */}
            <div className="flex w-full shrink-0 flex-col border-b border-line/60 bg-surface-2/15 md:w-[22rem] md:border-b-0 md:border-r overflow-y-auto">
              {/* Header */}
              <div className="flex items-center gap-2.5 px-6 py-5 border-b border-line/40">
                <Heart className="h-5 w-5 text-rose-400 fill-rose-400/20 animate-pulse" />
                <h3 className="font-bold tracking-tight text-ink text-base">Support Corner</h3>
              </div>

              {/* Scrollable Philosophy / Contribution */}
              <div className="flex-1 p-6 space-y-5">
                {Philosophy}
                {isPatreon ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                    <BadgeCheck className="h-8 w-8 text-emerald-400" />
                    <p className="text-sm font-semibold text-emerald-400">You are an Established Patron</p>
                    <p className="text-xs text-muted">Thank you for keeping PRO TRACK alive for everyone.</p>
                  </div>
                ) : (
                  <ContributionCard />
                )}
              </div>
            </div>

            {/* Right Pane: Wall of Honor */}
            <div className="flex min-h-0 flex-1 flex-col p-6 md:p-8">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between border-b border-line/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink leading-tight">Wall of Honor</h2>
                    <p className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Supporters</p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label="Close support corner"
                  title="Close (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Wall of Honor content */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                <WallOfHonor />
              </div>

              {/* Footer info/branding */}
              <div className="mt-4 border-t border-line/30 pt-3 text-center text-[10px] text-muted/70 font-semibold select-none uppercase tracking-wider">
                PRO TRACK · v{appInfo?.version || APP_VERSION}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
