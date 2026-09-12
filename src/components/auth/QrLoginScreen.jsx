import { useEffect, useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { motion } from 'framer-motion'
import {
  Smartphone,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Clock,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { createHandshake, listenForClaim, clearHandshake } from '@/services/deviceLinkService'
import { useAuth } from '@/hooks/useAuth'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import { cn } from '@/utils/cn'

import ui1 from '@/assets/ui1.jpg'
import ui2 from '@/assets/ui2.jpg'
import ui3 from '@/assets/ui3.jpg'
import ui4 from '@/assets/ui4.jpg'

const IMAGES = [ui1, ui2, ui3, ui4]
const WEB_URL = import.meta.env.VITE_WEB_URL || 'https://pro-track-app.netlify.app'
const TTL_SECONDS = 110 // rotate the handshake just before the 2-min TTL

const QR_STEPS = [
  'Open PRO TRACK on your phone (signed in with Google)',
  'Scan this QR code with your camera',
  'Tap "Link this desktop" — you’re in',
]

const CODE_STEPS = [
  'Click "Open browser" below',
  'Sign in with your Google account',
  'Paste this 8-character code and confirm',
]

export function QrLoginScreen() {
  const { signIn, loading: authLoading } = useAuth()
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState(null)
  const [mode, setMode] = useState('qr') // 'qr' | 'code'
  const [copied, setCopied] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TTL_SECONDS)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Single static image chosen randomly once per session/load
  const [imageIndex] = useState(() => Math.floor(Math.random() * IMAGES.length))

  // App information
  const [appInfo, setAppInfo] = useState(null)

  // Desktop bridge check
  useEffect(() => {
    if (isDesktop && desktopBridge?.appInfo) {
      desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
    }
  }, [])

  // Handshake lifecycle with live countdown and manual trigger
  const spinRef = useRef(null)
  const activeRef = useRef(true)

  useEffect(() => {
    activeRef.current = true
    let unsub = null
    let currentId = null
    let countdownInterval = null
    let backoffMs = 1500
    let retryTimer = null

    const spin = async () => {
      setIsRefreshing(true)
      try {
        if (currentId) await clearHandshake(currentId)
        if (unsub) unsub()

        const { sessionId: id } = await createHandshake()
        if (!activeRef.current) return clearHandshake(id)

        currentId = id
        setSessionId(id)
        setError(null)
        setClaiming(false)
        setTimeLeft(TTL_SECONDS)
        setIsRefreshing(false)
        backoffMs = 1500

        unsub = listenForClaim(
          id,
          undefined,
          (e) => {
            setError(e.message)
            setClaiming(false)
          },
          () => {
            setClaiming(true)
          }
        )
      } catch (e) {
        if (!activeRef.current) return
        setIsRefreshing(false)
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        setError(offline ? 'Offline — waiting for connection…' : e.message)
        retryTimer = setTimeout(() => activeRef.current && spin(), backoffMs)
        backoffMs = Math.min(15_000, backoffMs * 2)
      }
    }

    spinRef.current = spin
    spin()

    // Countdown loop (1s ticks)
    countdownInterval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          spin()
          return TTL_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    const onOnline = () => activeRef.current && spin()
    window.addEventListener('online', onOnline)

    return () => {
      activeRef.current = false
      clearInterval(countdownInterval)
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener('online', onOnline)
      if (unsub) unsub()
      if (currentId) clearHandshake(currentId)
    }
  }, [])

  const handleManualRefresh = () => {
    if (spinRef.current) {
      spinRef.current()
      toast.success('Generated fresh handshake code')
    }
  }

  const linkUrl = sessionId ? `${WEB_URL}/link?s=${sessionId}` : null

  const copyCode = async () => {
    if (!sessionId) return
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(true)
      toast.success('Pairing code copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy automatically — select manually')
    }
  }

  const openBrowser = () => {
    if (!linkUrl) return
    window.open(`${WEB_URL}/link`, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      key="qr"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex min-h-screen items-center justify-center p-4 sm:p-6"
    >
      <AuroraBackground />

      <GlassCard className="w-full max-w-5xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch overflow-hidden min-h-[560px] border border-line/60 shadow-2xl backdrop-blur-xl">
        {/* ── Left Pane: Workspace Artwork ── */}
        <div className="hidden md:block md:col-span-5 relative overflow-hidden rounded-2xl bg-surface-2/20 border border-line/20 shadow-inner">
          <img
            src={IMAGES[imageIndex]}
            alt="Workspace Artwork"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* ── Right Pane: Reimagined Authentication & Handshake Hub ── */}
        <div className="md:col-span-7 flex flex-col justify-between py-1 px-1">
          <div>
            {/* Header: Brand + Version */}
            <div className="flex items-center justify-between mb-6 text-left">
              <div className="flex items-center gap-3">
                <Logo className="h-10 w-10 text-accent drop-shadow-md" />
                <div className="flex flex-col items-start leading-tight">
                  <span className="font-display text-xl font-extrabold tracking-tight text-ink">
                    PRO TRACK
                  </span>
                  <span className="text-[11px] text-muted font-sans">
                    Aspirant Focus & Exam Architecture
                  </span>
                </div>
              </div>

              {appInfo?.version && (
                <span className="rounded-full border border-line/60 bg-surface-2/60 px-2.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                  v{appInfo.version}
                </span>
              )}
            </div>

            {/* Direct Google Sign-In Card (Prominent Primary Action) */}
            <div className="mb-6 rounded-2xl border border-line/70 bg-gradient-to-r from-surface-2/60 via-surface/40 to-surface-2/30 p-4 text-left shadow-xs">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div>
                  <h3 className="font-display text-sm font-bold text-ink">
                    Direct Browser / Desktop Login
                  </h3>
                  <p className="text-[11px] text-muted">
                    Sign in with your Google account to sync all workspaces instantly.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={signIn}
                disabled={authLoading}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-white hover:bg-neutral-100 text-neutral-900 px-4 py-2.5 text-xs font-bold transition-all active:scale-[0.99] disabled:opacity-60 shadow-md"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{authLoading ? 'Signing in…' : 'Sign in with Google'}</span>
              </button>
            </div>

            {/* Divider: Mobile Handshake Link Option */}
            <div className="relative flex items-center justify-center py-2 mb-4">
              <div className="flex-grow border-t border-line/60" />
              <span className="mx-3 flex-shrink font-mono text-[10px] font-bold uppercase tracking-wider text-muted">
                or link via mobile app
              </span>
              <div className="flex-grow border-t border-line/60" />
            </div>

            {/* Mode Selector Segment: QR vs Code */}
            {!claiming && (
              <div className="mb-4 flex gap-1 rounded-xl border border-line/60 bg-surface-2/40 p-1">
                <button
                  type="button"
                  onClick={() => setMode('qr')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                    mode === 'qr' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                  )}
                >
                  <QrCode className="h-3.5 w-3.5" /> Scan QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setMode('code')}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors',
                    mode === 'code' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                  )}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Pairing Code
                </button>
              </div>
            )}

            {/* Handshake Display States */}
            {claiming ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 text-center rounded-2xl border border-dashed border-accent/40 bg-accent/5">
                <Spinner className="h-9 w-9 text-accent" />
                <h3 className="font-display text-base font-bold text-ink">
                  Pairing with Mobile Device…
                </h3>
                <p className="text-xs text-muted max-w-xs leading-relaxed">
                  Secure cryptographic handshake received. Authenticating your session and loading workspaces.
                </p>
              </div>
            ) : mode === 'qr' ? (
              /* QR Code Panel */
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch text-left">
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center">
                  <div className="relative rounded-2xl bg-white p-3.5 shadow-lg border border-line/20">
                    {linkUrl ? (
                      <QRCodeSVG value={linkUrl} size={140} level="M" />
                    ) : (
                      <div className="flex h-[140px] w-[140px] items-center justify-center">
                        <Spinner className="h-8 w-8 text-accent" />
                      </div>
                    )}
                  </div>

                  {/* TTL Countdown & Refresh Action */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-muted">
                      <Clock className="h-3 w-3 text-accent" />
                      <span>{timeLeft}s remaining</span>
                    </div>
                    <span className="text-muted/40">·</span>
                    <button
                      type="button"
                      onClick={handleManualRefresh}
                      disabled={isRefreshing}
                      className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline disabled:opacity-50"
                      title="Generate a fresh QR code immediately"
                    >
                      <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
                      <span>Refresh</span>
                    </button>
                  </div>
                </div>

                {/* Steps */}
                <div className="flex flex-1 flex-col justify-center">
                  <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-ink">
                    <Smartphone className="h-4 w-4 text-accent" />
                    Quick Steps:
                  </div>
                  <ol className="space-y-2">
                    {QR_STEPS.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-muted">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              /* Pairing Code Panel */
              <div className="flex flex-col gap-4 text-left">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {sessionId ? (
                    <div className="flex items-center gap-2.5">
                      <div className="select-all rounded-2xl border border-accent/40 bg-accent/10 px-5 py-2.5 font-mono text-2xl font-bold tracking-[0.25em] text-accent">
                        {sessionId}
                      </div>
                      <button
                        type="button"
                        onClick={copyCode}
                        title="Copy pairing code"
                        className="flex h-11 w-11 items-center justify-center rounded-xl border border-line/60 bg-surface-2/50 text-muted transition-colors hover:text-ink hover:border-accent/40"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <Spinner className="h-8 w-8 text-accent" />
                  )}

                  <button
                    type="button"
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 rounded-xl border border-line/60 bg-surface px-3 py-2 text-xs font-medium text-muted hover:text-ink hover:border-accent/40 transition-colors"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                    <span>New Code</span>
                  </button>
                </div>

                <div className="text-center font-mono text-[11px] text-muted">
                  Expires in {timeLeft} seconds
                </div>

                <ol className="space-y-1.5">
                  {CODE_STEPS.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-xs text-muted">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>

                <button
                  type="button"
                  onClick={openBrowser}
                  disabled={!sessionId}
                  className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Browser to Confirm
                </button>
              </div>
            )}
          </div>

          {/* Error Banner with Retry */}
          {error && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span className="truncate">{error}</span>
              </div>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="shrink-0 font-bold underline hover:text-rose-100"
              >
                Retry
              </button>
            </div>
          )}

          {/* Footer Security Badge */}
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted/80">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>End-to-end device handshake · Single-use token · 110s TTL</span>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}
