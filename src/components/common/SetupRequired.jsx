import { AlertTriangle, Settings, ExternalLink } from 'lucide-react'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { GlassCard } from '@/components/ui/GlassCard'
import { Logo } from '@/components/common/Logo'

/**
 * Friendly fallback when the bundled Firebase config is missing — e.g. an
 * installer was built without VITE_FIREBASE_* env vars. Prevents the
 * `auth.currentUser` null-deref crash and points the user at the next step.
 */
export function SetupRequired() {
  return (
    <div className="relative flex h-full items-center justify-center p-6">
      <AuroraBackground />
      <GlassCard className="w-full max-w-lg p-8 sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="h-11 w-11 drop-shadow-lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Setup required</h1>
            <p className="text-xs text-muted">PRO TRACK can't reach its backend.</p>
          </div>
        </div>

        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-amber-100">
            This build is missing its Firebase configuration. Sign-in,
            sync, and AI features are disabled until it's provided.
          </p>
        </div>

        <div className="space-y-3 text-sm text-muted">
          <p>
            If you built this installer yourself, the GitHub Actions release
            pipeline needs these repository secrets to bake your Firebase config
            into the bundle:
          </p>
          <ul className="ml-1 space-y-1 font-mono text-xs">
            <li>· VITE_FIREBASE_API_KEY</li>
            <li>· VITE_FIREBASE_AUTH_DOMAIN</li>
            <li>· VITE_FIREBASE_PROJECT_ID</li>
            <li>· VITE_FIREBASE_STORAGE_BUCKET</li>
            <li>· VITE_FIREBASE_MESSAGING_SENDER_ID</li>
            <li>· VITE_FIREBASE_APP_ID</li>
          </ul>
          <p>
            Add them under{' '}
            <span className="font-mono text-xs">Settings → Secrets and variables → Actions</span>,
            then re-dispatch the release workflow.
          </p>
        </div>

        <a
          href="https://github.com/thecheesybit/protrack#configure"
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          <Settings className="h-3.5 w-3.5" />
          Configuration guide
          <ExternalLink className="h-3 w-3" />
        </a>
      </GlassCard>
    </div>
  )
}
