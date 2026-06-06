import { useEffect, useState } from 'react'
import {
  Settings,
  Sun,
  Moon,
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

export function SettingsPanel() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
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
  const [appInfo, setAppInfo] = useState(null)

  useEffect(() => {
    if (open) {
      setKeyInput(getGeminiKey())
      setHydration(settings?.hydrationIntervalMin || 60)
      setNotifOn(
        typeof Notification !== 'undefined' && Notification.permission === 'granted',
      )
      if (isDesktop && desktopBridge?.appInfo) {
        desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
      }
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

  return (
    <Sheet
      open={open}
      onClose={() => setSettingsOpen(false)}
      title="Settings"
      icon={<Settings className="h-5 w-5 text-muted" />}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Appearance */}
        <Section title="Appearance" icon={theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}>
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-3.5 py-2.5 text-sm"
          >
            <span>Theme</span>
            <span className="font-medium capitalize text-accent">{theme}</span>
          </button>
        </Section>

        {/* Display — global typography scale (Compact / Standard / Large).
            Drives --root-font-size, so every rem in the app rescales. */}
        <Section title="Display" icon={<Type className="h-4 w-4" />}>
          <p className="mb-2 text-xs text-muted">
            Font size — applies to the whole workspace instantly.
          </p>
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
        </Section>

        {/* Gemini */}
        <Section title="AI · Gemini API key" icon={<KeyRound className="h-4 w-4" />}>
          <p className="mb-2 text-xs text-muted">
            Stored only on this device — never uploaded. Powers the AI companion
            and voice-note summaries.
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
            className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
          >
            Get a free key <ExternalLink className="h-3 w-3" />
          </a>
        </Section>

        {/* Wellness */}
        <Section title="Stay hydrated" icon={<Droplets className="h-4 w-4" />}>
          <p className="mb-2 text-xs text-muted">Remind me to drink water every…</p>
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
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={<Bell className="h-4 w-4" />}>
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
        </Section>

        {/* Global shortcuts (desktop) */}
        {isDesktop && appInfo?.shortcuts && (
          <Section title="Keyboard shortcuts" icon={<Keyboard className="h-4 w-4" />}>
            <div className="space-y-2">
              <ShortcutRow label="Show / hide window" acc={appInfo.shortcuts.toggleWindow} />
              <ShortcutRow label="Pause / resume focus" acc={appInfo.shortcuts.toggleFocus} />
            </div>
          </Section>
        )}

        {/* Changelog */}
        <Section title="Changelog" icon={<History className="h-4 w-4" />}>
          <div className="space-y-4">
            {CHANGELOG.map((release) => (
              <div key={release.version}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                    v{release.version}
                  </span>
                  <span className="text-xs text-muted">{release.date}</span>
                </div>
                <ul className="space-y-1">
                  {release.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2 text-xs text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        {/* Updates */}
        {isDesktop && (
          <Section title="Updates" icon={<DownloadCloud className="h-4 w-4" />}>
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
            {updateError && (
              <p className="mt-2 text-xs text-rose-400">{updateError}</p>
            )}
          </Section>
        )}

        {/* About + creator credit */}
        <Section title="About" icon={<Github className="h-4 w-4" />}>
          <p className="text-xs text-muted">
            PRO TRACK {appInfo?.version ? `v${appInfo.version}` : ''} — a calm, all-in-one productivity
            workspace.
          </p>
          <a
            href={CREATOR.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <Github className="h-3.5 w-3.5" />
            Crafted by {CREATOR.name}
            <ExternalLink className="h-3 w-3" />
          </a>
        </Section>

        <div className="px-5 py-4 text-center text-xs text-muted">
          PRO TRACK · signed in as {user?.email}
        </div>
      </div>
    </Sheet>
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
