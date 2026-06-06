import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, Check, X, Loader2, Inbox } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import {
  subscribePendingContributions,
  approveContribution,
  declineContribution,
} from '@/services/patreonService'
import { ADMIN_EMAIL } from '@/lib/constants'

function fmtAmount(p) {
  return p.currency === 'USD' ? `$${p.amount}` : `₹${p.amount}`
}

function fmtTime(ts) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null
    return d ? d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
  } catch {
    return ''
  }
}

/**
 * Admin-only verification dashboard at /patreon-approve. Web is otherwise a
 * gateway, so this route carries its own Google sign-in + a strict identity
 * lock: only ADMIN_EMAIL (Google-verified) sees the queue — everyone else hits
 * a clean Access Denied. Firestore rules enforce the same server-side.
 */
export function PatreonApprovePage() {
  const { user, loading, signIn } = useAuth()
  const [pending, setPending] = useState([])
  const [busyId, setBusyId] = useState(null)

  const isAdmin = Boolean(user && user.email === ADMIN_EMAIL && !user.isAnonymous)

  useEffect(() => {
    if (!isAdmin) return undefined
    return subscribePendingContributions(setPending)
  }, [isAdmin])

  // Loading auth state.
  if (loading) {
    return (
      <div className="relative flex h-full items-center justify-center">
        <AuroraBackground />
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    )
  }

  // Not signed in → admin Google sign-in.
  if (!user || user.isAnonymous) {
    return (
      <div className="relative flex h-full items-center justify-center p-6">
        <AuroraBackground />
        <GlassCard className="w-full max-w-sm p-8 text-center">
          <Logo className="mx-auto mb-4 h-12 w-12" />
          <h1 className="text-lg font-bold">Admin sign-in</h1>
          <p className="mb-5 mt-2 text-sm text-muted">Verify your identity to review contributions.</p>
          <button
            onClick={signIn}
            className="w-full rounded-2xl bg-white px-5 py-3 font-semibold text-gray-900 shadow"
          >
            Continue with Google
          </button>
        </GlassCard>
      </div>
    )
  }

  // Signed in but not the admin → access denied.
  if (!isAdmin) {
    return (
      <div className="relative flex h-full items-center justify-center p-6">
        <AuroraBackground />
        <GlassCard className="w-full max-w-sm p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
            <ShieldAlert className="h-6 w-6 text-red-400" />
          </div>
          <h1 className="text-lg font-bold">Access denied</h1>
          <p className="mt-2 text-sm text-muted">This area is restricted to the PRO TRACK administrator.</p>
          <a href="/" className="mt-5 inline-block text-sm text-accent hover:underline">
            Back to PRO TRACK
          </a>
        </GlassCard>
      </div>
    )
  }

  const approve = async (p) => {
    setBusyId(p.id)
    try {
      await approveContribution(p)
    } catch (err) {
      console.error('[approve] failed', err)
    } finally {
      setBusyId(null)
    }
  }

  const decline = async (p) => {
    setBusyId(p.id)
    try {
      await declineContribution(p.id)
    } catch (err) {
      console.error('[decline] failed', err)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <AuroraBackground />
      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Contribution approvals</h1>
            <p className="text-xs text-muted">Signed in as {user.email}</p>
          </div>
          <span className="ml-auto rounded-full bg-surface-2/60 px-3 py-1 text-xs font-medium text-muted">
            {pending.length} pending
          </span>
        </header>

        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-line/60 py-16 text-center">
            <Inbox className="h-7 w-7 text-muted" />
            <p className="text-sm text-muted">No pending contributions right now.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pending.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="edge-light rounded-2xl border border-line/70 bg-surface/70 p-4 backdrop-blur-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                        {fmtAmount(p)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted">{p.email} · {fmtTime(p.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => decline(p)}
                      disabled={busyId === p.id}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition-colors hover:text-red-400 disabled:opacity-50"
                      aria-label="Decline"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => approve(p)}
                      disabled={busyId === p.id}
                      className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-50"
                    >
                      {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Approve
                    </button>
                  </div>
                </div>

                {(p.love || p.featureRequest) && (
                  <div className="mt-3 space-y-2 border-t border-line/50 pt-3">
                    {p.love && <p className="text-xs leading-relaxed text-muted">“{p.love}”</p>}
                    {p.featureRequest && (
                      <p className="rounded-lg bg-accent/10 px-2.5 py-1.5 text-[11px] text-accent">
                        Wants next: {p.featureRequest}
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
