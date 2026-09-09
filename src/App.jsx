import { lazy, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/common/AppLoader'
import { FirestoreSyncProvider } from '@/providers/FirestoreSyncProvider'
import { SetupRequired } from '@/components/common/SetupRequired'
import { useAutoUpdate } from '@/hooks/useAutoUpdate'
import { useFontScale } from '@/hooks/useFontScale'
import { useMinLoadTime } from '@/hooks/useMinLoadTime'
import { TitleBar } from '@/desktop/TitleBar'
import { isDesktop, isWorkspaceHost } from '@/desktop/isDesktop'
import { AppLockOverlay } from '@/components/lock/AppLockOverlay'
import { useAppLock } from '@/hooks/useAppLock'
import { useStore } from '@/store/useStore'
import { useChronoTheme } from '@/hooks/useChronoTheme'

const loadLandingPage = () => import('@/components/marketing/LandingPage').then((m) => ({ default: m.LandingPage }))
const loadQrLoginScreen = () => import('@/components/auth/QrLoginScreen').then((m) => ({ default: m.QrLoginScreen }))
const loadLinkDevicePage = () => import('@/components/auth/LinkDevicePage').then((m) => ({ default: m.LinkDevicePage }))
const loadLinkGcalPage = () => import('@/components/auth/LinkGcalPage').then((m) => ({ default: m.LinkGcalPage }))
const loadPatreonApprovePage = () => import('@/components/patreon/PatreonApprovePage').then((m) => ({ default: m.PatreonApprovePage }))
const loadWorkspace = () => import('@/components/layout/Workspace').then((m) => ({ default: m.Workspace }))

const LandingPage = lazy(loadLandingPage)
const QrLoginScreen = lazy(loadQrLoginScreen)
const LinkDevicePage = lazy(loadLinkDevicePage)
const LinkGcalPage = lazy(loadLinkGcalPage)
const PatreonApprovePage = lazy(loadPatreonApprovePage)
const Workspace = lazy(loadWorkspace)

// Eagerly prefetch workspace and auth chunks during the initial load window
if (typeof window !== 'undefined') {
  loadWorkspace()
  loadQrLoginScreen()
}

function Routes() {
  const { user, loading, configured } = useAuth()
  const minLoadTimeElapsed = useMinLoadTime(2500)
  const isAppLoading = loading || !minLoadTimeElapsed

  // Hard short-circuit: if Firebase config wasn't baked in at build time,
  // never reach any code that touches `auth.X` (which would null-deref).
  if (!configured) return <SetupRequired key="setup" />

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'

  // Google Calendar auth gateway: /link-gcal?uid=<uid>
  if (pathname.startsWith('/link-gcal')) {
    return (
      <Suspense fallback={null}>
        <LinkGcalPage key="link-gcal" />
      </Suspense>
    )
  }

  // Mobile auth gateway: /link?s=<sessionId> — the only authenticated surface
  // the web build exposes (used by the QR handshake).
  if (pathname.startsWith('/link')) {
    return (
      <Suspense fallback={null}>
        <LinkDevicePage key="link" />
      </Suspense>
    )
  }

  // Admin-only contribution approval dashboard (its own Google sign-in + lock).
  if (pathname.startsWith('/patreon-approve')) {
    return (
      <Suspense fallback={null}>
        <PatreonApprovePage key="patreon-approve" />
      </Suspense>
    )
  }

  // The Netlify web domain is a gateway only — never the functional workspace.
  // Only the Electron app (or a DEV preview) renders the dashboard.
  if (!isWorkspaceHost) {
    return (
      <Suspense fallback={null}>
        <LandingPage key="landing" />
      </Suspense>
    )
  }

  // Anonymous = desktop QR-handshake bootstrap only; treat as "not signed in".
  const realUser = user && !user.isAnonymous ? user : null

  return (
    <AnimatePresence mode="wait">
      {isAppLoading ? (
        <AppLoader key="app-loader" />
      ) : realUser ? (
        <motion.div
          key="workspace"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="h-full"
        >
          <Suspense fallback={null}>
            <Workspace />
          </Suspense>
        </motion.div>
      ) : (
        <motion.div
          key="qr"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="h-full"
        >
          <Suspense fallback={null}>
            <QrLoginScreen />
          </Suspense>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  useChronoTheme() // time-of-day palette & celestial slot sync across all screens
  useAutoUpdate() // desktop-only: bridges Electron autoUpdater → Dynamic Island
  useFontScale() // mirrors uiSlice.fontScale → <html data-font-scale>
  useAppLock() // manages app lock triggers (cold start, minimize, close, storage sync)
  const isLocked = useStore((s) => s.isLocked)

  return (
    <FirestoreSyncProvider>
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
        <div
          className={`min-h-0 flex-1 ${
            isLocked ? 'pointer-events-none select-none invisible' : ''
          }`}
          aria-hidden={isLocked}
        >
          <Routes />
        </div>
        <AppLockOverlay />
      </div>
    </FirestoreSyncProvider>
  )
}
