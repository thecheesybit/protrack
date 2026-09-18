import { useEffect, useState } from 'react'
import { Monitor, Tablet, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/hooks/useAuth'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { claimDesktop, resumePendingClaim } from '@/services/deviceLinkService'
import { claimCompanionInBrowser } from '@/services/companionLinkService'
import { friendlyAuthError } from '@/lib/authPopup'

/**
 * Opened on phone or browser after scanning a QR (URL: /link?s=<sessionId>).
 * Supports both desktop pairing and companion tablet pairing.
 */
export function LinkDevicePage() {
  const { user, signIn, loading } = useAuth()
  const qs = new URLSearchParams(window.location.search)
  const urlCode = (qs.get('s') || qs.get('code') || '').toUpperCase()
  const [enteredCode, setEnteredCode] = useState('')
  const sessionId = (urlCode || enteredCode).trim()
  const [state, setState] = useState('idle') // idle | linking | done | error
  const [message, setMessage] = useState('')
  const [isCompanion, setIsCompanion] = useState(false)

  // Detect if sessionId belongs to a companion tablet
  useEffect(() => {
    if (!sessionId || !db) return
    let active = true
    getDoc(doc(db, 'companionHandshakes', sessionId))
      .then((snap) => {
        if (active && snap.exists()) setIsCompanion(true)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [sessionId])

  // If confirm() fell back to a full-page redirect, finish that claim here.
  useEffect(() => {
    let cancelled = false
    resumePendingClaim()
      .then((resumedSessionId) => {
        if (!cancelled && resumedSessionId) setState('done')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[link] resume claim failed', err)
        setMessage(friendlyAuthError(err))
        setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const confirm = async () => {
    if (!sessionId) return
    setState('linking')
    try {
      if (isCompanion) {
        const completed = await claimCompanionInBrowser(sessionId)
        if (completed) {
          setState('done')
          setTimeout(() => {
            window.location.href = `protrack://pair?s=${encodeURIComponent(sessionId)}`
          }, 800)
        }
      } else {
        const completed = await claimDesktop(sessionId)
        if (completed) setState('done')
      }
    } catch (err) {
      console.error('[link] claim failed', err)
      setMessage(friendlyAuthError(err))
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
            {isCompanion ? <Tablet className="h-6 w-6 text-accent" /> : <Monitor className="h-6 w-6 text-accent" />}
          </div>
        </div>

        {!sessionId ? (
          <>
            <h1 className="text-lg font-bold">Enter pairing code</h1>
            <p className="mb-4 mt-2 text-sm text-muted">
              Open PRO TRACK on your desktop or tablet and copy the 8-character code shown
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
              Sign in here first, then confirm to unlock the {isCompanion ? 'companion tablet' : 'desktop app'}.
            </p>
            <button
              onClick={signIn}
              className="w-full rounded-2xl bg-white px-5 py-3 font-semibold text-gray-900 shadow cursor-pointer"
            >
              Continue with Google
            </button>
          </>
        ) : state === 'done' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold">{isCompanion ? 'Companion tablet unlocked' : 'Desktop unlocked'}</h1>
            <p className="mt-2 text-sm text-muted">
              {isCompanion
                ? 'Your tablet is pairing now. You can return to the PRO TRACK app.'
                : 'Your computer is signing in now. You can close this tab.'}
            </p>
            {isCompanion && (
              <a
                href={`protrack://pair?s=${encodeURIComponent(sessionId)}`}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow"
              >
                Return to PRO TRACK App
              </a>
            )}
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
            <h1 className="text-lg font-bold">{isCompanion ? 'Link companion tablet?' : 'Link this desktop?'}</h1>
            <p className="mb-5 mt-2 text-sm text-muted">
              Signed in as {user.email}. Confirm to securely sign in on your
              {isCompanion ? ' tablet.' : ' computer.'}
            </p>
            <button
              onClick={confirm}
              disabled={state === 'linking'}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow disabled:opacity-60 cursor-pointer"
            >
              {state === 'linking' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Linking…
                </>
              ) : (
                isCompanion ? 'Link this companion tablet' : 'Link this desktop'
              )}
            </button>
          </>
        )}
      </GlassCard>
    </div>
  )
}
