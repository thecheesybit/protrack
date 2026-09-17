import { useState, useEffect } from 'react'
import { Tablet, Download, ExternalLink, Copy, Check, Sparkles } from 'lucide-react'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { extractSessionId } from '@/services/companionLinkService'
import toast from 'react-hot-toast'

const GITHUB_RELEASES_URL = 'https://github.com/thecheesybit/protrack/releases/latest'

export function PairLandingPage() {
  const [sessionId, setSessionId] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const s = urlParams.get('s') || urlParams.get('code')
    let hashParam = null
    if (window.location.hash?.includes('pair=')) {
      const match = window.location.hash.match(/pair=([A-Za-z0-9-]+)/)
      if (match?.[1]) hashParam = match[1]
    }
    const raw = s || hashParam || ''
    const extracted = extractSessionId(raw)
    setSessionId(extracted)

    // Attempt automatic app launch via custom scheme if present
    if (extracted) {
      const deepLink = `protrack://pair?s=${encodeURIComponent(extracted)}`
      const timer = setTimeout(() => {
        window.location.href = deepLink
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const copyCode = async () => {
    if (!sessionId) return
    try {
      await navigator.clipboard.writeText(sessionId)
      setCopied(true)
      toast.success('Pairing code copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy automatically')
    }
  }

  const openInApp = () => {
    if (!sessionId) return
    window.location.href = `protrack://pair?s=${encodeURIComponent(sessionId)}`
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 select-none">
      <AuroraBackground />

      <GlassCard className="w-full max-w-md p-8 text-center border border-line/60 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo className="h-12 w-12 drop-shadow-lg text-accent" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Tablet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-ink">
              PRO TRACK Companion
            </h1>
            <p className="text-xs text-muted mt-1">
              Connect your tablet to your desktop workspace
            </p>
          </div>
        </div>

        {sessionId ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                Your Pairing Code
              </span>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="font-mono text-2xl font-bold tracking-widest text-accent select-all">
                  {sessionId}
                </span>
                <button
                  type="button"
                  onClick={copyCode}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted hover:text-ink cursor-pointer"
                  title="Copy code"
                >
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={openInApp}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-xs font-bold text-white shadow-glow hover:bg-accent/90 cursor-pointer"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open in PRO TRACK App</span>
            </button>

            <div className="relative flex items-center justify-center py-1">
              <div className="flex-grow border-t border-line/60" />
              <span className="mx-3 font-mono text-[10px] text-muted uppercase tracking-wider">
                First time pairing?
              </span>
              <div className="flex-grow border-t border-line/60" />
            </div>

            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 hover:bg-surface py-3 text-xs font-bold text-ink transition-colors"
            >
              <Download className="h-4 w-4 text-accent" />
              <span>Download Android APK (GitHub)</span>
            </a>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted leading-relaxed">
              To pair your companion device, open PRO TRACK on your desktop and click &ldquo;Link Tablet Companion&rdquo; to generate a QR code.
            </p>
            <a
              href={GITHUB_RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-xs font-bold text-white shadow-glow hover:bg-accent/90"
            >
              <Download className="h-4 w-4" />
              <span>Download Android APK</span>
            </a>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-muted">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span>Real-time cross-device workspace synchronization</span>
        </div>
      </GlassCard>
    </div>
  )
}
