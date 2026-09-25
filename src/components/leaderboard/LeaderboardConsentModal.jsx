import { useState } from 'react'
import { Trophy, Globe, EyeOff } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { updateSettings } from '@/services/userService'
import { LEADERBOARD_OPT_OUT_ENABLED, needsLeaderboardNotice } from '@/lib/leaderboard'

/**
 * One-time disclosure for the public focus leaderboard.
 *
 * The leaderboard is ON by default, but the app also promises strong privacy, so
 * existing users must be told BEFORE anything is published (nothing is published
 * until `leaderboardNoticeSeen` is true — see useLeaderboardPublish). This shows
 * once, lets the user keep it on or turn it off, and never nags again.
 *
 * While opt-out is paused (`LEADERBOARD_OPT_OUT_ENABLED === false`) it is a
 * notice only — one "Got it" button — and it is re-shown to anyone who had
 * previously opted out, clearing that flag once they acknowledge.
 */
export function LeaderboardConsentModal() {
  const { user } = useAuth()
  const uid = user?.uid
  const settings = useStore((s) => s.settings)
  const [dismissed, setDismissed] = useState(false)

  const open = !dismissed && needsLeaderboardNotice(settings)

  const acknowledge = async (optOut) => {
    setDismissed(true)
    if (!uid) return
    try {
      await updateSettings(uid, {
        leaderboardNoticeSeen: true,
        ...(optOut && LEADERBOARD_OPT_OUT_ENABLED
          ? { leaderboardOptOut: true }
          : settings?.leaderboardOptOut === true
            ? { leaderboardOptOut: false }
            : {}),
      })
    } catch (err) {
      console.warn('[leaderboard] consent save failed', err)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => acknowledge(false)}
      title="Join the Forest Leaderboard"
      footer={
        <>
          {LEADERBOARD_OPT_OUT_ENABLED && (
            <button
              type="button"
              onClick={() => acknowledge(true)}
              className="flex items-center gap-1.5 rounded-xl border border-line/70 px-3.5 py-2 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <EyeOff className="h-4 w-4" />
              Keep me private
            </button>
          )}
          <button
            type="button"
            onClick={() => acknowledge(false)}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-accent to-accent-2 px-4 py-2 text-sm font-bold text-white shadow-glow-sm transition-transform hover:scale-[1.02]"
          >
            <Trophy className="h-4 w-4" />
            {LEADERBOARD_OPT_OUT_ENABLED ? 'Join the board' : 'Got it'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-ink/85">
        <div className="flex items-center gap-2 text-accent">
          <Globe className="h-5 w-5" />
          <span className="font-semibold">Compare forests with other focusers</span>
        </div>
        <p>
          A new public leaderboard ranks foresters by weekly &amp; monthly focus time. Others
          can see your <span className="font-semibold text-ink">display name, focus minutes,
          plant counts, streak, and forest snapshot</span>.
        </p>
        <p className="text-muted">
          Your subjects, to-dos, scores, and everything else stay completely private — only the
          display-safe summary above is ever shared.
        </p>
        {LEADERBOARD_OPT_OUT_ENABLED ? (
          <p className="text-xs text-muted">
            It's on by default. You can turn it off anytime in{' '}
            <span className="font-semibold text-ink">Settings → Privacy</span>.
          </p>
        ) : (
          <p className="text-xs text-muted">
            The leaderboard is on for everyone right now — opting out is temporarily paused.
          </p>
        )}
      </div>
    </Modal>
  )
}
