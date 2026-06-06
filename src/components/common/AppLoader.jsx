import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { AuroraBackground } from './AuroraBackground'
import { LogOut, AlertTriangle, RefreshCw } from 'lucide-react'

/** Full-screen boot loader shown while auth state resolves or syncs. */
export function AppLoader({ error: customError }) {
  const { loadingStatus, error: authError, signOut } = useAuth()
  const displayError = customError || authError

  return (
    <motion.div
      key="loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex h-full flex-col items-center justify-center gap-6 p-6"
    >
      <AuroraBackground />
      
      {displayError ? (
        <div className="z-10 flex flex-col items-center gap-4 text-center max-w-md">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/15">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-red-400 font-sans tracking-tight">Loading Failed</h2>
          <p className="text-sm text-muted">
            {displayError}
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-xl border border-line/60 bg-surface-2/40 px-4 py-2.5 text-xs font-semibold text-muted hover:text-ink transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reload app
            </button>
            {signOut && (
              <button
                onClick={signOut}
                className="flex items-center gap-2 rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition-all"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            className="h-12 w-12 rounded-full border-2 border-line border-t-accent"
          />
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm font-medium tracking-wide text-muted"
          >
            {loadingStatus || 'Loading your workspace…'}
          </motion.p>
        </>
      )}
    </motion.div>
  )
}
