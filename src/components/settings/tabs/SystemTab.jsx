import { useState, useMemo } from 'react'
import {
  Command,
  ShieldAlert,
  Search,
  Keyboard,
  LayoutGrid,
  MonitorSmartphone,
  X,
  Bell,
  BellOff,
  Send,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'
import { isDesktop } from '@/desktop/isDesktop'
import { clearCalToken } from '@/services/calendarService'
import {
  areNotificationsEnabled,
  setDesktopNotificationsEnabled,
  ensureNotificationPermission,
  isNotificationSupported,
  notify,
} from '@/lib/notify'
import { SettingsSection, SettingsCard, SettingsBadge, SettingsShortcutRow } from '../SettingsUI'

function prettyAccelerator(acc) {
  if (!acc) return ''
  return acc
    .replace('CommandOrControl', 'Ctrl')
    .replace('Command', 'Cmd')
    .split('+')
    .map((s) => s.trim())
}

const NAVIGATION_SHORTCUTS = [
  { keys: ['T'], desc: 'Add to-do (focuses task input)', category: 'Quick Navigation' },
  { keys: ['C'], desc: 'Open Calendar & Timetable', category: 'Quick Navigation' },
  { keys: ['D'], desc: 'Open Deep Focus timer', category: 'Quick Navigation' },
  { keys: ['N'], desc: 'Open Scratchpad & Notes', category: 'Quick Navigation' },
  { keys: ['S'], desc: 'Open Subjects syllabus view', category: 'Quick Navigation' },
  { keys: ['E', '/', 'X'], desc: 'Open Scorecard (exams & mock tests)', category: 'Quick Navigation' },
  { keys: ['M'], desc: 'Maximize or restore active widget', category: 'Quick Navigation' },
]

const IN_APP_SHORTCUTS = [
  { keys: ['Ctrl / Cmd', '+', ','], desc: 'Open or close Settings panel', category: 'In-App Productivity' },
  { keys: ['Alt', '+', 'T'], desc: 'Quick cycle Indian seasonal theme', category: 'In-App Productivity' },
  { keys: ['Alt', '+', 'W'], desc: 'Open Weather Sandbox & Playground', category: 'In-App Productivity' },
  { keys: ['Ctrl / Cmd', '+', 'M'], desc: 'Mute or unmute ambient audio', category: 'In-App Productivity' },
  { keys: ['Ctrl / Cmd', '+', 'B'], desc: 'Toggle Workspaces bottom dock', category: 'In-App Productivity' },
  { keys: ['Ctrl / Cmd', '+', 'K'], desc: 'Open the AI study companion', category: 'In-App Productivity' },
  { keys: ['Ctrl / Cmd', '+', 'T'], desc: 'Center the clock (Zen Flip Clock)', category: 'In-App Productivity' },
  { keys: ['Alt', '+', 'A'], desc: 'Set Alarm or Countdown reminder', category: 'In-App Productivity' },
  { keys: ['F'], desc: 'Toggle fullscreen canvas', category: 'In-App Productivity' },
  { keys: ['Esc'], desc: 'Close top overlay (panel, modal, fullscreen)', category: 'In-App Productivity' },
  { keys: ['Double-click'], desc: 'Quick-add subject, to-do, or timetable cell', category: 'In-App Productivity' },
  { keys: ['?'], desc: 'Toggle keyboard shortcuts reference sheet', category: 'In-App Productivity' },
]

const WINDOW_CONTROLS = [
  { keys: ['Title bar'], desc: 'Minimize · Maximize · Close window controls', category: 'Window Control' },
  { keys: ['Hover top edge'], desc: 'Slide TopBar down when in fullscreen mode', category: 'Window Control' },
]

export function SystemTab({ user, deleteAccount, setSettingsOpen, appInfo }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteStage, setDeleteStage] = useState(0)
  const [deleteInput, setDeleteInput] = useState('')
  const [notifEnabled, setNotifEnabled] = useState(() => areNotificationsEnabled())
  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'unsupported'
  })

  const handleToggleNotifications = async (val) => {
    if (val && notifPermission !== 'granted') {
      if (!isNotificationSupported()) {
        // Distinct from "denied" — there's no browser permission prompt to
        // retry here at all, so the generic denied-by-browser message below
        // would be actively misleading.
        toast.error('Desktop notifications are not supported on this platform.')
        return
      }
      const granted = await ensureNotificationPermission()
      setNotifPermission(granted ? 'granted' : 'denied')
      if (!granted) {
        toast.error('Notification permission was not granted by browser.')
        return
      }
    }
    setNotifEnabled(val)
    setDesktopNotificationsEnabled(val)
    toast.success(val ? 'Desktop notifications enabled' : 'Desktop notifications disabled')
  }

  const handleSendTestNotification = () => {
    if (!areNotificationsEnabled()) {
      toast.error('Desktop notifications are currently disabled. Enable them first.')
      return
    }
    const n = notify('PRO TRACK Notification Test', 'Desktop notification alerts are operating properly!')
    if (n) {
      toast.success('Test notification dispatched!')
    } else {
      toast.error('Could not dispatch notification. Check browser/system permissions.')
    }
  }

  // Construct dynamic desktop hotkeys if registered in Electron appInfo
  const desktopShortcuts = useMemo(() => {
    const list = []
    if (appInfo?.shortcuts?.toggleWindow) {
      list.push({
        keys: prettyAccelerator(appInfo.shortcuts.toggleWindow),
        desc: 'Show / hide ProTrack window (OS-wide)',
        category: 'Desktop Global',
      })
    } else if (isDesktop) {
      list.push({
        keys: ['Ctrl', '+', 'Shift', '+', 'P'],
        desc: 'Show / hide ProTrack window (OS-wide)',
        category: 'Desktop Global',
      })
    }

    if (appInfo?.shortcuts?.toggleFocus) {
      list.push({
        keys: prettyAccelerator(appInfo.shortcuts.toggleFocus),
        desc: 'Pause / resume focus timer (OS-wide)',
        category: 'Desktop Global',
      })
    } else if (isDesktop) {
      list.push({
        keys: ['Ctrl', '+', 'Shift', '+', 'F'],
        desc: 'Pause / resume focus timer (OS-wide)',
        category: 'Desktop Global',
      })
    }

    if (appInfo?.shortcuts?.hideToTray) {
      list.push({
        keys: prettyAccelerator(appInfo.shortcuts.hideToTray),
        desc: 'Hide window to system tray',
        category: 'Desktop Global',
      })
    }

    if (appInfo?.shortcuts?.toggleMute) {
      list.push({
        keys: prettyAccelerator(appInfo.shortcuts.toggleMute),
        desc: 'Mute / unmute audio chimes',
        category: 'Desktop Global',
      })
    }

    return list
  }, [appInfo])

  // Combined searchable shortcuts list
  const allShortcuts = useMemo(() => {
    return [
      ...desktopShortcuts,
      ...NAVIGATION_SHORTCUTS,
      ...IN_APP_SHORTCUTS,
      ...WINDOW_CONTROLS,
    ]
  }, [desktopShortcuts])

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    return allShortcuts.filter(
      (s) =>
        s.desc.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q))
    )
  }, [searchQuery, allShortcuts])

  const handleDeleteWipe = async () => {
    if (deleteStage === 0) {
      setDeleteStage(1)
      setDeleteInput('')
      return
    }
    if (deleteStage === 1) {
      if (deleteInput !== 'WIPE') {
        toast.error("Please type 'WIPE' to confirm.")
        return
      }
      setDeleteStage(2)
      setDeleteInput('')
      return
    }
    if (deleteStage === 2) {
      if (deleteInput !== user?.email) {
        toast.error(`Please type '${user?.email}' exactly to confirm.`)
        return
      }
      try {
        localStorage.clear()
        sessionStorage.clear()
        clearCalToken()
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
    <div className="space-y-8 pb-4">
      {/* ── System Shortcuts & Hotkeys ─────────────────────────────── */}
      <SettingsSection
        title="Keyboard Shortcuts & Hotkeys"
        description="Comprehensive shortcut directory for rapid navigation, focus tools, and desktop control."
      >
        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search shortcuts by key or action (e.g. 'alarm', 'focus', 'T')..."
            className="w-full rounded-2xl border border-line/70 bg-surface-2/30 pl-10 pr-9 py-2.5 text-xs text-ink outline-none transition-colors focus:border-accent focus:bg-surface"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtered Results or Categorized Groups */}
        {filteredShortcuts ? (
          <SettingsCard className="space-y-2 p-5">
            <div className="flex items-center justify-between pb-2 border-b border-line/40">
              <span className="text-xs font-semibold text-ink">
                Search Results ({filteredShortcuts.length})
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-accent hover:underline"
              >
                Clear filter
              </button>
            </div>
            {filteredShortcuts.length > 0 ? (
              <div className="space-y-2">
                {filteredShortcuts.map((s, idx) => (
                  <SettingsShortcutRow
                    key={idx}
                    keys={s.keys}
                    description={s.desc}
                    category={s.category}
                  />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-muted">
                No shortcuts found matching "{searchQuery}".
              </p>
            )}
          </SettingsCard>
        ) : (
          <div className="space-y-5">
            {/* Desktop Global Hotkeys */}
            {desktopShortcuts.length > 0 && (
              <SettingsCard className="space-y-2.5 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Command className="h-3.5 w-3.5 text-accent" />
                  <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted">
                    Global Desktop Hotkeys (OS-Wide)
                  </span>
                </div>
                <div className="space-y-2">
                  {desktopShortcuts.map((s, idx) => (
                    <SettingsShortcutRow
                      key={idx}
                      keys={s.keys}
                      description={s.desc}
                    />
                  ))}
                </div>
              </SettingsCard>
            )}

            {/* Quick Navigation Keys */}
            <SettingsCard className="space-y-2.5 p-5">
              <div className="flex items-center gap-2 mb-1">
                <LayoutGrid className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted">
                  Quick Navigation Keys
                </span>
              </div>
              <div className="space-y-2">
                {NAVIGATION_SHORTCUTS.map((s, idx) => (
                  <SettingsShortcutRow
                    key={idx}
                    keys={s.keys}
                    description={s.desc}
                  />
                ))}
              </div>
            </SettingsCard>

            {/* In-App Productivity */}
            <SettingsCard className="space-y-2.5 p-5">
              <div className="flex items-center gap-2 mb-1">
                <Keyboard className="h-3.5 w-3.5 text-accent" />
                <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted">
                  In-App Productivity Commands
                </span>
              </div>
              <div className="space-y-2">
                {IN_APP_SHORTCUTS.map((s, idx) => (
                  <SettingsShortcutRow
                    key={idx}
                    keys={s.keys}
                    description={s.desc}
                  />
                ))}
              </div>
            </SettingsCard>

            {/* Window Controls */}
            {isDesktop && (
              <SettingsCard className="space-y-2.5 p-5">
                <div className="flex items-center gap-2 mb-1">
                  <MonitorSmartphone className="h-3.5 w-3.5 text-accent" />
                  <span className="font-mono text-[calc(0.6875rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted">
                    Window Controls & Interaction
                  </span>
                </div>
                <div className="space-y-2">
                  {WINDOW_CONTROLS.map((s, idx) => (
                    <SettingsShortcutRow
                      key={idx}
                      keys={s.keys}
                      description={s.desc}
                    />
                  ))}
                </div>
              </SettingsCard>
            )}
          </div>
        )}
      </SettingsSection>

      {/* ── Desktop Notification Alerts & OS Banners ───────────────── */}
      <SettingsSection
        title="Desktop Notification Alerts"
        description="Configure OS-level desktop banner alerts for alarms, focus sessions, and updates."
      >
        <SettingsCard className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                notifEnabled ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted'
              )}>
                {notifEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-ink">Desktop OS Notifications</span>
                  <SettingsBadge variant={notifEnabled ? 'emerald' : 'amber'}>
                    {notifEnabled ? 'Active' : 'Opted Out'}
                  </SettingsBadge>
                  {notifPermission === 'denied' && (
                    <SettingsBadge variant="rose">Blocked in Browser</SettingsBadge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Receive banner notifications for completed focus sessions, ringing alarms, hourly chimes, and system updates even when minimized.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="flex items-center gap-1.5 rounded-xl border border-line/70 bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent/50 hover:bg-surface-2 cursor-pointer shadow-xs"
              >
                <Send className="h-3.5 w-3.5 text-accent" />
                <span>Test Alert</span>
              </button>

              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={notifEnabled}
                  onChange={(e) => handleToggleNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-2 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-line/60"></div>
              </label>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Danger Zone & Account Purge ─────────────────────────────── */}
      <SettingsSection
        title="Danger Zone & Account Purge"
        description="Permanently delete your cloud workspace profile, study metrics, and local authentication tokens."
      >
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-5 sm:p-6 transition-all duration-200">
          <div className="flex items-start gap-3.5 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 mt-0.5">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-sm font-semibold text-rose-400">
                  Delete Account & Wipe Workspace
                </span>
                <SettingsBadge variant="rose">Irreversible</SettingsBadge>
              </div>
              <p className="mt-1 text-xs text-muted leading-relaxed font-sans">
                Wipes all cache tokens, settings overrides, Google Calendar connections, and permanently deletes all database nodes for this account.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {deleteStage === 1 && (
              <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-400">
                <p className="font-bold text-amber-300">Are you absolutely sure? (Step 1 of 2)</p>
                <p className="text-amber-400/90 leading-relaxed">
                  All syllabus milestones, focus sessions, and timetable slots will be erased forever.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink">
                    To proceed, type <span className="font-mono font-bold text-amber-400">WIPE</span>:
                  </label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="WIPE"
                    className="w-full rounded-xl border border-amber-500/40 bg-surface px-3.5 py-2 text-xs text-ink outline-none focus:border-amber-400 font-mono font-bold"
                  />
                </div>
              </div>
            )}

            {deleteStage === 2 && (
              <div className="space-y-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-400">
                <p className="font-bold text-rose-300">Critical Confirmation Required (Step 2 of 2)</p>
                <p className="text-rose-400/90 leading-relaxed">
                  This action cannot be undone. Enter your email to confirm deletion.
                </p>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-ink">
                    Type your email <span className="font-mono font-bold text-rose-400 select-all">{user?.email}</span>:
                  </label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder={user?.email}
                    className="w-full rounded-xl border border-rose-500/40 bg-surface px-3.5 py-2 text-xs text-ink outline-none focus:border-rose-400 font-mono font-bold"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleDeleteWipe}
              disabled={
                (deleteStage === 1 && deleteInput !== 'WIPE') ||
                (deleteStage === 2 && deleteInput !== user?.email)
              }
              className={cn(
                'flex w-full items-center justify-center rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
                deleteStage === 0 && 'border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20',
                deleteStage === 1 && 'bg-amber-500 text-white hover:bg-amber-600 shadow-glow-sm',
                deleteStage === 2 && 'bg-rose-600 text-white hover:bg-rose-700 shadow-glow-sm',
              )}
            >
              {deleteStage === 0 && 'Delete Account & Wipe Workspace'}
              {deleteStage === 1 && 'Confirm Step 1 of 2'}
              {deleteStage === 2 && 'Destroy Account Forever'}
            </button>

            {deleteStage > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDeleteStage(0)
                  setDeleteInput('')
                }}
                className="w-full text-center text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer py-1"
              >
                Cancel Deletion
              </button>
            )}
          </div>
        </div>
      </SettingsSection>
    </div>
  )
}
