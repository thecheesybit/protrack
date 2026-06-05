import { motion } from 'framer-motion'
import { Sparkles, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { GlassCard } from '@/components/ui/GlassCard'

const FEATURES = [
  'Context-switching workspace modes',
  'Smart timetable · Google Calendar sync',
  'Gamified deep-focus & analytics',
  'AI companion powered by Gemini',
]

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  )
}

export function AuthScreen() {
  const { signIn, error, configured } = useAuth()

  return (
    <motion.div
      key="auth"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="relative flex h-full items-center justify-center p-6"
    >
      <AuroraBackground />

      <GlassCard className="w-full max-w-md overflow-hidden p-8 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 shadow-glow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">PRO TRACK</h1>
              <p className="text-xs text-muted">Your calm, all-in-one workspace</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold leading-snug">
            Everything you need,
            <br />
            <span className="text-gradient">on one calm board.</span>
          </h2>

          <ul className="mt-6 space-y-2.5">
            {FEATURES.map((f, i) => (
              <motion.li
                key={f}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.07 }}
                className="flex items-center gap-2.5 text-sm text-muted"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {f}
              </motion.li>
            ))}
          </ul>

          {!configured && (
            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Firebase isn&apos;t configured. Add your keys to{' '}
                <code className="rounded bg-black/30 px-1">.env</code> and
                restart the dev server.
              </span>
            </div>
          )}

          {error && (
            <p className="mt-4 text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={signIn}
            disabled={!configured}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-3.5 font-semibold text-gray-900 shadow-lg transition-all duration-200 hover:shadow-xl active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="mt-4 text-center text-xs text-muted">
            One click. We&apos;ll resume exactly where you left off.
          </p>
        </motion.div>
      </GlassCard>
    </motion.div>
  )
}
