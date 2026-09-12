import { useState, useEffect } from 'react'
import {
  Bell,
  BellOff,
  Sparkles,
  AlertCircle,
  AlarmClock,
  Timer,
  CalendarClock,
  Droplets,
  Layers,
  MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  areNotificationsEnabled,
  setDesktopNotificationsEnabled,
  ensureNotificationPermission,
  sendTestNotification,
  isNotificationPermissionDenied,
  isNotificationSupported,
  getNotificationCategories,
  setNotificationCategoryEnabled,
} from '@/lib/notify'
import { playNotificationChime } from '@/lib/sound'
import { updateSettings } from '@/services/userService'
import {
  SettingsSection,
  SettingsCard,
  SettingsToggleRow,
} from '../SettingsUI'

export function NotificationsTab({ user, settings }) {
  const [notifOn, setNotifOn] = useState(() => areNotificationsEnabled())
  const [permissionDenied, setPermissionDenied] = useState(() => isNotificationPermissionDenied())
  const [categories, setCategories] = useState(() => getNotificationCategories())

  useEffect(() => {
    if (settings?.desktopNotifications !== undefined) {
      const active = settings.desktopNotifications && !isNotificationPermissionDenied()
      setNotifOn(active)
      setDesktopNotificationsEnabled(active)
    }
    if (settings?.notificationCategories) {
      for (const [key, val] of Object.entries(settings.notificationCategories)) {
        setNotificationCategoryEnabled(key, Boolean(val))
      }
      setCategories(getNotificationCategories())
    }
  }, [settings])

  const handleToggleMaster = async (nextState) => {
    if (nextState) {
      if (!isNotificationSupported()) {
        toast.error('Desktop notifications are not supported in this environment.')
        return
      }
      const granted = await ensureNotificationPermission()
      if (granted) {
        setDesktopNotificationsEnabled(true)
        setNotifOn(true)
        setPermissionDenied(false)
        playNotificationChime()
        toast.success('Desktop notification alerts enabled')
        if (user?.uid) {
          updateSettings(user.uid, { desktopNotifications: true }).catch(console.error)
        }
      } else {
        setDesktopNotificationsEnabled(false)
        setNotifOn(false)
        setPermissionDenied(isNotificationPermissionDenied())
        toast.error('Desktop notification permission was denied by the system or browser.')
      }
    } else {
      setDesktopNotificationsEnabled(false)
      setNotifOn(false)
      toast('Desktop notifications muted', { icon: '🔕' })
      if (user?.uid) {
        updateSettings(user.uid, { desktopNotifications: false }).catch(console.error)
      }
    }
  }

  const handleToggleCategory = (categoryKey, nextVal) => {
    setNotificationCategoryEnabled(categoryKey, nextVal)
    const updated = { ...categories, [categoryKey]: nextVal }
    setCategories(updated)

    if (user?.uid) {
      updateSettings(user.uid, {
        notificationCategories: updated,
      }).catch(console.error)
    }

    toast.success(
      nextVal
        ? `${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} desktop alerts enabled`
        : `${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} desktop alerts muted`,
      { duration: 2500 }
    )
  }

  const handleSendTestAlert = () => {
    if (!notifOn) {
      toast.error('Enable desktop notifications first to send a test alert.')
      return
    }
    playNotificationChime()
    const notif = sendTestNotification()
    if (notif) {
      toast.success('Test desktop alert dispatched!')
    } else {
      toast.error('Could not dispatch desktop notification. Check OS/browser notification settings.')
    }
  }

  return (
    <div className="space-y-8 pb-4">
      {/* ── Master Desktop Notification Toggle ───────────────────────── */}
      <SettingsSection
        title="Desktop OS Notifications"
        description="Control system-level desktop banners that display in the Windows Action Center or macOS Notification Center."
      >
        <SettingsToggleRow
          icon={notifOn ? Bell : BellOff}
          title="Desktop Notification Banners"
          description="Receive native desktop banners even when ProTrack is minimized or running in the background."
          checked={notifOn}
          onChange={handleToggleMaster}
          badge={notifOn ? 'Active' : permissionDenied ? 'Blocked' : 'Muted'}
          badgeVariant={notifOn ? 'emerald' : permissionDenied ? 'amber' : 'muted'}
          actionSlot={
            notifOn ? (
              <button
                type="button"
                onClick={handleSendTestAlert}
                className="flex items-center gap-1.5 rounded-xl border border-line/80 bg-surface px-2.5 py-1 text-xs font-semibold text-muted hover:border-accent/50 hover:text-accent transition-all cursor-pointer shadow-xs active:scale-95"
                title="Send a test notification alert"
              >
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span>Test Alert</span>
              </button>
            ) : null
          }
        />

        {permissionDenied && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-xs text-amber-300">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-amber-200">
                Desktop notifications are currently blocked by system/browser
              </p>
              <p className="text-amber-300/80 leading-relaxed">
                System permissions have restricted notifications for ProTrack. To receive alarm and session completion banners, allow notifications in your Windows Notification Settings or browser site settings.
              </p>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* ── Granular Desktop Notification Channels ───────────────────── */}
      <SettingsSection
        title="Granular Desktop Channels"
        description="Filter which specific events are allowed to send desktop notifications to your OS."
      >
        <div className="space-y-3">
          <SettingsToggleRow
            icon={AlarmClock}
            title="Scheduled Alarms"
            description="Persistent, interactive desktop notification when an alarm time arrives with one-click window restore."
            checked={categories.alarms}
            onChange={(v) => handleToggleCategory('alarms', v)}
            disabled={!notifOn}
            badge={categories.alarms && notifOn ? 'Enabled' : 'Muted'}
            badgeVariant={categories.alarms && notifOn ? 'emerald' : 'muted'}
          />

          <SettingsToggleRow
            icon={Timer}
            title="Deep Focus & Break Completions"
            description="Celebration banner when a focus interval finishes and reminders when rest breaks expire."
            checked={categories.focus}
            onChange={(v) => handleToggleCategory('focus', v)}
            disabled={!notifOn}
            badge={categories.focus && notifOn ? 'Enabled' : 'Muted'}
            badgeVariant={categories.focus && notifOn ? 'emerald' : 'muted'}
          />

          <SettingsToggleRow
            icon={CalendarClock}
            title="Deadlines & Notes"
            description="Desktop notices for upcoming syllabus milestones and notes entering their 48-hour due window."
            checked={categories.deadlines}
            onChange={(v) => handleToggleCategory('deadlines', v)}
            disabled={!notifOn}
            badge={categories.deadlines && notifOn ? 'Enabled' : 'Muted'}
            badgeVariant={categories.deadlines && notifOn ? 'emerald' : 'muted'}
          />

          <SettingsToggleRow
            icon={Droplets}
            title="Hydration Alerts (Desktop)"
            description="Forward periodic water reminders to the desktop notification center (Dynamic Island nudges remain active in-app)."
            checked={categories.hydration}
            onChange={(v) => handleToggleCategory('hydration', v)}
            disabled={!notifOn}
            badge={categories.hydration && notifOn ? 'Enabled' : 'Off'}
            badgeVariant={categories.hydration && notifOn ? 'accent' : 'muted'}
          />
        </div>
      </SettingsSection>

      {/* ── In-App Notifications Overview ────────────────────────────── */}
      <SettingsSection
        title="In-App Notification Surfaces"
        description="ProTrack keeps day-to-day workflow cues inside the workspace so they never clutter your desktop."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <SettingsCard className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-ink">Dynamic Island</h5>
                <span className="text-[10px] text-muted">Fluid status capsule</span>
              </div>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Provides real-time, non-intrusive feedback for timer transitions, hourly chimes, network changes, and task cues without leaving your workspace.
            </p>
          </SettingsCard>

          <SettingsCard className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-ink">Routine & Habit Prompts</h5>
                <span className="text-[10px] text-emerald-400 font-medium">Purely In-App</span>
              </div>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Habit reminders and wellness cues are contained strictly within interactive in-app prompts with Snooze and Done actions—never pushed as desktop notification spam.
            </p>
          </SettingsCard>
        </div>
      </SettingsSection>
    </div>
  )
}
