import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/common/AppLoader'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { QrLoginScreen } from '@/components/auth/QrLoginScreen'
import { LinkDevicePage } from '@/components/auth/LinkDevicePage'
import { Dashboard } from '@/components/layout/Dashboard'
import { FirestoreSyncProvider } from '@/providers/FirestoreSyncProvider'
import { TitleBar } from '@/desktop/TitleBar'
import { isDesktop } from '@/desktop/isDesktop'

function Routes() {
  const { user, loading } = useAuth()

  // Phone linking page (web): /link?s=<sessionId>
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/link')) {
    return <LinkDevicePage key="link" />
  }

  // Anonymous = desktop QR bootstrap only; treat as "not really signed in".
  const realUser = user && !user.isAnonymous ? user : null

  return (
    <AnimatePresence mode="wait">
      {loading ? (
        <AppLoader key="loader" />
      ) : realUser ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0, scale: 0.99 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          <FirestoreSyncProvider>
            <Dashboard />
          </FirestoreSyncProvider>
        </motion.div>
      ) : isDesktop ? (
        <QrLoginScreen key="qr" />
      ) : (
        <AuthScreen key="auth" />
      )}
    </AnimatePresence>
  )
}

export default function App() {
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
