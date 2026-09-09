import { Modal } from '@/components/ui/Modal'
import { LogOut, ShieldCheck } from 'lucide-react'

export function ConfirmLogoutModal({ open, onClose, onConfirm, user }) {
  if (!open) return null

  const displayName = user?.displayName || user?.email || 'Explorer'
  const email = user?.email || ''
  const initial = (displayName[0] || 'U').toUpperCase()

  return (
    <Modal open={open} onClose={onClose} title="Sign Out Confirmation" className="max-w-md">
      <div className="p-6 space-y-5">
        {/* User Card Preview */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-line/60 bg-surface-2/40 p-3.5">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={displayName}
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-xl object-cover ring-2 ring-accent/20"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/20 font-display text-base font-bold text-accent">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold text-ink">{displayName}</p>
            {email && <p className="truncate font-mono text-[0.6875rem] text-muted">{email}</p>}
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h4 className="font-display text-base font-bold text-ink">Are you sure you want to sign out?</h4>
          <p className="text-xs leading-relaxed text-muted">
            Your active session will be ended. Your local encrypted cache, timetable, and custom preferences will remain safely stored on this device and restored upon your next sign-in.
          </p>
        </div>

        {/* Security Note */}
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-surface-2/20 px-3 py-2 text-[0.6875rem] text-muted">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>Local session tokens and caches are safely locked upon sign out.</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line/70 bg-surface-2/60 px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              onConfirm?.()
            }}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/40 bg-red-500/15 hover:bg-red-500/25 px-4 py-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors cursor-pointer shadow-xs"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
