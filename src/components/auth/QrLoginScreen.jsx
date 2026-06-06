import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { motion } from 'framer-motion'
import { Smartphone, ShieldCheck, RefreshCw } from 'lucide-react'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { Spinner } from '@/components/ui/Spinner'
import { createHandshake, listenForClaim, clearHandshake } from '@/services/deviceLinkService'

const WEB_URL = import.meta.env.VITE_WEB_URL || 'https://pro-track-app.netlify.app'
const REFRESH_MS = 110 * 1000 // rotate the QR just before the 2-min TTL

const STEPS = [
  'Open PRO TRACK on your phone (signed in with Google)',
  'Scan this QR code with your camera',
  'Tap “Link this desktop” — you’re in',
]

export function QrLoginScreen() {
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    let unsub = null
    let currentId = null
    let timer = null

    const spin = async () => {
      try {
        if (currentId) await clearHandshake(currentId)
        if (unsub) unsub()
        const { sessionId: id } = await createHandshake()
        if (!active) return clearHandshake(id)
        currentId = id
        setSessionId(id)
        setError(null)
        unsub = listenForClaim(id, undefined, (e) => setError(e.message))
      } catch (e) {
        setError(e.message)
      }
    }

    spin()
    timer = setInterval(spin, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
      if (unsub) unsub()
      if (currentId) clearHandshake(currentId)
    }
  }, [])

  const linkUrl = sessionId ? `${WEB_URL}/link?s=${sessionId}` : null

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
        <div className="mb-7 flex items-center gap-3">
          <Logo className="h-11 w-11 drop-shadow-lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">PRO TRACK</h1>
            <p className="text-xs text-muted">Desktop · secure sign-in</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
          {/* QR */}
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

          {/* Steps */}
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4 text-accent" />
              Scan to sign in
            </div>
            <ol className="space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-muted">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>

            <div className="mt-5 flex items-center gap-2 rounded-xl border border-line/60 bg-surface-2/40 px-3 py-2 text-xs text-muted">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              End-to-end handshake · single-use · expires in 2 minutes
            </div>
          </div>
        </div>

        <div className="mt-7 flex items-center justify-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4" />
          Waiting for your phone…
        </div>

        {error && <p className="mt-3 text-center text-xs text-red-400">{error}</p>}
      </GlassCard>
    </motion.div>
  )
}
