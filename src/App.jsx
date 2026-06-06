import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/common/AppLoader'
import { LandingPage } from '@/components/marketing/LandingPage'
import { QrLoginScreen } from '@/components/auth/QrLoginScreen'
import { LinkDevicePage } from '@/components/auth/LinkDevicePage'
import { Workspace } from '@/components/layout/Workspace'
import { FirestoreSyncProvider } from '@/providers/FirestoreSyncProvider'
import { UpdateGate } from '@/components/desktop/UpdateGate'
import { useAutoUpdate } from '@/hooks/useAutoUpdate'
import { TitleBar } from '@/desktop/TitleBar'
import { isDesktop, isWorkspaceHost } from '@/desktop/isDesktop'

function Routes() {
  const { user, loading } = useAuth()

  // Mobile auth gateway: /link?s=<sessionId> — the only authenticated surface
  // the web build exposes (used by the QR handshake).
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/link')) {
    return <LinkDevicePage key="link" />
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
  useAutoUpdate() // desktop-only: bridges Electron autoUpdater → UpdateGate

  return (
    <div className="flex h-full flex-col">
      {isDesktop && <UpdateGate />}
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
