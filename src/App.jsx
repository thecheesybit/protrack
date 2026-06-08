import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/common/AppLoader'
import { LandingPage } from '@/components/marketing/LandingPage'
import { QrLoginScreen } from '@/components/auth/QrLoginScreen'
import { LinkDevicePage } from '@/components/auth/LinkDevicePage'
import { LinkGcalPage } from '@/components/auth/LinkGcalPage'
import { PatreonApprovePage } from '@/components/patreon/PatreonApprovePage'
import { Workspace } from '@/components/layout/Workspace'
import { FirestoreSyncProvider } from '@/providers/FirestoreSyncProvider'
import { SetupRequired } from '@/components/common/SetupRequired'
import { useAutoUpdate } from '@/hooks/useAutoUpdate'
import { useFontScale } from '@/hooks/useFontScale'
import { TitleBar } from '@/desktop/TitleBar'
import { isDesktop, isWorkspaceHost } from '@/desktop/isDesktop'

function Routes() {
  const { user, loading, configured } = useAuth()

  // Hard short-circuit: if Firebase config wasn't baked in at build time,
  // never reach any code that touches `auth.X` (which would null-deref).
  if (!configured) return <SetupRequired key="setup" />

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'

  // Google Calendar auth gateway: /link-gcal?uid=<uid>
  if (pathname.startsWith('/link-gcal')) {
    return <LinkGcalPage key="link-gcal" />
  }

  // Mobile auth gateway: /link?s=<sessionId> — the only authenticated surface
  // the web build exposes (used by the QR handshake).
  if (pathname.startsWith('/link')) {
    return <LinkDevicePage key="link" />
  }

  // Admin-only contribution approval dashboard (its own Google sign-in + lock).
  if (pathname.startsWith('/patreon-approve')) {
    return <PatreonApprovePage key="patreon-approve" />
  }

  // The Netlify web domain is a gateway only — never the functional workspace.
  // Only the Electron app (or a DEV preview) renders the dashboard.
  if (!isWorkspaceHost) {
    return <LandingPage key="landing" />
  }

  // Anonymous = desktop QR-handshake bootstrap only; treat as "not signed in".
  const realUser = user && !user.isAnonymous ? user : null

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <AppLoader key="loader" />
      ) : realUser ? (
        <motion.div
          key="workspace"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          <FirestoreSyncProvider>
            <Workspace />
          </FirestoreSyncProvider>
        </motion.div>
      ) : (
        <QrLoginScreen key="qr" />
      )}
    </AnimatePresence>
  )
}

export default function App() {
  useAutoUpdate() // desktop-only: bridges Electron autoUpdater → Dynamic Island
  useFontScale() // mirrors uiSlice.fontScale → <html data-font-scale>

  return (
    <div className="flex h-full flex-col">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgb(var(--surface))',
            color: 'rgb(var(--text))',
            border: '1px solid rgb(var(--border))',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
          },
        }}
      />
      {isDesktop && <TitleBar />}
      <div className="min-h-0 flex-1">
        <Routes />
      </div>
    </div>
  )
}
