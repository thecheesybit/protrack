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
  Film,
  Quote,
  ChevronDown,
  X,
  ShieldCheck,
  RotateCcw,
  Loader2,
  Lock,
  Shield,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/Button'
import {
  setLockConfig,
  disableLock,
  changePin,
  updateLockTriggers,
  isValidPin,
} from '@/services/lockService'
import { deriveUniqueCode, initSessionFromAccount } from '@/services/cryptoService'
import lockImg from '@/assets/lock.gif'
import {
  getGeminiKey, setGeminiKey,
  getElevenLabsKey, setElevenLabsKey,
  getOpenAIKey, setOpenAIKey,
  getAnthropicKey, setAnthropicKey,
  getDeepSeekKey, setDeepSeekKey,
  hasApiKey
} from '@/services/geminiService'
import { updateSettings, updateProfile, resetAllUserData } from '@/services/userService'
import {
  CHRONO_SLOTS,
  CHRONO_OVERRIDE_KEY,
  CHRONO_OVERRIDE_EVENT,
  readChronoOverride,
} from '@/hooks/useChronoTheme'
import { ensureNotificationPermission } from '@/lib/notify'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import { CHANGELOG } from '@/content/changelog'
import { CREATOR } from '@/lib/constants'
import { APP_VERSION } from '@/lib/version'
import { VIDEO_PRESETS, youtubeId, toCanonicalYouTubeUrl } from '@/lib/focusScenes'
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

function Section({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-line/50">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-surface-2/30"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
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

function renderMarkdownInline(text) {
  if (!text) return ''
  const parts = []
  let lastIndex = 0
  const regex = /(\*\*.*?\*\*|`.*?`)/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index
    const matchText = match[0]

    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex))
    }

    if (matchText.startsWith('**') && matchText.endsWith('**')) {
      const boldContent = matchText.slice(2, -2)
      parts.push(
        <strong key={matchIndex} className="font-semibold text-ink">
          {boldContent}
        </strong>
      )
    } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
      const codeContent = matchText.slice(1, -1)
      parts.push(
        <code key={matchIndex} className="rounded bg-accent/15 px-1 py-0.2 text-[10px] text-accent font-mono border border-accent/10">
          {codeContent}
        </code>
      )
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }

  return parts
}

export function SettingsPanel() {
  const { user, deleteAccount } = useAuth()
  const { theme, setTheme, toggleTheme } = useTheme()
  const open = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const settings = useStore((s) => s.settings)
  const fontScale = useStore((s) => s.fontScale)
  const setFontScale = useStore((s) => s.setFontScale)
  const fontFamily = useStore((s) => s.fontFamily)
  const setFontFamily = useStore((s) => s.setFontFamily)
  const updateStatus = useStore((s) => s.updateStatus)
  const updateVersion = useStore((s) => s.updateVersion)
  const updateError = useStore((s) => s.updateError)
  const userDoc = useStore((s) => s.userDoc)
  const [checking, setChecking] = useState(false)
  const [activeTab, setActiveTab] = useState('account')

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

  // Deep Focus video
  const [focusUrlInput, setFocusUrlInput] = useState('')
  const [focusVideoEnabled, setFocusVideoEnabled] = useState(true)
  const [customPresets, setCustomPresets] = useState([])
  const [newPresetUrl, setNewPresetUrl] = useState('')
  const [newPresetLabel, setNewPresetLabel] = useState('')

  // Daily check-ins
  const [checkinsEnabled, setCheckinsEnabled] = useState(true)

  // DEV-only chrono slot preview (drives useChronoTheme via localStorage)
  const [chronoOverride, setChronoOverrideState] = useState(() => readChronoOverride())
  const setChronoOverride = (slot) => {
    try {
      if (slot) localStorage.setItem(CHRONO_OVERRIDE_KEY, slot)
      else localStorage.removeItem(CHRONO_OVERRIDE_KEY)
    } catch {
      /* private mode — preview just won't persist */
    }
    setChronoOverrideState(slot)
    window.dispatchEvent(new Event(CHRONO_OVERRIDE_EVENT))
  }

  // Zen & Motivation
  const [zenEnabled, setZenEnabled] = useState(true)
  const [zenDurationSec, setZenDurationSec] = useState(60)
  const [zenCategories, setZenCategories] = useState(['stoic', 'philosophy', 'productivity', 'proverbs', 'hindi_urdu', 'modern'])
  const [zenVoiceEnabled, setZenVoiceEnabled] = useState(true)

  // Google Calendar Connection state
  const [calConnected, setCalConnected] = useState(isCalendarConnected())

  // Double confirmation deletion state (System wipe)
  const [deleteStage, setDeleteStage] = useState(0)
  const [deleteInput, setDeleteInput] = useState('')

  // Reset account data state (Account tab)
  const [resetStage, setResetStage] = useState(0)
  const [resetInput, setResetInput] = useState('')
  const [resetting, setResetting] = useState(false)

  // Profile fields state
  const [profileFirstName, setProfileFirstName] = useState('')
  const [profileLastName, setProfileLastName] = useState('')
  const [profileAge, setProfileAge] = useState('')
  const [profileGender, setProfileGender] = useState('male')
  const [profilePhoto, setProfilePhoto] = useState('')

  // Other AI Provider Keys state
  const [openaiInput, setOpenaiInput] = useState('')
  const [anthropicInput, setAnthropicInput] = useState('')
  const [elevenlabsInput, setElevenlabsInput] = useState('')
  const [deepseekInput, setDeepseekInput] = useState('')
  const [expandedProvider, setExpandedProvider] = useState(null)
  const [aiPreferred, setAiPreferred] = useState('auto')

  // App Lock State
  const lockConfig = useStore((s) => s.lockConfig)
  const refreshLockConfig = useStore((s) => s.refreshLockConfig)
  const lockApp = useStore((s) => s.lockApp)

  const [lockModalMode, setLockModalMode] = useState(null) // 'enable' | 'change' | 'disable' | null
  const [lockCurrentPin, setLockCurrentPin] = useState('')
  const [lockNewPin, setLockNewPin] = useState('')
  const [lockConfirmPin, setLockConfirmPin] = useState('')
  const [lockHint, setLockHint] = useState('')
  const [lockOnMinPref, setLockOnMinPref] = useState(true)
  const [lockOnClosePref, setLockOnClosePref] = useState(true)
  const [lockError, setLockError] = useState('')
  const [lockSubmitting, setLockSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setKeyInput(getGeminiKey())
      setOpenaiInput(getOpenAIKey())
      setAnthropicInput(getAnthropicKey())
      setElevenlabsInput(getElevenLabsKey())
      setDeepseekInput(getDeepSeekKey())
      setAiPreferred(localStorage.getItem('protrack:ai_preferred_provider') || 'auto')
      setHydration(settings?.hydrationIntervalMin || 60)
      setNotifOn(
        typeof Notification !== 'undefined' && Notification.permission === 'granted',
      )
      setCalConnected(isCalendarConnected())
      setFocusUrlInput(settings?.focusAudioUrl || '')
      setFocusVideoEnabled(settings?.focusVideoEnabled !== false)
      setCustomPresets(settings?.customPresets || [])
      setCheckinsEnabled(settings?.checkinsEnabled !== false)
      setZenEnabled(settings?.zenEnabled !== false)
      setZenDurationSec(Math.round((settings?.zenDuration || 60000) / 1000))
      
      const allCats = ['stoic', 'philosophy', 'productivity', 'proverbs', 'hindi_urdu', 'modern']
      setZenCategories(settings?.zenCategories || allCats)
      setZenVoiceEnabled(settings?.zenVoiceEnabled !== false)
      
      // Initialize profile fields on settings load
      let fName = userDoc?.profile?.firstName || ''
      let lName = userDoc?.profile?.lastName || ''
      if (!fName && !lName) {
        const dName = userDoc?.profile?.displayName || user?.displayName || ''
        const parts = dName.trim().split(/\s+/)
        fName = parts[0] || 'Explorer'
        lName = parts.slice(1).join(' ') || ''
      }
      setProfileFirstName(fName)
      setProfileLastName(lName)
      setProfileAge(userDoc?.profile?.age || '')
      setProfileGender(userDoc?.profile?.gender || 'male')
      
      // Auto take Google photo URL if present and local photoURL is empty
      const googlePhoto = user?.photoURL || ''
      const currentPhoto = userDoc?.profile?.photoURL || googlePhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`
      setProfilePhoto(currentPhoto)
      
      if (isDesktop && desktopBridge?.appInfo) {
        desktopBridge.appInfo().then(setAppInfo).catch(() => setAppInfo(null))
      }
    } else {
      setDeleteStage(0)
      setDeleteInput('')
      setResetStage(0)
      setResetInput('')
    }
  }, [open, settings, userDoc, user])

  const handleResetAccount = async () => {
    if (resetInput.trim() !== 'RESET') {
      toast.error("Please type 'RESET' to confirm.")
      return
    }
    setResetting(true)
    try {
      await resetAllUserData(user.uid, user)
      toast.success('Account data wiped. Starting brand new!')
      setResetStage(0)
      setResetInput('')
      setSettingsOpen(false)
      useStore.getState().reset?.()
      useStore.getState().setModes?.([])
      useStore.getState().setActiveModeId?.(null)
    } catch (err) {
      console.error('[settings] reset account failed', err)
      toast.error('Failed to reset account data: ' + (err.message || 'Unknown error'))
    } finally {
      setResetting(false)
    }
  }

  const saveProfile = async () => {
    try {
      const displayName = `${profileFirstName.trim()} ${profileLastName.trim()}`.trim()
      await updateProfile(user.uid, {
        firstName: profileFirstName.trim(),
        lastName: profileLastName.trim(),
        displayName,
        age: Number(profileAge) || '',
        gender: profileGender,
        photoURL: profilePhoto,
      })
      toast.success('Profile updated successfully')
    } catch (err) {
      toast.error('Failed to update profile: ' + err.message)
    }
  }

  const saveKey = () => {
    setGeminiKey(keyInput)
    toast.success(keyInput ? 'Gemini key saved' : 'Gemini key cleared')
  }

  const saveOpenAIKey = () => {
    setOpenAIKey(openaiInput)
    toast.success(openaiInput ? 'OpenAI key saved' : 'OpenAI key cleared')
  }

  const saveAnthropicKey = () => {
    setAnthropicKey(anthropicInput)
    toast.success(anthropicInput ? 'Anthropic key saved' : 'Anthropic key cleared')
  }

  const saveElevenLabsKey = () => {
    setElevenLabsKey(elevenlabsInput)
    toast.success(elevenlabsInput ? 'ElevenLabs key saved' : 'ElevenLabs key cleared')
  }

  const saveDeepSeekKey = () => {
    setDeepSeekKey(deepseekInput)
    toast.success(deepseekInput ? 'DeepSeek key saved' : 'DeepSeek key cleared')
  }

  const savePreferredProvider = (val) => {
    setAiPreferred(val)
    localStorage.setItem('protrack:ai_preferred_provider', val)
    toast.success(`Preferred AI provider set to ${val === 'auto' ? 'Automatic' : val}`)
  }

  const toggleZenCategory = async (cat) => {
    let next = [...zenCategories]
    if (next.includes(cat)) {
      if (next.length > 1) {
        next = next.filter((c) => c !== cat)
      } else {
        toast.error('At least one category must be active')
        return
      }
    } else {
      next.push(cat)
    }
    setZenCategories(next)
    try {
      await updateSettings(user.uid, { zenCategories: next })
    } catch (err) {
      console.error('[settings] zenCategories save failed', err)
    }
  }

  const toggleZenVoice = async () => {
    const next = !zenVoiceEnabled
    setZenVoiceEnabled(next)
    try {
      await updateSettings(user.uid, { zenVoiceEnabled: next })
      toast.success(next ? 'Zen voice enabled' : 'Zen voice disabled')
    } catch (err) {
      console.error('[settings] zenVoice save failed', err)
    }
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

  const saveFocusAudio = async (url) => {
    const canonical = url ? (toCanonicalYouTubeUrl(url) || url) : ''
    setFocusUrlInput(canonical)
    // Selecting a non-empty URL implicitly enables the video background
    // (in case it was previously turned off).
    const nextVideoEnabled = Boolean(canonical)
    setFocusVideoEnabled(nextVideoEnabled)
    try {
      await updateSettings(
        user.uid,
        canonical
          ? { focusAudioUrl: canonical, focusVideoEnabled: true }
          : { focusAudioUrl: '', focusVideoEnabled: false },
      )
    } catch (err) {
      console.error('[settings] focusAudio save failed', err)
    }
  }

  const toggleFocusVideo = async () => {
    const next = !focusVideoEnabled
    setFocusVideoEnabled(next)
    try {
      await updateSettings(user.uid, { focusVideoEnabled: next })
    } catch (err) {
      console.error('[settings] focusVideo save failed', err)
    }
  }

  const addCustomPreset = async () => {
    const rawInput = newPresetUrl.trim()
    if (!rawInput) {
      toast.error('Please enter a YouTube video URL or ID')
      return
    }
    const id = youtubeId(rawInput)
    if (!id) {
      toast.error('Please enter a valid YouTube video URL or 11-character video ID')
      return
    }
    if (customPresets.length >= 5) {
      toast.error('You can add a maximum of 5 custom scenes')
      return
    }

    const canonicalUrl = toCanonicalYouTubeUrl(id)

    // Check if already in default presets
    const inDefault = VIDEO_PRESETS.find((p) => youtubeId(p.url) === id)
    if (inDefault) {
      toast.info(`Already in presets as "${inDefault.label}"`)
      saveFocusAudio(inDefault.url)
      setNewPresetUrl('')
      setNewPresetLabel('')
      return
    }

    // Check if already in custom presets
    const inCustom = customPresets.find((p) => youtubeId(p.url) === id)
    if (inCustom) {
      toast.info(`Already in your custom scenes as "${inCustom.label}"`)
      saveFocusAudio(inCustom.url)
      setNewPresetUrl('')
      setNewPresetLabel('')
      return
    }

    let label = newPresetLabel.trim()
    if (!label) {
      label = `Custom Scene ${customPresets.length + 1}`
    }

    const newPreset = {
      label,
      url: canonicalUrl,
    }

    const updated = [...customPresets, newPreset]
    setCustomPresets(updated)
    setNewPresetUrl('')
    setNewPresetLabel('')
    setFocusUrlInput(canonicalUrl)
    setFocusVideoEnabled(true)

    try {
      await updateSettings(user.uid, {
        customPresets: updated,
        focusAudioUrl: canonicalUrl,
        focusVideoEnabled: true,
      })
      toast.success('Custom focus scene added')
    } catch (err) {
      toast.error('Failed to save preset: ' + err.message)
    }
  }

  const deleteCustomPreset = async (index, e) => {
    e.stopPropagation()
    const presetToDelete = customPresets[index]
    const updated = customPresets.filter((_, i) => i !== index)
    setCustomPresets(updated)

    const wasActive =
      focusUrlInput === presetToDelete.url ||
      (focusUrlInput && youtubeId(focusUrlInput) === youtubeId(presetToDelete.url))

    const patch = { customPresets: updated }
    if (wasActive) {
      patch.focusAudioUrl = ''
      setFocusUrlInput('')
    }

    try {
      await updateSettings(user.uid, patch)
      toast.success('Custom focus scene deleted')
    } catch (err) {
      toast.error('Failed to delete preset: ' + err.message)
    }
  }

  const toggleZen = async () => {
    const next = !zenEnabled
    setZenEnabled(next)
    try {
      await updateSettings(user.uid, { zenEnabled: next })
    } catch (err) {
      console.error('[settings] zen save failed', err)
    }
  }

  const toggleCheckins = async () => {
    const next = !checkinsEnabled
    setCheckinsEnabled(next)
    try {
      await updateSettings(user.uid, { checkinsEnabled: next })
    } catch (err) {
      console.error('[settings] check-ins save failed', err)
    }
  }

  const saveZenDuration = async (sec) => {
    setZenDurationSec(sec)
    try {
      await updateSettings(user.uid, { zenDuration: sec * 1000 })
    } catch (err) {
      console.error('[settings] zenDuration save failed', err)
    }
  }

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

  const openEnableLockModal = () => {
    setLockModalMode('enable')
    setLockCurrentPin('')
    setLockNewPin('')
    setLockConfirmPin('')
    setLockHint('')
    setLockError('')
    setLockOnMinPref(true)
    setLockOnClosePref(true)
  }

  const openChangePinModal = () => {
    setLockModalMode('change')
    setLockCurrentPin('')
    setLockNewPin('')
    setLockConfirmPin('')
    setLockHint(lockConfig?.hint || '')
    setLockError('')
  }

  const openDisableLockModal = () => {
    setLockModalMode('disable')
    setLockCurrentPin('')
    setLockError('')
  }

  const handleSaveLock = async () => {
    setLockError('')
    setLockSubmitting(true)

    try {
      if (lockModalMode === 'enable') {
        if (!isValidPin(lockNewPin)) {
          throw new Error('PIN must be 4 to 6 numeric digits')
        }
        if (lockNewPin !== lockConfirmPin) {
          throw new Error('PIN and Confirm PIN do not match')
        }
        if (!lockHint.trim()) {
          throw new Error('Please provide a hint for your PIN')
        }
        await setLockConfig({
          pin: lockNewPin,
          hint: lockHint.trim(),
          lockOnMinimize: lockOnMinPref,
          lockOnClose: lockOnClosePref,
          uid: user?.uid,
        })
        const uniqueCode = userDoc?.profile?.uniqueCode || deriveUniqueCode(user?.uid)
        await initSessionFromAccount(user?.uid, uniqueCode, lockNewPin)
        refreshLockConfig()
        toast.success('App Lock enabled successfully!')
        setLockModalMode(null)
      } else if (lockModalMode === 'change') {
        if (!isValidPin(lockNewPin)) {
          throw new Error('New PIN must be 4 to 6 numeric digits')
        }
        if (lockNewPin !== lockConfirmPin) {
          throw new Error('New PIN and Confirm PIN do not match')
        }
        if (!lockHint.trim()) {
          throw new Error('Please provide a hint for your PIN')
        }
        await changePin(lockCurrentPin, lockNewPin, lockHint.trim(), user?.uid)
        const uniqueCode = userDoc?.profile?.uniqueCode || deriveUniqueCode(user?.uid)
        await initSessionFromAccount(user?.uid, uniqueCode, lockNewPin)
        refreshLockConfig()
        toast.success('PIN and Hint updated successfully!')
        setLockModalMode(null)
      } else if (lockModalMode === 'disable') {
        await disableLock(lockCurrentPin, user?.uid)
        const uniqueCode = userDoc?.profile?.uniqueCode || deriveUniqueCode(user?.uid)
        await initSessionFromAccount(user?.uid, uniqueCode, null)
        refreshLockConfig()
        toast.success('App Lock disabled.')
        setLockModalMode(null)
      }
    } catch (err) {
      setLockError(err.message || 'Action failed')
    } finally {
      setLockSubmitting(false)
    }
  }

  const handleToggleLockOnMinimize = async () => {
    if (!lockConfig) return
    const next = !(lockConfig.lockOnMinimize ?? true)
    await updateLockTriggers({ lockOnMinimize: next, uid: user?.uid })
    refreshLockConfig()
    toast.success(next ? 'Lock on minimize enabled' : 'Lock on minimize disabled')
  }

  const handleToggleLockOnClose = async () => {
    if (!lockConfig) return
    const next = !(lockConfig.lockOnClose ?? true)
    await updateLockTriggers({ lockOnClose: next, uid: user?.uid })
    refreshLockConfig()
    toast.success(next ? 'Lock on close enabled' : 'Lock on close disabled')
  }

  const handleLockNow = () => {
    setSettingsOpen(false)
    setTimeout(() => {
      lockApp()
    }, 120)
  }

  if (!open) return null

  const tabs = [
    { id: 'account', label: 'Account', icon: Settings },
    { id: 'security', label: 'Security & Lock', icon: Lock },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'audio', label: 'Sound & Alerts', icon: Volume2 },
    { id: 'scene', label: 'Focus Scene', icon: Film },
    { id: 'zen', label: 'Zen & Quotes', icon: Quote },
    { id: 'integrations', label: 'Integrations', icon: KeyRound },
    { id: 'updates', label: 'Updates', icon: RefreshCw },
    { id: 'system', label: 'System & Safety', icon: AlertTriangle },
    { id: 'legal', label: 'Privacy & Terms', icon: ShieldCheck },
  ]

  const ActiveIcon = tabs.find((t) => t.id === activeTab)?.icon || Settings
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label || 'Settings'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 md:p-8"
        >
          {/* Backdrop click to close */}
          <div className="absolute inset-0" onClick={() => setSettingsOpen(false)} />

          {/* Main Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative flex h-full w-full max-w-5xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-line bg-surface/90 shadow-glass backdrop-blur-3xl md:flex-row"
          >
            {/* Sidebar Navigation */}
            <div className="flex w-full shrink-0 flex-col border-b border-line/60 bg-surface-2/15 md:w-64 md:border-b-0 md:border-r">
              {/* Header */}
              <div className="flex items-center gap-2.5 px-6 py-5">
                <Settings className="h-5 w-5 text-accent animate-spin-slow" />
                <h3 className="font-bold tracking-tight text-ink text-base">Settings</h3>
              </div>

              {/* Navigation list */}
              <nav className="flex flex-row gap-1 overflow-x-auto px-4 pb-3 md:flex-col md:overflow-x-visible md:pb-6 md:pe-2">
                {tabs.map((tab) => {
                  const TabIcon = tab.icon
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-semibold tracking-wide transition-all duration-200 whitespace-nowrap md:w-full',
                        active
                          ? 'bg-accent/10 text-accent border border-accent/20'
                          : 'text-muted border border-transparent hover:bg-surface-2 hover:text-ink'
                      )}
                    >
                      <TabIcon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-muted')} />
                      {tab.label}
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* Content Pane */}
            <div className="flex min-h-0 flex-1 flex-col p-6 md:p-8">
              {/* Active Tab Header */}
              <div className="mb-6 flex items-center justify-between border-b border-line/40 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <ActiveIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-ink leading-tight">{activeLabel}</h2>
                    <p className="text-[11px] text-muted uppercase tracking-wider mt-0.5">Preferences</p>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label="Close settings"
                  title="Close Settings (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Content Area */}
              <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                {activeTab === 'account' && (() => {
                  const uniqueCode = userDoc?.profile?.uniqueCode || deriveUniqueCode(user?.uid)
                  const fullName = `${profileFirstName} ${profileLastName}`.trim() || 'Explorer'

                  return (
                    <div className="space-y-6">
                      {/* User Code and Account Info Card */}
                      <div className="flex flex-col sm:flex-row gap-4 items-center rounded-2xl border border-line bg-surface-2/15 p-5 shadow-sm">
                        {/* Avatar Preview */}
                        <div className="relative group flex-shrink-0">
                          {profilePhoto ? (
                            <img
                              src={profilePhoto}
                              alt="Avatar"
                              className="h-16 w-16 rounded-2xl object-cover border border-line bg-surface-2"
                              onError={(e) => {
                                e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`
                              }}
                            />
                          ) : (
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 border border-accent/15 text-accent text-xl font-bold">
                              {profileFirstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 text-center sm:text-left space-y-1">
                          <div className="text-[10px] font-bold text-muted/80 uppercase tracking-widest">Workspace Member</div>
                          <h4 className="font-bold text-ink truncate text-sm">{fullName}</h4>
                          <p className="text-[11px] text-muted truncate">{user?.email}</p>
                        </div>

                        {/* Unique Code Display */}
                        <div className="rounded-xl border border-accent/25 bg-accent/5 px-4 py-2.5 text-center flex-shrink-0">
                          <div className="text-[9px] font-bold text-accent uppercase tracking-widest">Unique Code</div>
                          <div className="text-sm font-black text-ink tracking-widest mt-0.5">PT-{uniqueCode}</div>
                        </div>
                      </div>

                      {/* Profile Editor Fields */}
                      <div className="space-y-4 rounded-2xl border border-line bg-surface-2/10 p-5">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted">Edit Profile</h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* First Name Input */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted/80">First Name</label>
                            <input
                              type="text"
                              value={profileFirstName}
                              onChange={(e) => setProfileFirstName(e.target.value)}
                              placeholder="Enter first name"
                              className="w-full rounded-xl border border-line bg-surface/40 px-3 py-2 text-xs text-ink outline-none focus:border-accent/40"
                            />
                          </div>

                          {/* Last Name Input */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted/80">Last Name</label>
                            <input
                              type="text"
                              value={profileLastName}
                              onChange={(e) => setProfileLastName(e.target.value)}
                              placeholder="Enter last name"
                              className="w-full rounded-xl border border-line bg-surface/40 px-3 py-2 text-xs text-ink outline-none focus:border-accent/40"
                            />
                          </div>

                          {/* Age Input */}
                          <div className="space-y-1.5">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted/80">Age</label>
                            <input
                              type="number"
                              min="1"
                              max="150"
                              value={profileAge}
                              onChange={(e) => setProfileAge(e.target.value)}
                              placeholder="Enter your age"
                              className="w-full rounded-xl border border-line bg-surface/40 px-3 py-2 text-xs text-ink outline-none focus:border-accent/40"
                            />
                          </div>

                          {/* Gender Select */}
                          <div className="space-y-1.5 col-span-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted/80">Gender</label>
                            <div className="flex gap-2">
                              {['male', 'female', 'others'].map((g) => (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => setProfileGender(g)}
                                  className={cn(
                                    "flex-1 rounded-xl border py-2 text-[10px] font-bold uppercase tracking-wider transition-all duration-200",
                                    profileGender === g
                                      ? "border-accent/30 bg-accent/10 text-accent font-semibold"
                                      : "border-line bg-surface/40 text-muted hover:bg-surface-2 hover:text-ink"
                                  )}
                                >
                                  {g}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={saveProfile}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:bg-accent/90 transition-all active:scale-[0.98]"
                        >
                          Save Profile
                        </button>
                      </div>

                      {/* Reset Account Data Section */}
                      <div className="space-y-4 rounded-2xl border border-rose-500/25 bg-rose-500/5 p-5 shadow-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                            <RotateCcw className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-widest text-rose-500">Reset Account Data</h4>
                            <p className="text-[11px] text-muted mt-0.5">Wipe all data and start completely fresh like brand new</p>
                          </div>
                        </div>

                        <p className="text-xs leading-relaxed text-muted/90">
                          Permanently delete all modes, subjects, tasks, timetable schedules, habits, todos, and focus history from your account. Your account will start like brand new with no modes.
                        </p>

                        {resetStage === 1 && (
                          <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-400">
                            <div className="font-semibold text-rose-300">
                              ⚠️ Confirmation required: this action is irreversible. All data will be permanently wiped.
                            </div>
                            <div className="space-y-1.5">
                              <label className="block text-[11px] font-medium text-muted">
                                To proceed, type <span className="font-mono font-bold text-rose-400 bg-black/30 px-1.5 py-0.5 rounded">RESET</span> below:
                              </label>
                              <input
                                type="text"
                                value={resetInput}
                                onChange={(e) => setResetInput(e.target.value)}
                                placeholder="RESET"
                                autoFocus
                                className="w-full rounded-xl border border-rose-500/40 bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-rose-500 font-semibold uppercase placeholder:normal-case"
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-2 pt-1">
                          {resetStage === 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setResetStage(1)
                                setResetInput('')
                              }}
                              className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-rose-500 hover:bg-rose-500/20 transition-all active:scale-[0.98]"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reset Account Data
                            </button>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setResetStage(0)
                                  setResetInput('')
                                }}
                                disabled={resetting}
                                className="flex-1 rounded-xl border border-line bg-surface/50 px-4 py-2.5 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-2 transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleResetAccount}
                                disabled={resetInput.trim() !== 'RESET' || resetting}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-glow-sm hover:bg-rose-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                              >
                                {resetting ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resetting…
                                  </>
                                ) : (
                                  'Confirm & Wipe All Data'
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {activeTab === 'security' && (
                  <div className="space-y-6">
                    {/* Hero Card showcasing the Enter Door Artwork */}
                    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-surface-2/30 to-surface-2/10 p-5 shadow-sm">
                      <div className="flex flex-col sm:flex-row items-center gap-5">
                        {/* Thumbnail with warm ambient backlight */}
                        <div className="relative shrink-0">
                          <div className="relative h-24 w-24 overflow-hidden rounded-2xl border border-amber-500/40 shadow-[0_0_25px_rgba(251,191,36,0.25)]">
                            <img
                              src={lockImg}
                              alt="App Lock"
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.target.src = '/lock.gif'
                              }}
                            />
                          </div>
                          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-amber-500 text-black shadow-sm">
                            <Lock className="h-3 w-3" />
                          </div>
                        </div>

                        {/* Description & Status */}
                        <div className="flex-1 text-center sm:text-left">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                            <h3 className="text-base font-bold text-ink">App Lock & PIN Security</h3>
                            {lockConfig?.enabled ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                PIN Protected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/60 px-2.5 py-0.5 text-[11px] font-medium text-muted">
                                Unprotected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted leading-relaxed">
                            Keep your workspace private. When active, Pro Track requires your 4–6 digit PIN whenever the app is minimized, closed to tray, or launched.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Main Configuration Controls */}
                    {!lockConfig?.enabled ? (
                      /* Unprotected State Banner & Setup CTA */
                      <div className="rounded-2xl border border-line/60 bg-surface-2/20 p-5 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <h4 className="text-sm font-bold text-ink mb-1">Set Up PIN Protection</h4>
                          <p className="text-xs text-muted">
                            Configure a 4–6 digit security PIN and a recovery hint to lock your workspace on demand and on minimize/close.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={openEnableLockModal}
                          className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-2.5 text-xs font-bold text-black shadow-glow-sm hover:brightness-110 active:scale-95 transition-all"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>Enable App Lock</span>
                        </button>
                      </div>
                    ) : (
                      /* Protected State Configuration */
                      <div className="space-y-4">
                        {/* Active Status & Quick Lock Now Card */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <Shield className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-ink">App Lock is Active</p>
                              <p className="text-[11px] text-muted">
                                PIN length: {lockConfig.pinLength || 4} digits &bull; Hint:{' '}
                                <span className="text-ink/80 italic font-medium">"{lockConfig.hint}"</span>
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleLockNow}
                            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black shadow-glow-sm hover:bg-amber-400 active:scale-95 transition-all"
                          >
                            <Lock className="h-3.5 w-3.5" />
                            <span>Lock Workspace Now</span>
                          </button>
                        </div>

                        {/* Lock Triggers Section */}
                        <div className="rounded-2xl border border-line/60 bg-surface-2/15 p-4 space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Lock Triggers</h4>

                          {/* Trigger 1: Lock on Minimize */}
                          <div className="flex items-center justify-between gap-3 py-1">
                            <div>
                              <p className="text-xs font-semibold text-ink">Lock when Minimized</p>
                              <p className="text-[11px] text-muted">
                                Locks the workspace immediately when Pro Track is minimized or hidden.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleToggleLockOnMinimize}
                              className={cn(
                                'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
                                (lockConfig.lockOnMinimize ?? true) ? 'bg-accent' : 'bg-surface-2 border border-line'
                              )}
                            >
                              <span
                                className={cn(
                                  'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                                  (lockConfig.lockOnMinimize ?? true) ? 'translate-x-6' : 'translate-x-1'
                                )}
                              />
                            </button>
                          </div>

                          {/* Trigger 2: Lock on Close */}
                          <div className="flex items-center justify-between gap-3 border-t border-line/40 pt-3">
                            <div>
                              <p className="text-xs font-semibold text-ink">Lock when Closed to Tray</p>
                              <p className="text-[11px] text-muted">
                                Requires PIN when restoring the app from the system tray or desktop shortcut.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={handleToggleLockOnClose}
                              className={cn(
                                'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
                                (lockConfig.lockOnClose ?? true) ? 'bg-accent' : 'bg-surface-2 border border-line'
                              )}
                            >
                              <span
                                className={cn(
                                  'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                                  (lockConfig.lockOnClose ?? true) ? 'translate-x-6' : 'translate-x-1'
                                )}
                              />
                            </button>
                          </div>

                          {/* Trigger 3: Startup (Always Active) */}
                          <div className="flex items-center justify-between gap-3 border-t border-line/40 pt-3">
                            <div>
                              <p className="text-xs font-semibold text-ink">Lock on App Startup</p>
                              <p className="text-[11px] text-muted">
                                Every fresh open or application launch requires your PIN to enter.
                              </p>
                            </div>
                            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              Always Active
                            </span>
                          </div>
                        </div>

                        {/* Management Actions */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <button
                            type="button"
                            onClick={openChangePinModal}
                            className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-surface-2 hover:border-accent transition-colors"
                          >
                            Change PIN & Hint
                          </button>
                          <button
                            type="button"
                            onClick={openDisableLockModal}
                            className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            Disable App Lock
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Security & Privacy Notice */}
                    <div className="rounded-2xl border border-line/40 bg-surface-2/10 p-4 text-xs text-muted space-y-1">
                      <p className="font-semibold text-ink/80 flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-accent" />
                        Cryptographic Security
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Your PIN is protected using salted SHA-256 one-way hashing and never stored in plain text.
                        Your custom hint is displayed on the lock screen if you ever need a memory jog.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'updates' && (
                  <div className="space-y-6">
                    {isDesktop && appInfo?.storeBuild && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">App Updates</h4>
                        <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-xs leading-relaxed text-muted">
                          This install is managed by the <span className="font-semibold text-ink/80">Microsoft Store</span> — updates download and apply automatically through the Store.
                        </p>
                      </div>
                    )}
                    {isDesktop && !appInfo?.storeBuild && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">App Updates</h4>
                        <button
                          onClick={updateStatus === 'ready' ? () => desktopBridge?.update?.install?.() : checkForUpdates}
                          disabled={checking || updateStatus === 'downloading'}
                          className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3 text-sm transition-colors hover:border-accent/40 disabled:opacity-60"
                        >
                          <span className="flex items-center gap-2.5 font-medium">
                            <RefreshCw className={cn('h-4 w-4', (checking || updateStatus === 'ready') && 'animate-spin')} />
                            {updateStatus === 'ready' ? 'Restart & apply update' : 'Check for updates'}
                          </span>
                          <span className="text-xs text-muted font-semibold">
                            {updateStatus === 'checking' && 'Checking…'}
                            {updateStatus === 'up-to-date' && 'Up to date'}
                            {updateStatus === 'downloading' && `Downloading v${updateVersion}…`}
                            {updateStatus === 'ready' && `v${updateVersion} ready`}
                            {updateStatus === 'error' && 'Check failed'}
                            {updateStatus === 'idle' && 'Click to check'}
                          </span>
                        </button>
                        {updateError && (
                          <p className="mt-2 text-xs text-rose-400 font-medium">{updateError}</p>
                        )}
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Version & Info</h4>
                      <div className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-2/20 p-4 text-xs text-muted">
                        <p className="font-medium text-ink/80">PRO TRACK {appInfo?.version ? `v${appInfo.version}` : ''} — a calm, all-in-one productivity workspace.</p>
                        <a
                          href={CREATOR.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
                        >
                          <Github className="h-4 w-4" />
                          Crafted by {CREATOR.name}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>

                    <div className="border-t border-line/40 pt-6">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-4 flex items-center gap-2">
                        <History className="h-4.5 w-4.5 text-accent" /> Changelog & Release Notes
                      </h4>
                      <div className="max-h-[38vh] overflow-y-auto rounded-2xl border border-line bg-surface-2/15 p-6 shadow-inner pr-4">
                        <div className="relative border-l border-line/70 ml-2 pl-6 space-y-7 py-1">
                          {CHANGELOG.map((c, idx) => (
                            <div key={idx} className="relative group">
                              {/* Timeline Node Dot */}
                              <div className="absolute -left-[32px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-accent/30 bg-accent/10 shadow-sm transition-all duration-300 group-hover:border-accent/60 group-hover:scale-110">
                                <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                              </div>

                              {/* Release Content */}
                              <div>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="rounded bg-accent/10 border border-accent/20 px-2 py-0.5 text-[9px] font-bold text-accent tracking-wider uppercase">
                                    v{c.version}
                                  </span>
                                  {c.date && (
                                    <span className="text-[9px] font-bold text-muted/80 uppercase tracking-wider">
                                      {c.date}
                                    </span>
                                  )}
                                </div>

                                {c.title && (
                                  <h5 className="font-bold text-ink text-xs mb-2 leading-tight">
                                    {c.title}
                                  </h5>
                                )}

                                <ul className="space-y-3">
                                  {c.highlights.map((h, i) => {
                                    // Match "**Title:** Description" or "**Title**: Description"
                                    const match = h.match(/^\*\*(.*?)\*\*:\s*(.*)$/)
                                    if (match) {
                                      const [_, title, desc] = match
                                      return (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                                          <div className="flex-1">
                                            <div className="font-bold text-ink text-[11px] leading-none mb-1">
                                              {title}
                                            </div>
                                            <div className="text-[10.5px] leading-relaxed text-muted font-medium">
                                              {renderMarkdownInline(desc)}
                                            </div>
                                          </div>
                                        </li>
                                      )
                                    }
                                    return (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted/40" />
                                        <div className="flex-1 text-[10.5px] leading-relaxed text-muted font-medium">
                                          {renderMarkdownInline(h)}
                                        </div>
                                      </li>
                                    )
                                  })}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Theme Settings</h4>
                      <label className="mb-2.5 block text-xs font-medium text-muted/80">Theme Preference</label>
                      <button
                        onClick={toggleTheme}
                        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-sm"
                      >
                        <span className="font-medium">Active Theme Mode</span>
                        <span className="font-bold capitalize text-accent">{theme === 'auto' ? 'Auto (Time of Day)' : theme}</span>
                      </button>

                      {/* DEV-only: preview any of the 7 chrono slots without waiting
                          for the clock. Never ships — guarded by import.meta.env.DEV. */}
                      {import.meta.env.DEV && (
                        <div className="mt-4">
                          <label className="mb-2.5 block text-xs font-medium text-muted/80">
                            Chrono Slot Preview (dev only)
                          </label>
                          <div className="grid grid-cols-4 gap-2">
                            {['live', ...CHRONO_SLOTS].map((slot) => (
                              <button
                                key={slot}
                                onClick={() => setChronoOverride(slot === 'live' ? null : slot)}
                                className={cn(
                                  'rounded-xl border py-2 text-[10px] font-bold uppercase tracking-wider transition-colors',
                                  (chronoOverride || 'live') === slot
                                    ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                                    : 'border-line text-muted hover:text-ink hover:bg-surface-2/30',
                                )}
                              >
                                {slot.replace('_', ' ')}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Typography Scaling</h4>
                      <label className="mb-2.5 block text-xs font-medium text-muted/80">Workspace Scale</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Font size">
                        {[
                          { key: 'tiny', label: 'Tiny' },
                          { key: 'compact', label: 'Compact' },
                          { key: 'standard', label: 'Standard' },
                          { key: 'large', label: 'Large' },
                          { key: 'huge', label: 'Huge' },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            role="radio"
                            aria-checked={fontScale === opt.key}
                            onClick={() => setFontScale(opt.key)}
                            className={cn(
                              'rounded-xl border py-3 text-xs font-semibold transition-colors text-center',
                              fontScale === opt.key
                                ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                                : 'border-line text-muted hover:text-ink hover:bg-surface-2/30',
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 border-t border-line/40 pt-5">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Workspace Font Style</h4>
                      <label className="mb-2.5 block text-xs font-medium text-muted/80">Font Family</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { key: 'dmsans', label: 'DM Sans', desc: 'Signature Sans' },
                          { key: 'inter', label: 'Inter', desc: 'Modern Sans' },
                          { key: 'outfit', label: 'Outfit', desc: 'Sleek Sans' },
                          { key: 'lora', label: 'Lora', desc: 'Scholarly Serif' },
                          { key: 'playfair', label: 'Playfair', desc: 'Classic Serif' },
                          { key: 'mono', label: 'JetBrains', desc: 'Coder Mono' },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setFontFamily(opt.key)}
                            className={cn(
                              'flex flex-col items-center justify-center rounded-xl border py-2.5 transition-colors',
                              fontFamily === opt.key
                                ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                                : 'border-line text-muted hover:text-ink hover:bg-surface-2/30',
                            )}
                          >
                            <span className="text-xs font-bold">{opt.label}</span>
                            <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70 mt-0.5">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'audio' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Sounds & Notifications</h4>
                      <div className="space-y-3">
                        <button
                          onClick={toggleSounds}
                          className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-sm transition-colors hover:border-line-2"
                        >
                          <span className="font-medium">UI Sound Effects & Event Chimes</span>
                          <span className={cn('font-bold', soundsOn ? 'text-emerald-400' : 'text-muted')}>
                            {soundsOn ? 'Enabled' : 'Muted'}
                          </span>
                        </button>
                        
                        <button
                          onClick={enableNotifications}
                          disabled={notifOn}
                          className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-sm disabled:opacity-70 transition-colors hover:border-line-2"
                        >
                          <span className="font-medium">Desktop Notification alerts</span>
                          <span className={cn('font-bold', notifOn ? 'text-emerald-400' : 'text-accent')}>
                            {notifOn ? 'Enabled' : 'Enable'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Wellness Controls</h4>
                      <label className="mb-2.5 block text-xs font-medium text-muted/80">Hydration Reminder Check Frequency</label>
                      <div className="flex gap-2.5">
                        {[30, 45, 60, 90].map((m) => (
                          <button
                            key={m}
                            onClick={() => saveHydration(m)}
                            className={cn(
                              'flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors',
                              hydration === m
                                ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                                : 'border-line text-muted hover:text-ink hover:bg-surface-2/30',
                            )}
                          >
                            {m}m
                          </button>
                        ))}
                      </div>

                      <label className="mb-2.5 mt-5 block text-xs font-medium text-muted/80">Daily Check-ins</label>
                      <button
                        onClick={toggleCheckins}
                        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-sm transition-colors hover:border-line-2"
                      >
                        <span className="font-medium">Short daily questions (morning, midday, evening)</span>
                        <span className={cn('font-bold', checkinsEnabled ? 'text-emerald-400' : 'text-muted')}>
                          {checkinsEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                      <p className="mt-2 text-[11px] leading-relaxed text-muted">
                        One quick question per part of the day. Answers stay in your workspace and quietly tune how PRO TRACK supports you.
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === 'scene' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Focus Scenes</h4>
                      <p className="text-xs text-muted mb-4 leading-relaxed">
                        Plays a quiet ambient YouTube scene as a fullscreen background behind the Pomodoro timer.
                        Select a beautiful preset, toggle audio/video settings, or add up to 5 custom scenes.
                      </p>

                      {/* Preset grid */}
                      <div className="grid grid-cols-2 gap-2.5 mb-4">
                        {VIDEO_PRESETS.map((p) => {
                          const isSelected =
                            focusUrlInput === p.url ||
                            (Boolean(focusUrlInput) && youtubeId(focusUrlInput) === youtubeId(p.url))
                          return (
                            <button
                              key={p.url}
                              onClick={() => saveFocusAudio(p.url)}
                              className={cn(
                                'rounded-xl border px-4 py-3 text-left text-xs font-semibold transition-colors',
                                isSelected
                                  ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                                  : 'border-line bg-surface-2/40 text-muted hover:border-accent/40 hover:text-ink',
                              )}
                            >
                              {p.label}
                            </button>
                          )
                        })}

                        {customPresets.map((p, idx) => {
                          const isSelected =
                            focusUrlInput === p.url ||
                            (Boolean(focusUrlInput) && youtubeId(focusUrlInput) === youtubeId(p.url))
                          return (
                            <div key={p.url + idx} className="relative group">
                              <button
                                onClick={() => saveFocusAudio(p.url)}
                                className={cn(
                                  'w-full rounded-xl border pl-4 pr-10 py-3 text-left text-xs font-semibold transition-colors truncate',
                                  isSelected
                                    ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                                    : 'border-line bg-surface-2/40 text-muted hover:border-accent/40 hover:text-ink',
                                )}
                              >
                                {p.label}
                              </button>
                              <button
                                onClick={(e) => deleteCustomPreset(idx, e)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-lg border border-line/60 bg-surface/80 text-muted hover:text-rose-500 hover:border-rose-500/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Delete custom scene"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )
                        })}

                        <button
                          onClick={() => saveFocusAudio('')}
                          className={cn(
                            'rounded-xl border px-4 py-3 text-left text-xs font-semibold transition-colors',
                            !focusUrlInput
                              ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                              : 'border-line bg-surface-2/40 text-muted hover:border-accent/40 hover:text-ink',
                          )}
                        >
                          Off / None
                        </button>
                      </div>

                      {/* Add Custom Scene Section */}
                      <div className="space-y-3 bg-surface-2/15 border border-line/40 rounded-2xl p-4 mt-4">
                        <label className="block text-xs font-semibold text-ink">Add Custom Scene</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted/85">Video URL</label>
                            <input
                              type="url"
                              value={newPresetUrl}
                              onChange={(e) => setNewPresetUrl(e.target.value)}
                              placeholder="https://youtu.be/..."
                              disabled={customPresets.length >= 5}
                              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent disabled:opacity-50"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted/85">Scene Title</label>
                            <input
                              type="text"
                              value={newPresetLabel}
                              onChange={(e) => setNewPresetLabel(e.target.value)}
                              placeholder="e.g. Rainy Cafe (optional)"
                              disabled={customPresets.length >= 5}
                              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-accent disabled:opacity-50"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4 pt-1">
                          <span className="text-[10px] text-muted font-medium">
                            {customPresets.length >= 5 
                              ? 'Maximum of 5 custom scenes added' 
                              : `${5 - customPresets.length} slots remaining (max 5)`}
                          </span>
                          <button
                            onClick={addCustomPreset}
                            disabled={!newPresetUrl.trim() || customPresets.length >= 5}
                            className="rounded-xl bg-accent text-white px-4 py-2 text-xs font-bold hover:bg-accent/90 disabled:opacity-50 transition-colors shadow-glow-sm"
                          >
                            Add to Presets
                          </button>
                        </div>
                      </div>

                      {/* Video visibility toggle */}
                      <button
                        onClick={toggleFocusVideo}
                        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-sm transition-colors hover:border-line-2 mt-4"
                      >
                        <span className="font-medium">Show video background on focus screen</span>
                        <span className={cn('font-bold', focusVideoEnabled ? 'text-emerald-400' : 'text-muted')}>
                          {focusVideoEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'zen' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Zen Mode</h4>
                      <p className="text-xs text-muted mb-4 leading-relaxed">
                        Fades in calming wisdom, inspiration, and motivational quotes on the full screen when the workstation stays idle.
                      </p>

                      <button
                        onClick={toggleZen}
                        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-sm transition-colors hover:border-line-2 mb-4"
                      >
                        <span className="font-medium">Motivational quotes when idle</span>
                        <span className={cn('font-bold', zenEnabled ? 'text-emerald-400' : 'text-muted')}>
                          {zenEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>

                      {/* Voice Settings */}
                      <button
                        onClick={toggleZenVoice}
                        className="flex w-full items-center justify-between rounded-xl border border-line bg-surface-2/40 px-4 py-3.5 text-sm transition-colors hover:border-line-2 mb-4"
                      >
                        <span className="font-medium">Read quotes aloud (Zen Voice)</span>
                        <span className={cn('font-bold', zenVoiceEnabled ? 'text-emerald-400' : 'text-muted')}>
                          {zenVoiceEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </button>

                      {/* Quote Categories Checklist */}
                      <div className="mb-5">
                        <label className="mb-2 block text-xs font-semibold text-muted">
                          Configure Quote Categories
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'stoic', label: 'Stoic Philosophy' },
                            { id: 'philosophy', label: 'Philosophers & Thinkers' },
                            { id: 'productivity', label: 'Productivity & Focus' },
                            { id: 'proverbs', label: 'Proverbs & Koans' },
                            { id: 'hindi_urdu', label: 'Hindi / Urdu Dohe' },
                            { id: 'modern', label: 'Modern Quotes' },
                          ].map((cat) => {
                            const active = zenCategories.includes(cat.id)
                            return (
                              <button
                                key={cat.id}
                                onClick={() => toggleZenCategory(cat.id)}
                                className={cn(
                                  'flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-colors',
                                  active
                                    ? 'border-accent/40 bg-accent/10 text-ink'
                                    : 'border-line text-muted hover:text-ink hover:bg-surface-2/30',
                                )}
                              >
                                <span>{cat.label}</span>
                                <span className={cn('h-2 w-2 rounded-full transition-all', active ? 'bg-accent shadow-glow-sm' : 'bg-transparent')} />
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Quote display duration */}
                      <div className="mt-4">
                        <label className="mb-2.5 block text-xs font-semibold text-muted">
                          Quote Display Duration
                        </label>
                        <div className="flex gap-2.5">
                          {[
                            { value: 60, label: '1m', desc: 'Standard' },
                            { value: 120, label: '2m', desc: 'Reflective' },
                            { value: 300, label: '5m', desc: 'Meditative' },
                            { value: 1800, label: '30m', desc: 'Ambient' },
                            { value: 3600, label: '1h', desc: 'Poster' },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => saveZenDuration(opt.value)}
                              className={cn(
                                'flex-1 flex flex-col items-center justify-center rounded-xl border py-2 transition-colors',
                                zenDurationSec === opt.value
                                  ? 'border-accent/50 bg-accent/15 text-accent shadow-glow-sm'
                                  : 'border-line text-muted hover:text-ink hover:bg-surface-2/30',
                              )}
                            >
                              <span className="text-xs font-bold">{opt.label}</span>
                              <span className="text-[9px] font-semibold uppercase tracking-wider opacity-70 mt-0.5">{opt.desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'integrations' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Artificial Intelligence</h4>
                      <p className="mb-4 text-xs text-muted leading-relaxed">
                        Configure AI services and preferred routing. Keys are stored safely on your local device.
                      </p>

                      {/* Preferred AI Provider Dropdown */}
                      <div className="mb-4 bg-surface-2/15 border border-line/50 rounded-2xl p-4">
                        <label className="mb-1.5 block text-xs font-semibold text-ink">Preferred AI Provider</label>
                        <p className="mb-3 text-[11px] text-muted">
                          Choose which AI model handles chat assistant, summaries, and quotes. If set to Automatic, the app will auto-detect and switch to the next active provider if the primary choice fails.
                        </p>
                        <select
                          value={aiPreferred}
                          onChange={(e) => savePreferredProvider(e.target.value)}
                          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-xs outline-none focus:border-accent"
                        >
                          <option value="auto">Automatic (Auto-Fallback)</option>
                          <option value="gemini">Google Gemini</option>
                          <option value="openai">OpenAI (GPT-4o-mini)</option>
                          <option value="anthropic">Anthropic Claude</option>
                          <option value="deepseek">DeepSeek-V3</option>
                        </select>
                      </div>

                      {/* Expandable Accordion Provider Key Configuration List */}
                      <div className="space-y-2">
                        {[
                          { id: 'gemini', label: 'Google Gemini', desc: 'Powers your study companion, voice transcript summaries, and custom quotes.', keyPlaceholder: 'AIzaSy...', link: 'https://aistudio.google.com/app/apikey', linkText: 'Get free key', val: keyInput, setVal: setKeyInput, onSave: saveKey },
                          { id: 'openai', label: 'OpenAI', desc: 'Use OpenAI models for chat, tutoring assistance, and general intelligence features.', keyPlaceholder: 'sk-proj-...', val: openaiInput, setVal: setOpenaiInput, onSave: saveOpenAIKey },
                          { id: 'anthropic', label: 'Anthropic (Claude)', desc: 'Connect Claude models for advanced coding assistance, brainstorming, and explanations.', keyPlaceholder: 'sk-ant-...', val: anthropicInput, setVal: setAnthropicInput, onSave: saveAnthropicKey },
                          { id: 'elevenlabs', label: 'ElevenLabs Voice', desc: 'Enables hyper-realistic, natural voice generation when reading Zen Mode quotes aloud.', keyPlaceholder: 'ElevenLabs Key...', val: elevenlabsInput, setVal: setElevenlabsInput, onSave: saveElevenLabsKey },
                          { id: 'deepseek', label: 'DeepSeek', desc: 'Access cost-efficient, high-performance DeepSeek-V3 and DeepSeek-R1 reasoning models.', keyPlaceholder: 'DeepSeek Key...', val: deepseekInput, setVal: setDeepseekInput, onSave: saveDeepSeekKey },
                        ].map((prov) => {
                          const isConfigured = hasApiKey(prov.id)
                          const isExpanded = expandedProvider === prov.id
                          return (
                            <div key={prov.id} className="rounded-2xl border border-line/50 bg-surface-2/15 overflow-hidden transition-all duration-200">
                              {/* Row Header (always visible) */}
                              <button
                                onClick={() => setExpandedProvider(isExpanded ? null : prov.id)}
                                className="w-full flex items-center justify-between p-4 hover:bg-surface-2/30 transition-colors"
                              >
                                <div className="flex flex-col items-start gap-1">
                                  <span className="text-xs font-bold text-ink">{prov.label}</span>
                                  <span className="text-[10px] text-muted text-left line-clamp-1">{prov.desc}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={cn('text-[9px] font-bold px-2 py-0.5 rounded-full border', isConfigured ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 'bg-surface-2 border-line text-muted')}>
                                    {isConfigured ? 'Configured' : 'Missing'}
                                  </span>
                                  <ChevronDown className={cn('h-3.5 w-3.5 text-muted transition-transform duration-200', isExpanded && 'rotate-180')} />
                                </div>
                              </button>

                              {/* Row Content (visible only when expanded) */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="border-t border-line/30 bg-surface-2/10 p-4 space-y-3"
                                  >
                                    <div className="flex gap-2.5">
                                      <input
                                        type="password"
                                        value={prov.val}
                                        onChange={(e) => prov.setVal(e.target.value)}
                                        placeholder={prov.keyPlaceholder}
                                        className="flex-1 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs outline-none focus:border-accent"
                                      />
                                      <Button size="sm" onClick={prov.onSave}>
                                        Save
                                      </Button>
                                    </div>
                                    {prov.link && (
                                      <a
                                        href={prov.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline font-semibold"
                                      >
                                        {prov.linkText} <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>

                      {/* Hands-Free Loop Turn Limit Slider */}
                      <div className="mt-4 bg-surface-2/15 border border-line/50 rounded-2xl p-4">
                        <label className="mb-1.5 block text-xs font-semibold text-ink">Hands-Free Turn Limit</label>
                        <p className="mb-3 text-[11px] text-muted">
                          Adjust the maximum number of continuous conversational turns in Hands-Free mode to conserve API tokens.
                        </p>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="1"
                            max="20"
                            value={settings?.handsFreeTurnLimit || 6}
                            onChange={(e) => updateSettings(user.uid, { handsFreeTurnLimit: Number(e.target.value) })}
                            className="flex-1 accent-accent"
                          />
                          <span className="text-xs font-bold text-ink w-16 text-center bg-surface-2 border border-line/60 rounded px-2 py-1 select-none">
                            {settings?.handsFreeTurnLimit || 6} turns
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-line/40 pt-6">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Schedules Sync</h4>
                      <label className="mb-1 block text-xs font-semibold text-muted">Google Calendar Connection</label>
                      <p className="mb-3 text-[11px] text-muted font-normal">
                        Synchronizes study session alerts, habits, and tasks directly to your Google Calendar.
                      </p>
                      {calConnected ? (
                        <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3.5">
                          <span className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                            <Check className="h-4 w-4" /> Sync Connected
                          </span>
                          <button
                            onClick={handleDisconnectCal}
                            className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted hover:text-ink hover:border-accent transition-colors"
                          >
                            Unlink Calendar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/20 px-4 py-3.5">
                          <span className="flex items-center gap-2 text-xs text-muted font-medium">
                            <Calendar className="h-4 w-4" /> Not Connected
                          </span>
                          <button
                            onClick={handleConnectCal}
                            className="rounded-lg bg-accent text-white px-4 py-2 text-xs font-bold hover:bg-accent/90 transition-colors shadow-glow-sm"
                          >
                            Connect Calendar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'system' && (
                  <div className="space-y-6">
                    {isDesktop && appInfo?.shortcuts && (
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">System Hotkeys</h4>
                        <div className="space-y-2.5">
                          <ShortcutRow label="Show / hide window" acc={appInfo.shortcuts.toggleWindow} />
                          <ShortcutRow label="Pause / resume focus" acc={appInfo.shortcuts.toggleFocus} />
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-3">Security & Danger Zone</h4>
                      <p className="text-xs text-muted mb-4 leading-relaxed">
                        Wipes all cache tokens, settings key overrides, calendar credentials, and permanently deletes your cloud workspace profile.
                      </p>
                      
                       <div className="flex flex-col gap-3">
                        {deleteStage === 1 && (
                          <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-500">
                            <div>
                              <p className="font-bold">Are you absolutely sure? (Step 1 of 2)</p>
                              <p className="mt-1">All syllabus progress, focus sessions, and metrics will be wiped forever.</p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="block font-medium">To proceed, please type <span className="font-mono font-bold bg-black/20 px-1 py-0.5 rounded text-amber-600">WIPE</span> below:</label>
                              <input
                                type="text"
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                placeholder="WIPE"
                                className="w-full rounded-xl border border-amber-500/30 bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-amber-500 font-semibold"
                              />
                            </div>
                          </div>
                        )}

                        {deleteStage === 2 && (
                          <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500">
                            <div>
                              <p className="font-bold">Critical Confirmation Required (Step 2 of 2)</p>
                              <p className="mt-1">This action is irreversible. All settings, database nodes, and cloud files will be deleted.</p>
                            </div>
                            <div className="space-y-1.5">
                              <label className="block font-medium">Please type your email address <span className="font-mono font-bold bg-black/20 px-1.5 py-0.5 rounded text-red-600 select-all">{user?.email}</span> to confirm Wiping:</label>
                              <input
                                type="text"
                                value={deleteInput}
                                onChange={(e) => setDeleteInput(e.target.value)}
                                placeholder={user?.email}
                                className="w-full rounded-xl border border-red-500/30 bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-red-500 font-semibold"
                              />
                            </div>
                          </div>
                        )}

                        <button
                          onClick={handleDeleteWipe}
                          disabled={
                            (deleteStage === 1 && deleteInput !== 'WIPE') ||
                            (deleteStage === 2 && deleteInput !== user?.email)
                          }
                          className={cn(
                            "flex w-full items-center justify-center rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none",
                            deleteStage === 0 && "border border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
                            deleteStage === 1 && "bg-amber-500 text-white hover:bg-amber-600 shadow-glow-sm",
                            deleteStage === 2 && "bg-red-500 text-white hover:bg-red-600 shadow-glow-sm"
                          )}
                        >
                          {deleteStage === 0 && "Delete Account & Wipe Workspace"}
                          {deleteStage === 1 && "Confirm Step 1 of 2"}
                          {deleteStage === 2 && "Destroy Account & Wipe Cache"}
                        </button>
                        
                        {deleteStage > 0 && (
                          <button
                            onClick={() => {
                              setDeleteStage(0)
                              setDeleteInput('')
                            }}
                            className="mt-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted hover:text-ink transition-colors"
                          >
                            Cancel Deletion
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'legal' && (
                  <div className="space-y-6 text-sm text-ink/90">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Privacy Policy</h4>
                      <p className="text-xs leading-relaxed text-muted mb-3">
                        Your privacy is extremely important. Here is how your data is handled in <strong>PRO TRACK</strong>:
                      </p>
                      <ul className="list-disc pl-5 space-y-2 text-xs text-muted">
                        <li><strong>AI API Keys:</strong> Your provider API keys (Gemini, OpenAI, Anthropic, DeepSeek) are stored <strong>strictly locally</strong> in your browser or desktop application's <code>localStorage</code>. They are never sent to our servers or written to Firestore.</li>
                        <li><strong>Sync and Cloud Storage:</strong> If you sign in, your subjects, timetable slots, habits, and todos are synced to a secure Google Firebase database. Your data is private to your authenticated account and is never shared.</li>
                        <li><strong>Microphone Audio:</strong> The Hands-Free Mode transcription runs direct client-side requests to the configured AI API endpoints. Audio recordings are processed on-the-fly and are never permanently stored or monitored by us.</li>
                      </ul>
                    </div>

                    <div className="border-t border-line/45 pt-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Terms and Conditions</h4>
                      <p className="text-xs leading-relaxed text-muted mb-3">
                        By using the PRO TRACK study companion, you agree to the following terms:
                      </p>
                      <ul className="list-disc pl-5 space-y-2 text-xs text-muted">
                        <li><strong>Personal Use:</strong> PRO TRACK is provided as a productivity and focus-assisting workspace for personal study use.</li>
                        <li><strong>API Usage Constraints:</strong> You are responsible for any charges or rate limits incurred on your personal AI provider accounts (Gemini, OpenAI, etc.) when using your custom API keys.</li>
                        <li><strong>Liability Limitation:</strong> The software is provided "as is" without warranty of any kind. We are not liable for any data loss, study delays, or device problems.</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-line bg-surface-2/30 p-4 text-[10px] text-muted text-center">
                      Last Updated: June 2026 · v{appInfo?.version || APP_VERSION}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer user branding */}
              <div className="mt-4 border-t border-line/30 pt-3 text-center text-[10px] text-muted/70 font-semibold select-none uppercase tracking-wider">
                PRO TRACK · Active Account: {user?.email}
              </div>
            </div>

            {/* App Lock PIN Setup / Change / Disable Modal */}
            <AnimatePresence>
              {lockModalMode && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
                >
                  <div className="absolute inset-0" onClick={() => !lockSubmitting && setLockModalMode(null)} />
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-md overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-2xl z-10"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Lock className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-ink">
                            {lockModalMode === 'enable' && 'Set Up App Lock'}
                            {lockModalMode === 'change' && 'Change PIN & Hint'}
                            {lockModalMode === 'disable' && 'Disable App Lock'}
                          </h3>
                          <p className="text-[11px] text-muted">
                            {lockModalMode === 'disable'
                              ? 'Confirm your current PIN to turn off lock'
                              : 'Configure your 4 to 6 digit security PIN'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => !lockSubmitting && setLockModalMode(null)}
                        className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Form Inputs */}
                    <div className="space-y-3.5">
                      {/* Current PIN (required when changing or disabling) */}
                      {(lockModalMode === 'change' || lockModalMode === 'disable') && (
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-ink">
                            Current PIN <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={lockCurrentPin}
                            onChange={(e) => setLockCurrentPin(e.target.value.replace(/\D/g, ''))}
                            placeholder="Enter current PIN"
                            autoFocus
                            className="w-full rounded-xl border border-line bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
                          />
                        </div>
                      )}

                      {/* New PIN & Confirmation (when enabling or changing) */}
                      {lockModalMode !== 'disable' && (
                        <>
                          <div>
                            <label className="mb-1 block text-xs font-semibold text-ink">
                              New PIN (4 to 6 digits) <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={lockNewPin}
                              onChange={(e) => setLockNewPin(e.target.value.replace(/\D/g, ''))}
                              placeholder="Enter 4–6 digit numeric PIN"
                              autoFocus={lockModalMode === 'enable'}
                              className="w-full rounded-xl border border-line bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-ink">
                              Confirm PIN <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="password"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={lockConfirmPin}
                              onChange={(e) => setLockConfirmPin(e.target.value.replace(/\D/g, ''))}
                              placeholder="Re-enter your PIN"
                              className="w-full rounded-xl border border-line bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-semibold text-ink">
                              PIN Reminder Hint <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              maxLength={80}
                              value={lockHint}
                              onChange={(e) => setLockHint(e.target.value)}
                              placeholder="e.g. Year I graduated, favorite 4 digits..."
                              className="w-full rounded-xl border border-line bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
                            />
                            <p className="mt-1 text-[10px] text-muted">
                              Required. Displayed on the lock screen if you ever forget your PIN.
                            </p>
                          </div>

                          {lockModalMode === 'enable' && (
                            <div className="space-y-2 pt-1">
                              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={lockOnMinPref}
                                  onChange={(e) => setLockOnMinPref(e.target.checked)}
                                  className="accent-accent rounded"
                                />
                                <span>Lock app when minimized</span>
                              </label>
                              <label className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={lockOnClosePref}
                                  onChange={(e) => setLockOnClosePref(e.target.checked)}
                                  className="accent-accent rounded"
                                />
                                <span>Lock app when closed to tray</span>
                              </label>
                            </div>
                          )}
                        </>
                      )}

                      {/* Error Banner */}
                      {lockError && (
                        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-500">
                          {lockError}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center justify-end gap-2.5 pt-3">
                        <button
                          type="button"
                          onClick={() => setLockModalMode(null)}
                          disabled={lockSubmitting}
                          className="rounded-xl border border-line bg-surface-2/30 px-4 py-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveLock}
                          disabled={lockSubmitting}
                          className={cn(
                            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-glow-sm transition-all active:scale-95',
                            lockModalMode === 'disable'
                              ? 'bg-rose-600 hover:bg-rose-700'
                              : 'bg-accent hover:bg-accent/90'
                          )}
                        >
                          {lockSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          <span>
                            {lockModalMode === 'enable' && 'Enable Lock'}
                            {lockModalMode === 'change' && 'Save New PIN'}
                            {lockModalMode === 'disable' && 'Disable Lock'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
