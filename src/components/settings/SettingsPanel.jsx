import { useEffect, useState, lazy, Suspense, useMemo } from 'react'
import {
  Settings, Sun, Volume2, Film, Quote, KeyRound,
  RefreshCw, AlertTriangle, ShieldCheck, Lock, X, Loader2
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useStore } from '@/store/useStore'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import { cn } from '@/utils/cn'
import { APP_VERSION } from '@/lib/version'

// Lazy loaded tab components
const AccountTab = lazy(() => import('./tabs/AccountTab').then(m => ({ default: m.AccountTab })))
const SecurityTab = lazy(() => import('./tabs/SecurityTab').then(m => ({ default: m.SecurityTab })))
const AppearanceTab = lazy(() => import('./tabs/AppearanceTab').then(m => ({ default: m.AppearanceTab })))
const SoundTab = lazy(() => import('./tabs/SoundTab').then(m => ({ default: m.SoundTab })))
const FocusSceneTab = lazy(() => import('./tabs/FocusSceneTab').then(m => ({ default: m.FocusSceneTab })))
const ZenQuotesTab = lazy(() => import('./tabs/ZenQuotesTab').then(m => ({ default: m.ZenQuotesTab })))
const IntegrationsTab = lazy(() => import('./tabs/IntegrationsTab').then(m => ({ default: m.IntegrationsTab })))
const UpdatesTab = lazy(() => import('./tabs/UpdatesTab').then(m => ({ default: m.UpdatesTab })))
const SystemTab = lazy(() => import('./tabs/SystemTab').then(m => ({ default: m.SystemTab })))
const PrivacyTab = lazy(() => import('./tabs/PrivacyTab').then(m => ({ default: m.PrivacyTab })))

const TAB_GROUPS = [
  {
    group: 'Workspace',
    items: [
      { id: 'account', label: 'Account & Identity', icon: Settings },
      { id: 'appearance', label: 'Appearance & Themes', icon: Sun },
      { id: 'audio', label: 'Sound & Alerts', icon: Volume2 },
    ],
  },
  {
    group: 'Focus & Mind',
    items: [
      { id: 'scene', label: 'Focus Scenes', icon: Film },
      { id: 'zen', label: 'Zen & Quotes', icon: Quote },
      { id: 'integrations', label: 'Integrations & API', icon: KeyRound },
    ],
  },
  {
    group: 'Protection & System',
    items: [
      { id: 'security', label: 'Security & Lock', icon: Lock },
      { id: 'updates', label: 'Updates & Releases', icon: RefreshCw },
      { id: 'system', label: 'System & Shortcuts', icon: AlertTriangle },
      { id: 'legal', label: 'Privacy & Terms', icon: ShieldCheck },
    ],
  },
]

export function SettingsPanel() {
  const { user, deleteAccount } = useAuth()
  const { theme, setTheme, toggleTheme } = useTheme()
  const open = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const settings = useStore((s) => s.settings)
  const modes = useStore((s) => s.modes)
  const activeModeId = useStore((s) => s.activeModeId)
  const fontScale = useStore((s) => s.fontScale)
  const setFontScale = useStore((s) => s.setFontScale)
  const fontFamily = useStore((s) => s.fontFamily)
  const setFontFamily = useStore((s) => s.setFontFamily)
  const updateStatus = useStore((s) => s.updateStatus)
  const updateVersion = useStore((s) => s.updateVersion)
  const updateError = useStore((s) => s.updateError)
  const userDoc = useStore((s) => s.userDoc)
  const setWhatsNewOpen = useStore((s) => s.setWhatsNewOpen)
  const lockConfig = useStore((s) => s.lockConfig)
  const refreshLockConfig = useStore((s) => s.refreshLockConfig)
  const lockApp = useStore((s) => s.lockApp)

  const [activeTab, setActiveTab] = useState('audio')
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    if (open) {
      if (isDesktop && desktopBridge?.appInfo) {
        desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
      }
    }
  }, [open])

  // ESC key to close settings
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setSettingsOpen])

  const allTabs = useMemo(() => TAB_GROUPS.flatMap((g) => g.items), [])
  const currentTab = allTabs.find((t) => t.id === activeTab) || allTabs[0]
  const currentGroup = TAB_GROUPS.find((g) => g.items.some((i) => i.id === activeTab))?.group || 'Preferences'
  const ActiveIcon = currentTab.icon

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-3 sm:p-6 md:p-8"
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setSettingsOpen(false)} />

          {/* Main Elevated Modal Card */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="relative flex h-full w-full max-w-5xl max-h-[88vh] flex-col overflow-hidden rounded-3xl border border-line/80 bg-surface/95 shadow-2xl backdrop-blur-3xl md:flex-row"
          >
            {/* Sidebar Navigation */}
            <div className="flex w-full shrink-0 flex-col border-b border-line/60 bg-surface-2/20 md:w-56 lg:w-64 md:border-b-0 md:border-r">
              <div className="flex items-center gap-3 px-4 py-3 md:px-6 md:py-5 border-b border-line/40">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent shadow-glow-xs">
                  <Settings className="h-5 w-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="font-display font-bold tracking-tight text-ink text-base">
                    Settings
                  </h3>
                  <p className="font-mono text-[0.625rem] uppercase tracking-widest text-muted">
                    PRO TRACK v{APP_VERSION}
                  </p>
                </div>
              </div>

              {/* Navigation Tabs with Categorized Sections */}
              <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-y-auto md:p-4 no-scrollbar">
                {TAB_GROUPS.map((group) => (
                  <div key={group.group} className="flex flex-row md:flex-col shrink-0 gap-1 md:mb-3">
                    <span className="hidden md:block font-mono text-[0.625rem] font-bold uppercase tracking-widest text-muted/60 px-3.5 pt-1.5 pb-1 select-none">
                      {group.group}
                    </span>

                    {group.items.map((tab) => {
                      const TabIcon = tab.icon
                      const active = activeTab === tab.id
                      const hasUpdate = tab.id === 'updates' && (updateStatus === 'available' || updateStatus === 'downloaded')
                      const isLocked = tab.id === 'security' && Boolean(lockConfig?.enabled)

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            'group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 whitespace-nowrap cursor-pointer select-none md:w-full',
                            active
                              ? 'bg-accent/15 text-accent border border-accent/25 shadow-glow-xs'
                              : 'text-muted border border-transparent hover:bg-surface-2/60 hover:text-ink hover:border-line/40'
                          )}
                        >
                          {/* Active Glowing Indicator Bar */}
                          {active && (
                            <motion.span
                              layoutId="activeSettingTab"
                              className="hidden md:block absolute left-1 top-2.5 bottom-2.5 w-1 rounded-full bg-accent shadow-glow-sm"
                            />
                          )}

                          <TabIcon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-colors',
                              active ? 'text-accent' : 'text-muted group-hover:text-ink'
                            )}
                          />

                          <span className="font-sans flex-1 text-left truncate">{tab.label}</span>

                          {/* Dynamic Badges */}
                          {hasUpdate && (
                            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                          )}
                          {isLocked && !active && (
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </nav>
            </div>

            {/* Content Pane */}
            <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 md:p-8">
              {/* Header */}
              <div className="mb-6 flex items-center justify-between border-b border-line/40 pb-4 shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-glow-xs">
                    <ActiveIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink truncate leading-tight">
                      {currentTab.label}
                    </h2>
                    <p className="font-mono text-[0.6875rem] uppercase tracking-widest text-muted mt-0.5">
                      {currentGroup} · Preferences
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface-2/40 px-3 py-1.5 text-xs font-semibold text-muted transition-all hover:bg-surface-2 hover:border-line-2 hover:text-ink cursor-pointer shadow-xs active:scale-95"
                  aria-label="Close settings"
                  title="Close Settings (Esc)"
                >
                  <span className="hidden sm:inline font-sans text-xs">Close</span>
                  <kbd className="font-mono text-[0.625rem] text-muted/70 px-1 py-0.5 rounded border border-line/60 bg-surface">
                    ESC
                  </kbd>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Scrollable Tab Body */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2 no-scrollbar">
                <Suspense
                  fallback={
                    <div className="flex h-48 items-center justify-center">
                      <Loader2 className="h-7 w-7 animate-spin text-accent" />
                    </div>
                  }
                >
                  {activeTab === 'account' && (
                    <AccountTab
                      user={user}
                      userDoc={userDoc}
                      setSettingsOpen={setSettingsOpen}
                    />
                  )}
                  {activeTab === 'security' && (
                    <SecurityTab
                      user={user}
                      userDoc={userDoc}
                      lockConfig={lockConfig}
                      refreshLockConfig={refreshLockConfig}
                      lockApp={lockApp}
                      setSettingsOpen={setSettingsOpen}
                    />
                  )}
                  {activeTab === 'appearance' && (
                    <AppearanceTab
                      theme={theme}
                      setTheme={setTheme}
                      toggleTheme={toggleTheme}
                      fontScale={fontScale}
                      setFontScale={setFontScale}
                      fontFamily={fontFamily}
                      setFontFamily={setFontFamily}
                    />
                  )}
                  {activeTab === 'audio' && (
                    <SoundTab user={user} settings={settings} />
                  )}
                  {activeTab === 'scene' && (
                    <FocusSceneTab user={user} settings={settings} />
                  )}
                  {activeTab === 'zen' && (
                    <ZenQuotesTab user={user} settings={settings} />
                  )}
                  {activeTab === 'integrations' && (
                    <IntegrationsTab
                      user={user}
                      settings={settings}
                      modes={modes}
                      activeModeId={activeModeId}
                    />
                  )}
                  {activeTab === 'updates' && (
                    <UpdatesTab
                      appInfo={appInfo}
                      updateStatus={updateStatus}
                      updateVersion={updateVersion}
                      updateError={updateError}
                      setWhatsNewOpen={setWhatsNewOpen}
                    />
                  )}
                  {activeTab === 'system' && (
                    <SystemTab
                      user={user}
                      deleteAccount={deleteAccount}
                      setSettingsOpen={setSettingsOpen}
                      appInfo={appInfo}
                    />
                  )}
                  {activeTab === 'legal' && <PrivacyTab appInfo={appInfo} />}
                </Suspense>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
