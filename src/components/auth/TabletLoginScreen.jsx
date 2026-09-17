import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  QrCode,
  KeyRound,
  Sparkles,
  AlertCircle,
  Tablet,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { QrScannerModal } from './QrScannerModal'
import { claimCompanionSession, extractSessionId } from '@/services/companionLinkService'
import { useAuth } from '@/hooks/useAuth'
import { APP_VERSION } from '@/lib/version'

import ui1 from '@/assets/ui1.jpg'
import ui2 from '@/assets/ui2.jpg'
import ui3 from '@/assets/ui3.jpg'
import ui4 from '@/assets/ui4.jpg'

const IMAGES = [ui1, ui2, ui3, ui4]

export function TabletLoginScreen() {
  const { signIn, loading: authLoading } = useAuth()
  const [imageIndex] = useState(() => Math.floor(Math.random() * IMAGES.length))
  const [scannerOpen, setScannerOpen] = useState(false)
  const [enteredCode, setEnteredCode] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const autoClaimAttemptedRef = useRef(false)

  const handleClaim = async (rawCode) => {
    const code = extractSessionId(rawCode)
    if (!code) {
      setError('Please enter a valid 8-character pairing code.')
      return
    }

    setClaiming(true)
    setError(null)
    try {
      await claimCompanionSession(code)
      setSuccess(true)
      toast.success('Successfully paired companion tablet!')
    } catch (err) {
      console.warn('[companion] pairing failed:', err)
      setError(err.message || 'Could not claim pairing session.')
    } finally {
      setClaiming(false)
    }
  }

  // Auto-claim if URL contains `s=` query param or `#pair=` hash from a deep-link
  useEffect(() => {
    if (autoClaimAttemptedRef.current || typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const sParam = urlParams.get('s') || urlParams.get('code')
    let hashParam = null
    if (window.location.hash?.includes('pair=')) {
      const match = window.location.hash.match(/pair=([A-Za-z0-9-]+)/)
      if (match?.[1]) hashParam = match[1]
    }

    const initialCode = sParam || hashParam
    if (initialCode) {
      autoClaimAttemptedRef.current = true
      setEnteredCode(initialCode)
      handleClaim(initialCode)
    }
  }, [])

  const handleInputChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^0-9A-Z-]/g, '')
    setEnteredCode(val)
    if (val.replace(/-/g, '').length === 8) {
      handleClaim(val)
    }
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

      <GlassCard className="w-full max-w-4xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch overflow-hidden min-h-[520px] border border-line/60 shadow-2xl backdrop-blur-xl">
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

        {/* Right Pane: Companion Pairing Controls */}
        <div className="md:col-span-7 flex flex-col justify-between py-1 px-1">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 text-left">
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10 text-accent drop-shadow-md" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-display text-xl font-extrabold tracking-tight text-ink">
                    PRO TRACK
                  </span>
                  <span className="text-[11px] text-muted font-sans flex items-center gap-1.5">
                    <Tablet className="h-3 w-3 text-accent" />
                    Android Companion Tablet
                  </span>
                </div>
              </div>

              <span className="rounded-full border border-line/60 bg-surface-2/60 px-2.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                v{APP_VERSION}
              </span>
            </div>

            {claiming ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center rounded-2xl border border-dashed border-accent/40 bg-accent/5">
                <Spinner className="h-9 w-9 text-accent" />
                <h3 className="font-display text-base font-bold text-ink">
                  Pairing with Desktop…
                </h3>
                <p className="text-xs text-muted max-w-xs leading-relaxed">
                  Consuming cryptographic token and activating your synchronized workspace session.
                </p>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center rounded-2xl border border-emerald-500/40 bg-emerald-500/5">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <h3 className="font-display text-base font-bold text-ink">
                  Companion Connected!
                </h3>
                <p className="text-xs text-muted max-w-xs leading-relaxed">
                  Session established. Syncing your syllabus, timetable, and study sessions.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5 text-left">
                {/* Primary Action: QR Code Camera Scanner */}
                <div className="rounded-2xl border border-accent/40 bg-gradient-to-r from-accent/15 via-surface/40 to-accent-2/10 p-4 shadow-xs">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h3 className="font-display text-sm font-bold text-ink flex items-center gap-1.5">
                        <QrCode className="h-4 w-4 text-accent" />
                        Scan Desktop QR Code
                      </h3>
                      <p className="text-[11px] text-muted">
                        Open PRO TRACK on your desktop &rarr; Settings &rarr; &ldquo;Link Tablet Companion&rdquo;.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white px-4 py-3 text-xs font-bold transition-all active:scale-[0.99] shadow-glow cursor-pointer"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>Open Camera Scanner</span>
                  </button>
                </div>

                {/* Secondary Option: Manual Code Entry */}
                <div className="rounded-2xl border border-line/60 bg-surface-2/30 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-ink mb-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-muted" />
                    <span>Or enter 8-character pairing code:</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={enteredCode}
                      onChange={handleInputChange}
                      maxLength={9}
                      placeholder="XXXX-XXXX"
                      className="flex-1 rounded-xl border border-line bg-surface px-4 py-2.5 text-center font-mono text-base font-bold tracking-widest text-ink outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => handleClaim(enteredCode)}
                      disabled={!enteredCode.trim()}
                      className="flex items-center justify-center rounded-xl bg-surface-2 hover:bg-accent/15 hover:text-accent border border-line px-4 text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Tertiary Option: Direct Google Sign-In */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={signIn}
                    disabled={authLoading}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line/70 bg-surface/60 hover:bg-surface text-ink px-4 py-2.5 text-xs font-semibold transition-all active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Direct Sign in with Google</span>
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span className="truncate">{error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="shrink-0 font-bold underline hover:text-rose-100"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted/80">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Automatic Live Firestore Synchronization with Desktop</span>
          </div>
        </div>
      </GlassCard>

      <QrScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={(scannedCode) => {
          setScannerOpen(false)
          setEnteredCode(scannedCode)
          handleClaim(scannedCode)
        }}
      />
    </motion.div>
  )
}
