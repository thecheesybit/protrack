import { useEffect, useState } from 'react'
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
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { createHandshake, listenForClaim, clearHandshake } from '@/services/deviceLinkService'
import { useAuth } from '@/hooks/useAuth'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'

import ui1 from '@/assets/ui1.jpg'
import ui2 from '@/assets/ui2.jpg'
import ui3 from '@/assets/ui3.jpg'
import ui4 from '@/assets/ui4.jpg'

const IMAGES = [ui1, ui2, ui3, ui4]
const WEB_URL = import.meta.env.VITE_WEB_URL || 'https://pro-track-app.netlify.app'
const REFRESH_MS = 110 * 1000 // rotate the handshake just before the 2-min TTL

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

  // Single static image chosen randomly once per session/load
  const [imageIndex, setImageIndex] = useState(0)

  // App information
  const [appInfo, setAppInfo] = useState(null)

  // Randomize slideshow image index and check desktop bridge
  useEffect(() => {
    setImageIndex(Math.floor(Math.random() * IMAGES.length))

    if (isDesktop && desktopBridge?.appInfo) {
      desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
    }
  }, [])

  useEffect(() => {
    let active = true
    let unsub = null
    let currentId = null
    let cycleTimer = null
    let retryTimer = null
    let backoffMs = 1500

    const spin = async () => {
      try {
        if (currentId) await clearHandshake(currentId)
        if (unsub) unsub()
        const { sessionId: id } = await createHandshake()
        if (!active) return clearHandshake(id)
        currentId = id
        setSessionId(id)
        setError(null)
        setClaiming(false)
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
        if (!active) return
        const offline = typeof navigator !== 'undefined' && !navigator.onLine
        setError(offline ? 'Offline — waiting for connection…' : e.message)
        retryTimer = setTimeout(() => active && spin(), backoffMs)
        backoffMs = Math.min(15_000, backoffMs * 2)
      }
    }

    spin()
    cycleTimer = setInterval(spin, REFRESH_MS)
    const onOnline = () => active && spin()
    window.addEventListener('online', onOnline)

    return () => {
      active = false
      clearInterval(cycleTimer)
      if (retryTimer) clearTimeout(retryTimer)
      window.removeEventListener('online', onOnline)
      if (unsub) unsub()
      if (currentId) clearHandshake(currentId)
    }
  }, [])

  const linkUrl = sessionId ? `${WEB_URL}/link?s=${sessionId}` : null

  const copyCode = async () => {
    if (!sessionId) return
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(true)
      toast.success('Code copied')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy — select and copy manually')
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

      <GlassCard className="w-full max-w-5xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch overflow-hidden min-h-[520px]">
        {/* Left pane: static random image for the session */}
        <div className="hidden md:block md:col-span-5 relative overflow-hidden rounded-2xl bg-surface-2/20 border border-line/10">
          <img
            src={IMAGES[imageIndex]}
            alt="Workspace Artwork"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Right pane: form container */}
        <div className="md:col-span-7 flex flex-col justify-between py-1 px-1">
          <div>
            {/* Header: Logo and App Title + Version */}
            <div className="flex items-center gap-3 mb-8 text-left">
              <Logo className="h-10 w-10 text-accent drop-shadow-lg" />
              <div className="flex flex-col items-start leading-tight">
                <span className="text-xl font-black tracking-wider text-ink-primary font-cinzel">PRO TRACK</span>
                {appInfo?.version && (
                  <span className="text-[10px] text-accent font-mono font-bold mt-0.5">
                    Version {appInfo.version}
                  </span>
                )}
              </div>
            </div>

            {/* Title & Description */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-ink-primary text-left">Login to your account</h2>
              <p className="text-xs text-muted mt-1 text-left">
                Welcome back! Enter your details to log in to your account
              </p>
            </div>

            {/* Pill segment toggles for QR vs Numeric Code linking */}
            {!claiming && (
              <div className="mb-6 flex gap-1 rounded-xl border border-line/60 bg-surface-2/40 p-1">
                <button
                  type="button"
                  onClick={() => setMode('qr')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    mode === 'qr' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  <QrCode className="h-3.5 w-3.5" /> Scan QR
                </button>
                <button
                  type="button"
                  onClick={() => setMode('code')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                    mode === 'code' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
                  }`}
                >
                  <KeyRound className="h-3.5 w-3.5" /> Use code
                </button>
              </div>
            )}

            {/* Main Form Content */}
            {claiming ? (
              <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <Spinner className="h-10 w-10 text-accent" />
                <h2 className="text-lg font-bold">Connecting device…</h2>
                <p className="text-xs text-muted max-w-xs">
                  Secure handshake received. Authenticating and loading your workspace, please wait.
                </p>
              </div>
            ) : mode === 'qr' ? (
              /* QR Code linking panel */
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch text-left">
                <div className="flex flex-col items-center justify-center">
                  <div className="rounded-2xl bg-white p-4 shadow-lg">
                    {linkUrl ? (
                      <QRCodeSVG value={linkUrl} size={150} level="M" />
                    ) : (
                      <div className="flex h-[150px] w-[150px] items-center justify-center">
                        <Spinner className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-muted">
                    <RefreshCw className="h-2.5 w-2.5" />
                    Refreshes automatically
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-center">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-primary">
                    <Smartphone className="h-4 w-4 text-accent" />
                    Scan to sign in
                  </div>
                  <ol className="space-y-2">
                    {QR_STEPS.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-xs text-muted">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : (
              /* Numeric Code Linking Panel */
              <div className="flex flex-col gap-5 text-left">
                <div className="flex items-center justify-center">
                  {sessionId ? (
                    <div className="flex items-center gap-3">
                      <div className="select-all rounded-2xl border border-accent/40 bg-accent/10 px-6 py-3 font-mono text-2xl font-bold tracking-[0.3em] text-accent">
                        {sessionId}
                      </div>
                      <button
                        type="button"
                        onClick={copyCode}
                        title="Copy"
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line/60 bg-surface-2/40 text-muted transition-colors hover:text-ink"
                      >
                        {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : (
                    <Spinner className="h-8 w-8" />
                  )}
                </div>

                <ol className="space-y-2">
                  {CODE_STEPS.map((s, i) => (
                    <li key={i} className="flex gap-2.5 text-xs text-muted">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[10px] font-semibold text-accent">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>

                <button
                  type="button"
                  onClick={openBrowser}
                  disabled={!sessionId}
                  className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-5 py-2.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open browser to sign in
                </button>
              </div>
            )}
          </div>

          {/* Social login buttons and Info */}
          {!claiming && (
            <div className="mt-8">
              {/* Security info tooltip */}
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-line/60 bg-surface-2/40 px-3 py-2 text-[10px] text-muted">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                End-to-end handshake · single-use · expires in 2 minutes
              </div>

              {/* Or divider line */}
              <div className="relative flex items-center justify-center py-2">
                <div className="flex-grow border-t border-line/60" />
                <span className="mx-4 flex-shrink text-[9px] font-bold uppercase tracking-wider text-muted">
                  or continue with
                </span>
                <div className="flex-grow border-t border-line/60" />
              </div>

              {/* Centered Sign in with Google */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={signIn}
                  disabled={authLoading}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-line/60 bg-white hover:bg-gray-50 text-gray-900 px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-60 shadow-sm"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
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
                  Sign in with Google
                </button>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Handshake/Network error text */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 select-none">
          <p className="rounded-full bg-red-500/15 border border-red-500/30 px-4 py-1.5 text-xs text-red-400 font-medium shadow-lg backdrop-blur-md">
            {error}
          </p>
        </div>
      )}
    </motion.div>
  )
}
