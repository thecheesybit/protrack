import { AnimatePresence, motion } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { AppLoader } from '@/components/common/AppLoader'
import { AuthScreen } from '@/components/auth/AuthScreen'
import { Dashboard } from '@/components/layout/Dashboard'
import { FirestoreSyncProvider } from '@/providers/FirestoreSyncProvider'

export default function App() {
  const { user, loading } = useAuth()

  return (
    <>
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

      <AnimatePresence mode="wait">
        {loading ? (
          <AppLoader key="loader" />
        ) : user ? (
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
        ) : (
          <AuthScreen key="auth" />
        )}
      </AnimatePresence>
    </>
  )
}
