import { AnimatePresence, motion } from 'framer-motion'
import { DownloadCloud, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Logo } from '@/components/common/Logo'
import { desktopBridge } from '@/desktop/isDesktop'

/**
 * Aggressive update enforcement. When a new production version is downloading or
 * ready, this overlays and obscures the entire dashboard so a stale client can
 * never keep operating — exactly as the update policy requires. Once ready, the
 * user applies it with a single click (quit + install).
 */
export function UpdateGate() {
  const status = useStore((s) => s.updateStatus)
  const version = useStore((s) => s.updateVersion)
  const progress = useStore((s) => s.updateProgress)

  const show = status === 'downloading' || status === 'ready'
  const ready = status === 'ready'

  const install = () => desktopBridge?.update?.install?.()

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="edge-light w-full max-w-sm rounded-3xl border border-line/70 bg-surface/90 p-7 text-center shadow-glass-lg"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <DownloadCloud className="h-7 w-7" />
            </div>
            <Logo className="mx-auto mb-3 h-8 w-8 opacity-80" />
            <h2 className="text-lg font-bold">A new version of PRO TRACK is available</h2>
            <p className="mt-1.5 text-sm text-muted">
              {version ? `Version ${version} ` : 'An update '}
              {ready ? 'is ready to install.' : 'is downloading automatically.'}
            </p>

            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'easeOut' }}
              />
            </div>

            {ready ? (
              <button
                onClick={install}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow"
              >
                <RefreshCw className="h-4 w-4" /> Restart &amp; update
              </button>
            ) : (
              <p className="mt-4 text-xs font-medium tabular-nums text-muted">Downloading… {progress}%</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
