import { useEffect, useState } from 'react'
import {
  Settings,
  Sun,
  Moon,
  Sunrise,
  Bell,
  KeyRound,
  Check,
  ExternalLink,
  Droplets,
  Keyboard,
  History,
  Github,
  Type,
  DownloadCloud,
  RefreshCw,
  AlertTriangle,
  Volume2,
  Calendar,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useStore } from '@/store/useStore'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { getGeminiKey, setGeminiKey, hasGeminiKey } from '@/services/geminiService'
import { updateSettings } from '@/services/userService'
import { ensureNotificationPermission } from '@/lib/notify'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import { CHANGELOG } from '@/content/changelog'
import { CREATOR } from '@/lib/constants'
import { cn } from '@/utils/cn'
import { isCalendarConnected, connectCalendar, clearCalToken } from '@/services/calendarService'

function prettyAccelerator(acc) {
  if (!acc) return ''
  return acc
    .replace('CommandOrControl', 'Ctrl')
    .replace('Space', 'Space')
    .split('+')
    .join(' + ')
}

function Section({ title, icon, children }) {
  return (
    <div className="border-b border-line/50 px-5 py-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function ShortcutRow({ label, acc }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line/60 bg-surface-2/30 px-3 py-2">
      <span className="text-sm text-muted">{label}</span>
      <kbd className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-ink">
        {prettyAccelerator(acc)}
      </kbd>
    </div>
  )
}

export function SettingsPanel() {
  const { user, deleteAccount } = useAuth()
  const { theme, setTheme, toggleTheme } = useTheme()
  const open = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const settings = useStore((s) => s.settings)
  const fontScale = useStore((s) => s.fontScale)
  const setFontScale = useStore((s) => s.setFontScale)
  const updateStatus = useStore((s) => s.updateStatus)
  const updateVersion = useStore((s) => s.updateVersion)
  const updateError = useStore((s) => s.updateError)
  const [checking, setChecking] = useState(false)

  const checkForUpdates = async () => {
    if (!isDesktop || !desktopBridge?.update?.check) return
    setChecking(true)
    try {
      const res = await desktopBridge.update.check()
      if (res?.ok) {
        if (res.version && res.version !== res.currentVersion) {
          toast.success(`Update available: v${res.version} — downloading…`)
        } else {
          toast.success(`You're on the latest version (v${res.currentVersion}).`)
        }
      } else {
        toast.error(res?.error || 'Could not check for updates.')
      }
    } catch (err) {
      toast.error(err.message || 'Update check failed.')
    } finally {
      setChecking(false)
    }
  }

  const [keyInput, setKeyInput] = useState('')
  const [hydration, setHydration] = useState(60)
  const [notifOn, setNotifOn] = useState(false)
  const [soundsOn, setSoundsOn] = useState(() => localStorage.getItem('protrack:sounds') !== 'false')
  const [appInfo, setAppInfo] = useState(null)
  
  // Google Calendar Connection state
  const [calConnected, setCalConnected] = useState(isCalendarConnected())
  
  // Double confirmation deletion state
  const [deleteStage, setDeleteStage] = useState(0)
  const [deleteInput, setDeleteInput] = useState('')

  useEffect(() => {
    if (open) {
      setKeyInput(getGeminiKey())
      setHydration(settings?.hydrationIntervalMin || 60)
      setNotifOn(
        typeof Notification !== 'undefined' && Notification.permission === 'granted',
      )
      setCalConnected(isCalendarConnected())
      if (isDesktop && desktopBridge?.appInfo) {
        desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
      }
    } else {
      setDeleteStage(0)
      setDeleteInput('')
    }
  }, [open, settings])

  const saveKey = () => {
    setGeminiKey(keyInput)
    toast.success(keyInput ? 'Gemini key saved' : 'Gemini key cleared')
  }

  const saveHydration = async (val) => {
    setHydration(val)
    try {
      await updateSettings(user.uid, { hydrationIntervalMin: val })
    } catch (err) {
      console.error('[settings] hydration save failed', err)
    }
  }

  const enableNotifications = async () => {
    const granted = await ensureNotificationPermission()
    setNotifOn(granted)
    toast[granted ? 'success' : 'error'](
      granted ? 'Notifications enabled' : 'Notifications blocked',
    )
  }

  const toggleSounds = () => {
    const next = !soundsOn
    setSoundsOn(next)
    // Save to both keys to be safe and compatible with different parts of the sound subsystem
    localStorage.setItem('protrack:sounds', next ? 'true' : 'false')
    localStorage.setItem('protrack:sounds_enabled', next ? 'true' : 'false')
  }

  const handleConnectCal = async () => {
    try {
      await connectCalendar()
      setCalConnected(true)
      toast.success('Google Calendar connected')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDisconnectCal = () => {
    clearCalToken()
    setCalConnected(false)
    toast.success('Google Calendar disconnected')
  }

  const handleDeleteWipe = async () => {
    if (deleteStage === 0) {
      setDeleteStage(1)
      return
    }
    if (deleteStage === 1) {
      setDeleteStage(2)
      return
    }
    if (deleteStage === 2) {
      if (deleteInput !== 'DELETE') {
        toast.error("Please type 'DELETE' exactly to confirm Wiping.")
        return
      }
      try {
        // Enforce total wipe of all storage keys
        localStorage.clear()
        sessionStorage.clear()
        
        // Unlink calendar local credentials
        clearCalToken()

        // Unlink cloud connection and delete user profile
        await deleteAccount()

        toast.success('Account deleted and workspace wiped successfully.')
        setDeleteStage(0)
        setDeleteInput('')
        setSettingsOpen(false)
      } catch (err) {
        toast.error(err.message || 'Failed to delete account.')
      }
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => setSettingsOpen(false)}
      title="Settings"
      icon={<Settings className="h-5 w-5 text-muted" />}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        
        {/* SECTION 1: Account Infrastructure */}
        <Section title="Account Infrastructure" icon={<Settings className="h-4 w-4 text-accent" />}>
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-surface-2/20 px-3.5 py-2.5 text-xs text-muted">
              Signed in as: <span className="font-semibold text-ink">{user?.email}</span>
            </div>
            
            {isDesktop && (
              <button
                onClick={checkForUpdates}
                disabled={checking || updateStatus === 'downloading' || updateStatus === 'ready'}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm transition-colors hover:border-accent/40 disabled:opacity-60"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
                  Check for updates
                </span>
                <span className="text-xs text-muted">
                  {updateStatus === 'checking' && 'Checking…'}
                  {updateStatus === 'up-to-date' && 'Up to date'}
                  {updateStatus === 'downloading' && `Downloading v${updateVersion}…`}
                  {updateStatus === 'ready' && `v${updateVersion} ready — restart`}
                  {updateStatus === 'error' && 'Check failed'}
                  {updateStatus === 'idle' && 'Click to check'}
                </span>
              </button>
            )}
            {updateError && (
              <p className="mt-1 text-xs text-rose-400">{updateError}</p>
            )}

            {isDesktop && appInfo?.shortcuts && (
              <div className="space-y-2">
                <ShortcutRow label="Show / hide window" acc={appInfo.shortcuts.toggleWindow} />
                <ShortcutRow label="Pause / resume focus" acc={appInfo.shortcuts.toggleFocus} />
              </div>
            )}

            <div className="flex flex-col gap-1 rounded-xl border border-line bg-surface-2/20 p-3 text-xs text-muted">
              <p>PRO TRACK {appInfo?.version ? `v${appInfo.version}` : ''} — a calm, all-in-one productivity workspace.</p>
              <a
                href={CREATOR.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
              >
                <Github className="h-3.5 w-3.5" />
                Crafted by {CREATOR.name}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </Section>

        {/* SECTION 2: Display & Chrono-Theme Configurations */}
        <Section title="Display & Chrono-Theme Configurations" icon={<Sun className="h-4 w-4 text-accent" />}>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Theme Preference</label>
              <button
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm"
              >
                <span>Theme</span>
                <span className="font-medium capitalize text-accent">{theme === 'auto' ? 'Auto (Time of Day)' : theme}</span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted">Workspace Scale</label>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Font size">
                {[
                  { key: 'compact', label: 'Compact' },
                  { key: 'standard', label: 'Standard' },
                  { key: 'large', label: 'Large' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    role="radio"
                    aria-checked={fontScale === opt.key}
                    onClick={() => setFontScale(opt.key)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-sm transition-colors',
                      fontScale === opt.key
                        ? 'border-accent/50 bg-accent/15 text-accent'
                        : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* SECTION 3: Audio Profiles & Event Chimes */}
        <Section title="Audio Profiles & Event Chimes" icon={<Volume2 className="h-4 w-4 text-accent" />}>
          <div className="space-y-4">
            <div className="space-y-2">
              <button
                onClick={toggleSounds}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm"
              >
                <span>UI Sound Effects & Event Chimes</span>
                <span className={cn('font-medium', soundsOn ? 'text-emerald-400' : 'text-muted')}>
                  {soundsOn ? 'Enabled' : 'Muted'}
                </span>
              </button>
              
              <button
                onClick={enableNotifications}
                disabled={notifOn}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm disabled:opacity-70"
              >
                <span>Desktop notifications</span>
                <span className={cn('font-medium', notifOn ? 'text-emerald-400' : 'text-accent')}>
                  {notifOn ? 'Enabled' : 'Enable'}
                </span>
              </button>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted font-medium">Hydration Check Frequency</label>
              <div className="flex gap-1.5">
                {[30, 45, 60, 90].map((m) => (
                  <button
                    key={m}
                    onClick={() => saveHydration(m)}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-sm transition-colors',
                      hydration === m
                        ? 'border-accent/50 bg-accent/15 text-accent'
                        : 'border-line text-muted hover:text-ink',
                    )}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* SECTION 4: Synchronization Keys */}
        <Section title="Synchronization Keys" icon={<KeyRound className="h-4 w-4 text-accent" />}>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Gemini API Key</label>
              <p className="mb-2 text-[11px] text-muted">
                Powers AI companion features and audio voice-recognition intakes.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIza…"
                  className="flex-1 rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                />
                <Button size="md" onClick={saveKey}>
                  {hasGeminiKey() ? <Check className="h-4 w-4" /> : 'Save'}
                </Button>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
              >
                Get a free key <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="border-t border-line/40 pt-4">
              <label className="mb-1 block text-xs font-semibold text-muted">Google Calendar Sync</label>
              <p className="mb-3 text-[11px] text-muted">
                Synchronizes weekly agenda items and tasks using Netlify Edge functions.
              </p>
              {calConnected ? (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs font-semibold text-emerald-500">
                    <Check className="h-4 w-4" /> Connected
                  </span>
                  <button
                    onClick={handleDisconnectCal}
                    className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:text-ink hover:border-accent"
                  >
                    Unlink Calendar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/20 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <Calendar className="h-4 w-4" /> Not Connected
                  </span>
                  <button
                    onClick={handleConnectCal}
                    className="rounded-lg bg-accent text-white px-3 py-1.5 text-xs font-semibold hover:bg-accent/90"
                  >
                    Connect Calendar
                  </button>
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* SECTION 5: Danger Zone (Data Erasure) */}
        <Section title="Danger Zone (Data Erasure)" icon={<AlertTriangle className="h-4 w-4 text-rose-500" />}>
          <div className="space-y-3">
            <p className="text-xs text-muted">
              Wipes all local cache tokens (`protrack:auth_core`), removes keys, and permanently deletes your cloud profile.
            </p>
            
            <div className="flex flex-col gap-2.5">
              {deleteStage === 1 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-500">
                  <p className="font-bold">Are you absolutely sure?</p>
                  <p className="mt-1">All syllabus progress and focus history will be lost forever.</p>
                </div>
              )}

              {deleteStage === 2 && (
                <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                  <p className="font-bold">Critical Confirmation Needed</p>
                  <label className="block mt-1">Please type <span className="font-mono font-bold select-all bg-black/25 px-1 py-0.5 rounded">DELETE</span> below:</label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    className="w-full rounded-lg border border-red-500/30 bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-red-500"
                  />
                </div>
              )}

              <button
                onClick={handleDeleteWipe}
                className={cn(
                  "flex w-full items-center justify-center rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
                  deleteStage === 0 && "border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
                  deleteStage === 1 && "bg-amber-500 text-white hover:bg-amber-600",
                  deleteStage === 2 && "bg-red-500 text-white hover:bg-red-600"
                )}
              >
                {deleteStage === 0 && "Delete Account & Wipe Workspace"}
                {deleteStage === 1 && "I Understand, Confirm Deletion"}
                {deleteStage === 2 && "Destroy Account & Wipe Cache"}
              </button>
            </div>
            
            {/* Interactive Changelog Window */}
            <div className="mt-5 border-t border-line/40 pt-4">
              <h4 className="text-xs font-semibold mb-2.5 flex items-center gap-1.5 text-ink">
                <History className="h-4 w-4 text-accent" /> Changelog & System History
              </h4>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-line bg-surface-2/30 p-3.5 text-xs space-y-4 shadow-inner">
                {CHANGELOG.map((c, idx) => (
                  <div key={idx} className="border-b border-line/30 pb-3 last:border-0 last:pb-0">
                    <div className="font-bold flex items-center gap-1.5 mb-1.5">
                      <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">v{c.version}</span>
                      {c.date && <span className="text-[10px] font-normal text-muted">{c.date}</span>}
                    </div>
                    {c.title && <div className="font-semibold text-ink/80 mb-1">{c.title}</div>}
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-muted">
                      {c.highlights.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <div className="px-5 py-4 text-center text-xs text-muted">
          PRO TRACK · signed in as {user?.email}
        </div>
      </div>
    </Sheet>
  )
}
