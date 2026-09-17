import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import {
  Tablet,
  QrCode,
  KeyRound,
  Copy,
  Check,
  Clock,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Smartphone,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { auth, googleProvider } from '@/lib/firebase'
import { GoogleAuthProvider } from 'firebase/auth'
import { signInWithGooglePopup, friendlyAuthError } from '@/lib/authPopup'
import {
  createCompanionSession,
  clearCompanionSession,
  buildCompanionQrUrl,
  COMPANION_TTL_MS,
} from '@/services/companionLinkService'
import { cn } from '@/utils/cn'

const TTL_SECONDS = Math.floor(COMPANION_TTL_MS / 1000) // 120s

export function LinkTabletModal({ open, onClose }) {
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState(TTL_SECONDS)
  const [mode, setMode] = useState('qr') // 'qr' | 'code'

  const activeRef = useRef(true)
  const currentSessionRef = useRef(null)

  const cleanupActiveSession = async () => {
    if (currentSessionRef.current) {
      const idToClean = currentSessionRef.current
      currentSessionRef.current = null
      await clearCompanionSession(idToClean).catch(() => {})
    }
  }

  const generateSession = async () => {
    setLoading(true)
    setError(null)
    try {
      await cleanupActiveSession()

      // Prompt 1-click Google credential confirmation to mint fresh ID token for companion
      const result = await signInWithGooglePopup(auth, googleProvider, { allowRedirectFallback: false })
      if (!result) throw new Error('Sign-in cancelled or failed.')

      const credential = GoogleAuthProvider.credentialFromResult(result)
      const idToken = credential?.idToken
      if (!idToken) throw new Error('Could not retrieve Google ID token for companion pairing.')

      const { sessionId: newId } = await createCompanionSession(idToken)
      if (!activeRef.current) {
        await clearCompanionSession(newId)
        return
      }

      currentSessionRef.current = newId
      setSessionId(newId)
      setTimeLeft(TTL_SECONDS)
      toast.success('Generated fresh companion pairing code!')
    } catch (err) {
      console.warn('[companion] session generation failed:', err)
      setError(friendlyAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  // Handle countdown timer
  useEffect(() => {
    activeRef.current = true
    let timer = null

    if (open && sessionId) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            cleanupActiveSession()
            setSessionId(null)
            return TTL_SECONDS
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [open, sessionId])

  // Handle modal close
  const handleClose = async () => {
    await cleanupActiveSession()
    setSessionId(null)
    setError(null)
    onClose?.()
  }

  const handleCopyCode = async () => {
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

  const qrUrl = sessionId ? buildCompanionQrUrl(sessionId) : ''

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Link Tablet Companion"
      className="max-w-md p-0 overflow-hidden"
    >
      <div className="flex flex-col gap-4 p-1">
        {!sessionId && !loading ? (
          <div className="flex flex-col items-center text-center p-4 gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-glow-sm">
              <Tablet className="h-7 w-7" />
            </div>
            <div>
              <h4 className="font-display text-base font-bold text-ink">
                Pair an Android Tablet
              </h4>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Connect your Android tablet running the PRO TRACK companion app. Once paired, all your modes, syllabus, tasks, and timetable sync live.
              </p>
            </div>

            <div className="w-full rounded-2xl border border-line/60 bg-surface-2/40 p-3.5 text-left flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Zero-Password Cryptographic Handshake</span>
              </div>
              <p className="text-[11px] text-muted leading-normal">
                Generates a single-use 2-minute token. Your Google login is securely transferred directly to your companion device without entering passwords.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 text-left w-full">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={generateSession}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-glow transition-all hover:bg-accent/90 active:scale-[0.99] cursor-pointer"
            >
              <QrCode className="h-4 w-4" />
              <span>Generate Companion Pass</span>
            </button>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <Spinner className="h-8 w-8 text-accent" />
            <p className="text-xs text-muted">Authorizing single-use pairing pass…</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-2 text-center">
            {/* Mode Switcher: QR vs Code */}
            <div className="flex gap-1 rounded-xl border border-line/60 bg-surface-2/40 p-1">
              <button
                type="button"
                onClick={() => setMode('qr')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-semibold transition-colors',
                  mode === 'qr' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                )}
              >
                <QrCode className="h-3.5 w-3.5" /> Scan QR Code
              </button>
              <button
                type="button"
                onClick={() => setMode('code')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-xs font-semibold transition-colors',
                  mode === 'code' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
                )}
              >
                <KeyRound className="h-3.5 w-3.5" /> Pairing Code
              </button>
            </div>

            {mode === 'qr' ? (
              <div className="flex flex-col items-center gap-3">
                <div className="relative rounded-2xl bg-white p-3.5 shadow-lg border border-line/20">
                  <QRCodeSVG value={qrUrl} size={160} level="M" />
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                  <Clock className="h-3 w-3 text-accent" />
                  <span>Valid for {timeLeft}s</span>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={generateSession}
                    className="flex items-center gap-1 font-medium text-accent hover:underline"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="select-all rounded-2xl border border-accent/40 bg-accent/10 px-5 py-2 font-mono text-2xl font-bold tracking-[0.2em] text-accent">
                    {sessionId}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="Copy pairing code"
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-line/60 bg-surface-2/50 text-muted transition-colors hover:text-ink hover:border-accent/40 cursor-pointer"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <div className="text-[11px] font-mono text-muted">
                  Expires in {timeLeft} seconds
                </div>
              </div>
            )}

            {/* Quick Steps */}
            <div className="rounded-xl border border-line/50 bg-surface-2/30 p-3 text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-ink mb-2">
                <Smartphone className="h-3.5 w-3.5 text-accent" />
                <span>On your companion tablet:</span>
              </div>
              <ol className="space-y-1.5 text-xs text-muted">
                <li className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent">1</span>
                  <span>Open PRO TRACK companion app</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent">2</span>
                  <span>{mode === 'qr' ? 'Scan this QR code with the camera' : 'Enter this 8-character pairing code'}</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[9px] font-bold text-accent">3</span>
                  <span>You’re paired! All workspaces sync automatically.</span>
                </li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
