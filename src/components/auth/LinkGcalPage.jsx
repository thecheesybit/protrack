import { useState, useEffect, useCallback } from 'react'
import { Calendar, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { GoogleAuthProvider } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { signInWithGooglePopup, friendlyAuthError } from '@/lib/authPopup'
import { isGisConfigured, acquireToken } from '@/lib/gauth'

const CAL_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
]

/**
 * Desktop → browser Google Calendar handshake. Writes an access token (+ its
 * expiry) into `users/{uid}/gcal/handshake`; the desktop app grabs it and binds
 * the connection.
 *
 * With `VITE_GOOGLE_OAUTH_CLIENT_ID` set this page tries a SILENT GIS token
 * first (no popup, no clicks) — so a periodic background re-handshake from the
 * desktop just flashes a tab and closes. Only if silent fails does it show the
 * consent button. `?silent=1` also auto-closes the tab on success.
 */
export function LinkGcalPage() {
  const { loading } = useAuth()
  const qs = new URLSearchParams(window.location.search)
  const targetUid = qs.get('uid')
  const autoClose = qs.get('silent') === '1'

  const [state, setState] = useState('idle') // idle | connecting | done | error
  const [message, setMessage] = useState('')

  const writeToken = useCallback(
    async (token, uid, expiresAt) => {
      const handshakeRef = doc(db, 'users', uid, 'gcal', 'handshake')
      await setDoc(handshakeRef, {
        status: 'success',
        accessToken: token,
        expiresAt: expiresAt || Date.now() + 3500 * 1000,
        updatedAt: serverTimestamp(),
      })
      setState('done')
      if (autoClose) setTimeout(() => window.close(), 1200)
    },
    [autoClose],
  )

  const connectInteractive = useCallback(async () => {
    setState('connecting')
    try {
      if (isGisConfigured()) {
        // GIS consent popup → token; no Firebase re-auth needed.
        const token = await acquireToken({ interactive: true })
        const uid = targetUid || auth.currentUser?.uid
        if (!uid) throw new Error('Missing desktop user id.')
        await writeToken(token, uid, Date.now() + 3500 * 1000)
        return
      }
      const provider = new GoogleAuthProvider()
      CAL_SCOPES.forEach((s) => provider.addScope(s))
      provider.setCustomParameters({ prompt: 'consent' })
      const result = await signInWithGooglePopup(auth, provider)
      const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken
      if (!token) throw new Error('No calendar access token returned from Google.')
      const signedInUid = result.user.uid
      if (targetUid && signedInUid !== targetUid) {
        throw new Error(
          `Signed-in account does not match the desktop app. Expected ${targetUid.slice(0, 8)}…, got ${signedInUid.slice(0, 8)}….`,
        )
      }
      await writeToken(token, signedInUid, Date.now() + 3500 * 1000)
    } catch (err) {
      console.error('[gcal-link] connect failed', err)
      setMessage(friendlyAuthError(err))
      setState('error')
    }
  }, [targetUid, writeToken])

  // On load: try a silent token first (works when the Google session is alive
  // and consent was granted before).
  useEffect(() => {
    if (loading) return
    let cancelled = false
    ;(async () => {
      if (isGisConfigured() && targetUid) {
        try {
          const token = await acquireToken({ interactive: false })
          if (!cancelled) await writeToken(token, targetUid, Date.now() + 3500 * 1000)
          return
        } catch {
          /* silent failed — fall through to the button */
        }
      }
      if (!cancelled && autoClose) {
        // A background refresh that can't go silent → give up quietly.
        setMessage('Could not refresh silently — open PRO TRACK and reconnect.')
        setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, targetUid, autoClose, writeToken])

  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <AuroraBackground />
      <GlassCard className="w-full max-w-sm p-8 text-center">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo className="h-12 w-12 drop-shadow-lg" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
            <Calendar className="h-6 w-6 text-accent" />
          </div>
        </div>

        {loading || state === 'connecting' ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
        ) : state === 'done' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold">Calendar Connected</h1>
            <p className="mt-2 text-sm text-muted">
              Synced to your PRO TRACK desktop app — you can close this tab.
            </p>
          </>
        ) : state === 'error' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h1 className="text-lg font-bold">Connection Failed</h1>
            <p className="mt-2 text-sm text-muted">{message}</p>
            <button onClick={connectInteractive} className="mt-5 text-sm text-accent hover:underline">
              Try again
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold">Sync Google Calendar</h1>
            <p className="mb-5 mt-2 text-sm text-muted">
              Connect PRO TRACK with Google Calendar to sync your schedule, events and holidays both ways.
            </p>
            <button
              onClick={connectInteractive}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow transition-all hover:bg-accent-hover"
            >
              Connect Google Calendar
            </button>
          </>
        )}
      </GlassCard>
    </div>
  )
}
