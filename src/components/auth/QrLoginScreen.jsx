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
        backoffMs = 1500
        unsub = listenForClaim(id, undefined, (e) => setError(e.message))
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
    // In Electron the renderer's setWindowOpenHandler routes external URLs to
    // the system browser; in DEV this is just a new tab.
    window.open(`${WEB_URL}/link`, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      key="qr"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex h-full items-center justify-center p-6"
    >
      <AuroraBackground />

      <GlassCard className="w-full max-w-lg p-8 sm:p-10">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11 drop-shadow-lg" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Welcome to PRO TRACK</h1>
              <p className="text-xs text-muted">Your workspace is ready — sign in to get started.</p>
            </div>
          </div>
        </div>

        {/* QR ↔ Code toggle */}
        <div className="mb-5 flex gap-1 rounded-xl border border-line/60 bg-surface-2/40 p-1">
          <button
            onClick={() => setMode('qr')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              mode === 'qr' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
            }`}
          >
            <QrCode className="h-3.5 w-3.5" /> Scan QR
          </button>
          <button
            onClick={() => setMode('code')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              mode === 'code' ? 'bg-accent text-white' : 'text-muted hover:text-ink'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" /> Use code
          </button>
        </div>

        {mode === 'qr' ? (
          /* ── QR MODE ───────────────────────────────────────── */
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
            <div className="flex flex-col items-center">
              <div className="rounded-2xl bg-white p-4 shadow-lg">
                {linkUrl ? (
                  <QRCodeSVG value={linkUrl} size={184} level="M" />
                ) : (
                  <div className="flex h-[184px] w-[184px] items-center justify-center">
                    <Spinner className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <RefreshCw className="h-3 w-3" />
                Refreshes automatically
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-center">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Smartphone className="h-4 w-4 text-accent" />
                Scan to sign in
              </div>
              <ol className="space-y-2.5">
                {QR_STEPS.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-muted">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          /* ── CODE MODE ─────────────────────────────────────── */
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-center">
              {sessionId ? (
                <div className="flex items-center gap-3">
                  <div className="select-all rounded-2xl border border-accent/40 bg-accent/10 px-6 py-4 font-mono text-3xl font-bold tracking-[0.3em] text-accent">
                    {sessionId}
                  </div>
                  <button
                    onClick={copyCode}
                    title="Copy"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line/60 bg-surface-2/40 text-muted transition-colors hover:text-ink"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ) : (
                <Spinner className="h-8 w-8" />
              )}
            </div>

            <ol className="space-y-2.5">
              {CODE_STEPS.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>

            <button
              onClick={openBrowser}
              disabled={!sessionId}
              className="flex items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/10 px-5 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" /> Open browser to sign in
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 rounded-xl border border-line/60 bg-surface-2/40 px-3 py-2 text-xs text-muted">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          End-to-end handshake · single-use · expires in 2 minutes
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4" />
          Waiting for your phone…
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <div className="relative flex items-center justify-center py-2">
            <div className="flex-grow border-t border-line/60" />
            <span className="mx-4 flex-shrink text-[10px] font-bold uppercase tracking-wider text-muted">
              or
            </span>
            <div className="flex-grow border-t border-line/60" />
          </div>

          <button
            onClick={signIn}
            disabled={authLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-5 py-3 font-semibold text-gray-900 shadow transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60"
          >
            {authLoading ? 'Signing in…' : 'Sign in with Google'}
          </button>
        </div>

        {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
      </GlassCard>
    </motion.div>
  )
}
