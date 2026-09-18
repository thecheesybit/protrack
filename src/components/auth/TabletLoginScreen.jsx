import { useState } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, AlertCircle, Tablet, ShieldCheck } from 'lucide-react'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import { APP_VERSION } from '@/lib/version'

import ui1 from '@/assets/ui1.jpg'
import ui2 from '@/assets/ui2.jpg'
import ui3 from '@/assets/ui3.jpg'
import ui4 from '@/assets/ui4.jpg'

const IMAGES = [ui1, ui2, ui3, ui4]

export function TabletLoginScreen() {
  const { signIn, loading: authLoading, loadingStatus, error: authError } = useAuth()
  const [imageIndex] = useState(() => Math.floor(Math.random() * IMAGES.length))
  const [dismissedError, setDismissedError] = useState(null)

  const activeError = authError && authError !== dismissedError ? authError : null

  const handleSignIn = async () => {
    setDismissedError(null)
    await signIn()
  }

  return (
    <motion.div
      key="tablet-login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 select-none"
    >
      <AuroraBackground />

      <GlassCard className="w-full max-w-4xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch overflow-hidden min-h-[480px] border border-line/60 shadow-2xl backdrop-blur-xl">
        {/* Left Pane: Artwork */}
        <div className="hidden md:block md:col-span-5 relative overflow-hidden rounded-2xl bg-surface-2/20 border border-line/20 shadow-inner">
          <img
            src={IMAGES[imageIndex]}
            alt="PRO TRACK Workspace Artwork"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-5 text-white">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-accent">
              Companion Surface
            </span>
            <h3 className="font-display text-lg font-bold">
              Focus &amp; Exam Architecture
            </h3>
          </div>
        </div>

        {/* Right Pane: Authentication Hub */}
        <div className="md:col-span-7 flex flex-col justify-between py-2 px-1">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8 text-left">
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10 text-accent drop-shadow-md" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-display text-xl font-extrabold tracking-tight text-ink">
                    PRO TRACK
                  </span>
                  <span className="text-[11px] text-muted font-sans flex items-center gap-1.5">
                    <Tablet className="h-3 w-3 text-accent" />
                    Android Tablet Edition
                  </span>
                </div>
              </div>

              <span className="rounded-full border border-line/60 bg-surface-2/60 px-2.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                v{APP_VERSION}
              </span>
            </div>

            {/* Hero Sign-In Card */}
            <div className="flex flex-col gap-4 text-left">
              <div className="rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/15 via-surface/60 to-accent-2/10 p-6 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-accent" />
                    Instant Sign In
                  </h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Sign in with your Google account to sync your syllabus, timetable, and study sessions across all your devices.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={authLoading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.99] text-gray-900 border border-line/80 px-5 py-3.5 text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-75"
                >
                  {authLoading ? (
                    <>
                      <Spinner className="h-5 w-5 text-gray-700" />
                      <span>{loadingStatus || 'Connecting to Google…'}</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              </div>

              {/* Secure auth assurance note */}
              <div className="flex items-center gap-2 px-1 text-xs text-muted/90">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Fast, secure sign-in using your Android device credentials</span>
              </div>
            </div>

            {/* Error notification */}
            {activeError && (
              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-300">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span className="truncate">{activeError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDismissedError(authError)}
                  className="shrink-0 font-bold underline hover:text-rose-100 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-muted/80">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Real-time cross-device workspace synchronization</span>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}
