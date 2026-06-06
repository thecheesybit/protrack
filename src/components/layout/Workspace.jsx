import { useStore } from '@/store/useStore'
import { AppLoader } from '@/components/common/AppLoader'
import { OnboardingGate } from '@/components/onboarding/OnboardingGate'
import { Dashboard } from '@/components/layout/Dashboard'

/**
 * Authenticated workspace root (desktop / dev preview only). Decides between the
 * first-run onboarding gate and the live dashboard based on the synced user doc.
 * Rendered inside FirestoreSyncProvider, so `settings` hydrates from Firestore.
 */
export function Workspace() {
  const settings = useStore((s) => s.settings)

  // null = user doc still loading; brief, then resolves.
  if (settings === null) return <AppLoader />

  const onboarded = Boolean(settings?.onboarding?.completedAt)
  return onboarded ? <Dashboard /> : <OnboardingGate />
}
