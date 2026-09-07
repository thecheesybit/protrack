import { useState } from 'react'
import { motion } from 'framer-motion'
import { Calendar, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { GoogleAuthProvider } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { signInWithGooglePopup, friendlyAuthError } from '@/lib/authPopup'

export function LinkGcalPage() {
  const { user, loading } = useAuth()
  const qs = new URLSearchParams(window.location.search)
  const targetUid = qs.get('uid')
  
  const [state, setState] = useState('idle') // idle | connecting | done | error
  const [message, setMessage] = useState('')

  const handleConnect = async () => {
    setState('connecting')
    try {
      const provider = new GoogleAuthProvider()
      provider.addScope('https://www.googleapis.com/auth/calendar.events')
      provider.setCustomParameters({ prompt: 'consent' })
      
      // Retries once against the popup/third-party-cookie failure class
      // (auth/internal-error and friends). No redirect fallback here — this
      // flow needs the access token back in the same call, and a full
      // redirect-resume for it isn't wired up yet.
      const result = await signInWithGooglePopup(auth, provider)
      const credential = GoogleAuthProvider.credentialFromResult(result)
      const token = credential?.accessToken

      if (!token) {
        throw new Error('No calendar access token returned from Google.')
      }

      const signedInUid = result.user.uid

      if (targetUid && signedInUid !== targetUid) {
        throw new Error(
          `Connected account UID does not match the desktop app UID. Please sign in with the correct Google account. (Expected: ${targetUid.slice(0, 8)}..., got: ${signedInUid.slice(0, 8)}...)`
        );
      }

      // Write token securely to the user's Firestore handshake document
      const handshakeRef = doc(db, 'users', signedInUid, 'gcal', 'handshake')
      await setDoc(handshakeRef, {
        status: 'success',
        accessToken: token,
        expiresAt: Date.now() + 3599 * 1000,
        updatedAt: serverTimestamp()
      })

      setState('done')
    } catch (err) {
      console.error('[gcal-link] auth/sync failed', err)
      setMessage(friendlyAuthError(err))
      setState('error')
    }
  }

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

        {loading ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" />
        ) : state === 'done' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <h1 className="text-lg font-bold">Calendar Connected</h1>
            <p className="mt-2 text-sm text-muted">
              Google Calendar tokens have been securely synced to your PRO TRACK desktop app. You can close this tab now.
            </p>
          </>
        ) : state === 'error' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h1 className="text-lg font-bold">Connection Failed</h1>
            <p className="mt-2 text-sm text-muted">{message}</p>
            <button
              onClick={() => setState('idle')}
              className="mt-5 text-sm text-accent hover:underline"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold">Sync Google Calendar</h1>
            <p className="mb-5 mt-2 text-sm text-muted">
              Connect PRO TRACK with Google Calendar to sync your weekly timetable schedules and events.
            </p>
            <button
              onClick={handleConnect}
              disabled={state === 'connecting'}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow disabled:opacity-60 transition-all hover:bg-accent-hover"
            >
              {state === 'connecting' ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Connecting…
                </>
              ) : (
                'Connect Google Calendar'
              )}
            </button>
          </>
        )}
      </GlassCard>
    </div>
  )
}
