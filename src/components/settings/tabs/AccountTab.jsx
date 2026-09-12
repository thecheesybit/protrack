import { useState, useEffect } from 'react'
import { RotateCcw, Loader2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import { deriveUniqueCode } from '@/services/cryptoService'
import { updateProfile, resetAllUserData } from '@/services/userService'
import { useStore } from '@/store/useStore'
import { SettingsSection, SettingsCard, SettingsBadge } from '../SettingsUI'

export function AccountTab({ user, userDoc, setSettingsOpen }) {
  const [resetStage, setResetStage] = useState(0)
  const [resetInput, setResetInput] = useState('')
  const [resetting, setResetting] = useState(false)

  const [profileFirstName, setProfileFirstName] = useState('')
  const [profileLastName, setProfileLastName] = useState('')
  const [profileAge, setProfileAge] = useState('')
  const [profileGender, setProfileGender] = useState('male')
  const [profilePhoto, setProfilePhoto] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  useEffect(() => {
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

    const googlePhoto = user?.photoURL || ''
    const currentPhoto =
      userDoc?.profile?.photoURL ||
      googlePhoto ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`
    setProfilePhoto(currentPhoto)
  }, [userDoc, user])

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
    setSavingProfile(true)
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
    } finally {
      setSavingProfile(false)
    }
  }

  const uniqueCode = userDoc?.profile?.uniqueCode || deriveUniqueCode(user?.uid)
  const fullName = `${profileFirstName} ${profileLastName}`.trim() || 'Explorer'

  return (
    <div className="space-y-8 pb-4">
      {/* ── Profile & Member Badge ───────────────────────────────────── */}
      <SettingsSection
        title="Workspace Identity"
        description="Your member credentials, display avatar, and unique sync identifier."
      >
        <SettingsCard className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar Preview */}
            <div className="relative group shrink-0">
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt="Avatar"
                  className="h-16 w-16 rounded-2xl object-cover border border-line/60 bg-surface shadow-xs transition-transform group-hover:scale-105"
                  onError={(e) => {
                    e.target.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`
                  }}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 text-accent text-xl font-bold">
                  {profileFirstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>

            {/* Member Info */}
            <div className="min-w-0 flex-1 text-center sm:text-left space-y-1.5">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h4 className="font-bold text-ink text-base tracking-tight truncate">{fullName}</h4>
                <SettingsBadge variant="accent">Workspace Member</SettingsBadge>
              </div>
              <p className="text-xs text-muted truncate">{user?.email}</p>
            </div>

            {/* Unique Code Pill */}
            <div className="shrink-0 rounded-2xl border border-line/60 bg-surface-2/40 px-4 py-3 text-center sm:text-right">
              <span className="block font-mono text-[calc(0.625rem*var(--text-scale,1))] font-bold uppercase tracking-wider text-muted">
                Unique Sync Code
              </span>
              <span className="block font-mono text-xs font-bold text-ink tracking-wider mt-0.5 select-all">
                PT-{uniqueCode}
              </span>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Profile Editor ───────────────────────────────────────────── */}
      <SettingsSection
        title="Personal Details"
        description="Configure your name, age, and greeting personalization across the workspace."
      >
        <SettingsCard className="space-y-5 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* First Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">First Name</label>
              <input
                type="text"
                value={profileFirstName}
                onChange={(e) => setProfileFirstName(e.target.value)}
                placeholder="Enter first name"
                className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-accent focus:bg-surface"
              />
            </div>

            {/* Last Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Last Name</label>
              <input
                type="text"
                value={profileLastName}
                onChange={(e) => setProfileLastName(e.target.value)}
                placeholder="Enter last name"
                className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-accent focus:bg-surface"
              />
            </div>

            {/* Age Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Age</label>
              <input
                type="number"
                min="1"
                max="150"
                value={profileAge}
                onChange={(e) => setProfileAge(e.target.value)}
                placeholder="Enter your age"
                className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-accent focus:bg-surface"
              />
            </div>

            {/* Gender Select — Airy & Professional */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Gender Preference</label>
              <div className="flex gap-2">
                {[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'others', label: 'Other' },
                ].map((g) => {
                  const isSelected = profileGender === g.value
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => setProfileGender(g.value)}
                      className={cn(
                        'flex-1 rounded-xl border py-2.5 px-3 text-xs font-semibold transition-all duration-200 cursor-pointer text-center',
                        isSelected
                          ? 'border-accent bg-accent/15 text-accent shadow-glow-xs font-bold'
                          : 'border-line/60 bg-surface-2/30 text-muted hover:text-ink hover:bg-surface-2/60'
                      )}
                    >
                      {g.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold tracking-wider uppercase text-white shadow-glow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Reset Account Data (Streamlined & Non-Chunky) ─────────────── */}
      <SettingsSection
        title="Workspace State Management"
        description="Clear study records or reset your workspace to fresh installation defaults."
      >
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-5 sm:p-6 transition-all duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0 flex-1">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 mt-0.5">
                <RotateCcw className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-sm font-semibold text-rose-400">
                    Reset Account Data
                  </span>
                  <SettingsBadge variant="rose">Irreversible</SettingsBadge>
                </div>
                <p className="mt-1 text-xs text-muted leading-relaxed font-sans">
                  Permanently wipe all subjects, timetable schedules, habits, and study history.
                </p>
              </div>
            </div>

            {resetStage === 0 && (
              <button
                type="button"
                onClick={() => {
                  setResetStage(1)
                  setResetInput('')
                }}
                className="self-start sm:self-center shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                Reset Data…
              </button>
            )}
          </div>

          {resetStage === 1 && (
            <div className="mt-4 pt-4 border-t border-rose-500/20 space-y-3">
              <p className="text-xs text-rose-300 font-medium">
                To proceed, type <span className="font-mono font-bold text-rose-400 bg-black/30 px-1.5 py-0.5 rounded">RESET</span> to confirm:
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <input
                  type="text"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  placeholder="RESET"
                  autoFocus
                  className="flex-1 rounded-xl border border-rose-500/40 bg-surface px-3.5 py-2 text-xs text-ink outline-none focus:border-rose-500 font-mono font-bold uppercase placeholder:normal-case"
                />
                <button
                  type="button"
                  onClick={() => {
                    setResetStage(0)
                    setResetInput('')
                  }}
                  disabled={resetting}
                  className="rounded-xl border border-line bg-surface-2/60 px-3.5 py-2 text-xs font-semibold text-muted hover:text-ink hover:bg-surface-2 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetAccount}
                  disabled={resetInput.trim() !== 'RESET' || resetting}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-glow-sm hover:bg-rose-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {resetting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resetting…
                    </>
                  ) : (
                    'Confirm & Wipe Data'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  )
}
