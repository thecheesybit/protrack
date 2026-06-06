import { useState } from 'react'
import { motion } from 'framer-motion'
import { Monitor, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { claimDesktop } from '@/services/deviceLinkService'

/**
 * Opened on the phone after scanning the desktop QR (URL: /link?s=<sessionId>).
 * The signed-in user confirms, which mints a single-use custom token for the
 * waiting desktop via the Cloud Function.
 */
export function LinkDevicePage() {
  const { user, signIn, loading } = useAuth()
  const qs = new URLSearchParams(window.location.search)
  const urlCode = (qs.get('s') || qs.get('code') || '').toUpperCase()
  const [enteredCode, setEnteredCode] = useState('')
  const sessionId = (urlCode || enteredCode).trim()
  const [state, setState] = useState('idle') // idle | linking | done | error
  const [message, setMessage] = useState('')

  const confirm = async () => {
    if (!sessionId) return
    setState('linking')
    try {
      await claimDesktop(sessionId)
      setState('done')
    } catch (err) {
      console.error('[link] claim failed', err)
      setMessage(err.message || 'Could not link this device')
      setState('error')
    }
  }

  const goHome = () => {
    window.location.href = '/'
  }

  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <AuroraBackground />
      <GlassCard className="w-full max-w-sm p-8 text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo className="h-12 w-12 drop-shadow-lg" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
            <Monitor className="h-6 w-6 text-accent" />
          </div>
        </div>

        {!sessionId ? (
          <>
            <h1 className="text-lg font-bold">Enter desktop code</h1>
            <p className="mb-4 mt-2 text-sm text-muted">
              Open PRO TRACK on your desktop and copy the 8-character code shown
              on the sign-in screen.
            </p>
            <input
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value.toUpperCase())}
              maxLength={9}
              placeholder="XXXX-XXXX"
              autoFocus
              className="w-full rounded-2xl border border-line bg-surface-2/60 px-4 py-3 text-center font-mono text-lg tracking-widest outline-none focus:border-accent"
            />
          </>
        ) : loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
        ) : !user ? (
          <>
            <h1 className="text-lg font-bold">Sign in to link</h1>
            <p className="mb-5 mt-2 text-sm text-muted">
              Sign in here first, then confirm to unlock the desktop app.
            </p>
            <button
              onClick={signIn}
              className="w-full rounded-2xl bg-white px-5 py-3 font-semibold text-gray-900 shadow"
            >
              Continue with Google
            </button>
          </>
        ) : state === 'done' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold">Desktop unlocked</h1>
            <p className="mt-2 text-sm text-muted">
              Your computer is signing in now. You can close this tab.
            </p>
            <button onClick={goHome} className="mt-5 text-sm text-accent hover:underline">
              Back to PRO TRACK
            </button>
          </>
        ) : state === 'error' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h1 className="text-lg font-bold">Couldn’t link</h1>
            <p className="mt-2 text-sm text-muted">{message}</p>
            <button onClick={() => setState('idle')} className="mt-5 text-sm text-accent hover:underline">
              Try again
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold">Link this desktop?</h1>
            <p className="mb-5 mt-2 text-sm text-muted">
              Signed in as {user.email}. Confirm to securely sign in on your
              computer.
            </p>
            <button
              onClick={confirm}
              disabled={state === 'linking'}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow disabled:opacity-60"
            >
              {state === 'linking' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Linking…
                </>
              ) : (
                'Link this desktop'
              )}
            </button>
          </>
        )}
      </GlassCard>
    </div>
  )
}
