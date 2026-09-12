import { useState, useEffect } from 'react'
import {
  Volume2,
  Bell,
  Droplets,
  HeartPulse,
  Play,
  AlertCircle,
  Sparkles,
  AudioLines,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  areNotificationsEnabled,
  setDesktopNotificationsEnabled,
  ensureNotificationPermission,
  sendTestNotification,
  isNotificationPermissionDenied,
} from '@/lib/notify'
import {
  soundsEnabled,
  setSoundsEnabled,
  playNotificationChime,
  playSuccess,
} from '@/lib/sound'
import { updateSettings } from '@/services/userService'
import {
  SettingsSection,
  SettingsCard,
  SettingsToggleRow,
  SettingsBadge,
  SettingsSegmentGroup,
} from '../SettingsUI'

export function SoundTab({ user, settings }) {
  // Desktop notifications: check both localStorage toggle AND permission
  const [notifOn, setNotifOn] = useState(() => areNotificationsEnabled())
  const [permissionDenied, setPermissionDenied] = useState(() => isNotificationPermissionDenied())

  // Sound effects toggle
  const [soundsOn, setSoundsOn] = useState(() => soundsEnabled())

  // Wellness settings
  const [hydration, setHydration] = useState(settings?.hydrationIntervalMin || 60)
  const [checkinsEnabled, setCheckinsEnabled] = useState(settings?.checkinsEnabled !== false)

  // Voice / hands-free
  const [wakeWordOn, setWakeWordOn] = useState(settings?.wakeWordEnabled === true)
  const [wakePhrase, setWakePhrase] = useState(settings?.wakeWord || 'hey track')

  useEffect(() => {
    setHydration(settings?.hydrationIntervalMin || 60)
    setCheckinsEnabled(settings?.checkinsEnabled !== false)
    setWakeWordOn(settings?.wakeWordEnabled === true)
    setWakePhrase(settings?.wakeWord || 'hey track')
    if (settings?.desktopNotifications !== undefined) {
      const active = settings.desktopNotifications && !isNotificationPermissionDenied()
      setNotifOn(active)
      setDesktopNotificationsEnabled(active)
    }
  }, [settings])

  // Toggle Desktop Notifications On / Off
  const handleToggleNotifications = async (nextState) => {
    if (nextState) {
      // User is attempting to turn notifications ON
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
        toast.error('Notification permission was not granted')
      }
    } else {
      // User is turning notifications OFF
      setDesktopNotificationsEnabled(false)
      setNotifOn(false)
      toast('Desktop notification alerts muted', { icon: '🔕' })
      if (user?.uid) {
        updateSettings(user.uid, { desktopNotifications: false }).catch(console.error)
      }
    }
  }

  // Send a test desktop alert
  const handleSendTestAlert = () => {
    if (!notifOn) {
      toast.error('Enable desktop notifications first to send a test alert')
      return
    }
    playNotificationChime()
    sendTestNotification()
    toast.success('Test desktop alert dispatched!')
  }

  // Toggle UI Sound FX
  const handleToggleSounds = (next) => {
    setSoundsOn(next)
    setSoundsEnabled(next)
    if (next) playSuccess()
  }

  const handlePreviewChime = (e) => {
    e.stopPropagation()
    playNotificationChime()
  }

  // Save Hydration Interval
  const handleSaveHydration = async (val) => {
    setHydration(val)
    if (user?.uid) {
      try {
        await updateSettings(user.uid, { hydrationIntervalMin: val })
      } catch (err) {
        console.error('[settings] hydration save failed', err)
      }
    }
  }

  // Toggle Daily Check-ins
  const handleToggleCheckins = async (next) => {
    setCheckinsEnabled(next)
    if (user?.uid) {
      try {
        await updateSettings(user.uid, { checkinsEnabled: next })
      } catch (err) {
        console.error('[settings] check-ins save failed', err)
      }
    }
  }

  // Toggle always-on wake word
  const handleToggleWakeWord = async (next) => {
    setWakeWordOn(next)
    if (next) toast('Say "' + wakePhrase + '" anytime to start a hands-free chat.', { icon: '🎙️' })
    if (user?.uid) {
      try {
        await updateSettings(user.uid, { wakeWordEnabled: next })
      } catch (err) {
        console.error('[settings] wake word save failed', err)
      }
    }
  }

  // Pick the wake phrase
  const handleSaveWakePhrase = async (val) => {
    setWakePhrase(val)
    if (user?.uid) {
      try {
        await updateSettings(user.uid, { wakeWord: val })
      } catch (err) {
        console.error('[settings] wake phrase save failed', err)
      }
    }
  }

  return (
    <div className="space-y-8 pb-4">
      {/* ── Desktop Notifications & Alerts ───────────────────────────── */}
      <SettingsSection
        title="Desktop Notifications Quick Switch"
        description="Quick master switch for OS-level banners. For granular category filtering, see the Notifications tab."
      >
        <SettingsToggleRow
          icon={Bell}
          title="Desktop Notification Alerts"
          description="Receive native OS banners even when ProTrack is minimized or running in the background."
          checked={notifOn}
          onChange={handleToggleNotifications}
          badge={notifOn ? 'Active' : permissionDenied ? 'Blocked' : 'Off'}
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
                System notifications are currently blocked
              </p>
              <p className="text-amber-300/80 leading-relaxed">
                Your browser or system settings have blocked notifications for ProTrack. To receive deadline and timer alerts, click the lock/settings icon in your browser URL bar and allow notifications.
              </p>
            </div>
          </div>
        )}
      </SettingsSection>

      {/* ── UI Audio & Chimes ────────────────────────────────────────── */}
      <SettingsSection
        title="Audio & Tactical Feedback"
        description="Harmonic acoustic cues that confirm task completion and focus interval transitions."
      >
        <SettingsToggleRow
          icon={Volume2}
          title="UI Sound Effects & Chimes"
          description="Gentle marimba bells, tactile clicks, and celebration chimes on to-do completions."
          checked={soundsOn}
          onChange={handleToggleSounds}
          badge={soundsOn ? 'Enabled' : 'Muted'}
          badgeVariant={soundsOn ? 'emerald' : 'muted'}
          actionSlot={
            soundsOn ? (
              <button
                type="button"
                onClick={handlePreviewChime}
                className="flex items-center gap-1.5 rounded-xl border border-line/80 bg-surface px-2.5 py-1 text-xs font-semibold text-muted hover:border-accent/50 hover:text-accent transition-all cursor-pointer shadow-xs active:scale-95"
                title="Preview sound chime"
              >
                <Play className="h-3 w-3 fill-current text-accent" />
                <span>Preview</span>
              </button>
            ) : null
          }
        />
      </SettingsSection>

      {/* ── Mind & Wellness Controls ─────────────────────────────────── */}
      <SettingsSection
        title="Wellness & Mindful Rhythm"
        description="Gentle environmental checks to maintain hydration, cognitive freshness, and daily clarity."
      >
        <SettingsCard>
          <div className="flex items-start gap-3.5 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent shadow-glow-xs">
              <Droplets className="h-4.5 w-4.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm font-semibold tracking-tight text-ink">
                  Hydration Reminder Frequency
                </span>
                <SettingsBadge variant={hydration === 0 ? 'muted' : 'accent'}>
                  {hydration === 0 ? 'Disabled' : `Every ${hydration}m`}
                </SettingsBadge>
              </div>
              <p className="mt-0.5 text-xs text-muted leading-relaxed font-sans">
                A subtle, non-intrusive notification reminding you to take a sip of water.
              </p>
            </div>
          </div>

          <SettingsSegmentGroup
            options={[
              { value: 30, label: '30 min' },
              { value: 45, label: '45 min' },
              { value: 60, label: '60 min' },
              { value: 90, label: '90 min' },
              { value: 0, label: 'Off' },
            ]}
            value={hydration}
            onChange={handleSaveHydration}
          />
        </SettingsCard>

        <SettingsToggleRow
          icon={HeartPulse}
          title="Mindful Daily Check-ins"
          description="One quick introspective prompt in the morning, midday, and evening to calibrate focus."
          checked={checkinsEnabled}
          onChange={handleToggleCheckins}
          badge={checkinsEnabled ? 'Active' : 'Off'}
          badgeVariant={checkinsEnabled ? 'emerald' : 'muted'}
        />
      </SettingsSection>

      {/* ── Voice & Hands-Free ───────────────────────────────────────── */}
      <SettingsSection
        title="Voice & Hands-Free Assistant"
        description="Run your entire workspace by voice — create tasks, start focus sessions, ask questions. Also available anytime from the AI Companion's Voice tab, or by double-clicking the assistant button."
      >
        <SettingsToggleRow
          icon={AudioLines}
          title="Always-listening Wake Word"
          description="Keep a background listener alive so a spoken wake phrase starts a hands-free conversation, like a smart speaker. Needs microphone access; on desktop the ambient listener uses Gemini transcription, so leave it off unless you want that."
          checked={wakeWordOn}
          onChange={handleToggleWakeWord}
          badge={wakeWordOn ? 'Listening' : 'Off'}
          badgeVariant={wakeWordOn ? 'emerald' : 'muted'}
        />

        {wakeWordOn && (
          <SettingsCard>
            <div className="flex items-start gap-3.5 mb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent shadow-glow-xs">
                <AudioLines className="h-4.5 w-4.5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-sans text-sm font-semibold tracking-tight text-ink">
                    Wake Phrase
                  </span>
                  <SettingsBadge variant="accent">&ldquo;{wakePhrase}&rdquo;</SettingsBadge>
                </div>
                <p className="mt-0.5 text-xs text-muted leading-relaxed font-sans">
                  Say this (optionally after &ldquo;hey&rdquo;) to wake the assistant.
                </p>
              </div>
            </div>

            <SettingsSegmentGroup
              options={[
                { value: 'hey track', label: 'Hey Track' },
                { value: 'track', label: 'Track' },
                { value: 'assistant', label: 'Assistant' },
                { value: 'computer', label: 'Computer' },
              ]}
              value={wakePhrase}
              onChange={handleSaveWakePhrase}
            />
          </SettingsCard>
        )}
      </SettingsSection>
    </div>
  )
}
