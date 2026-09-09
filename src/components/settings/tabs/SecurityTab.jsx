import { useState } from 'react'
import { Shield, ShieldCheck, Loader2, Lock, X, KeyRound, Minimize2, Power } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import {
  setLockConfig,
  disableLock,
  changePin,
  updateLockTriggers,
  isValidPin,
} from '@/services/lockService'
import { deriveUniqueCode, initSessionFromAccount } from '@/services/cryptoService'
import lockImg from '@/assets/lock.gif'
import { AnimatePresence, motion } from 'framer-motion'
import { SettingsSection, SettingsCard, SettingsBadge, SettingsToggleRow } from '../SettingsUI'

export function SecurityTab({
  user,
  userDoc,
  lockConfig,
  refreshLockConfig,
  lockApp,
  setSettingsOpen,
}) {
  const [lockModalMode, setLockModalMode] = useState(null)
  const [lockCurrentPin, setLockCurrentPin] = useState('')
  const [lockNewPin, setLockNewPin] = useState('')
  const [lockConfirmPin, setLockConfirmPin] = useState('')
  const [lockHint, setLockHint] = useState('')
  const [lockOnMinPref, setLockOnMinPref] = useState(true)
  const [lockOnClosePref, setLockOnClosePref] = useState(true)
  const [lockError, setLockError] = useState('')
  const [lockSubmitting, setLockSubmitting] = useState(false)

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

  const handleToggleLockOnMinimize = async (checked) => {
    if (!lockConfig) return
    await updateLockTriggers({ lockOnMinimize: checked, uid: user?.uid })
    refreshLockConfig()
    toast.success(checked ? 'Lock on minimize enabled' : 'Lock on minimize disabled')
  }

  const handleToggleLockOnClose = async (checked) => {
    if (!lockConfig) return
    await updateLockTriggers({ lockOnClose: checked, uid: user?.uid })
    refreshLockConfig()
    toast.success(checked ? 'Lock on close enabled' : 'Lock on close disabled')
  }

  const handleLockNow = () => {
    setSettingsOpen(false)
    setTimeout(() => {
      lockApp()
    }, 120)
  }

  return (
    <div className="space-y-8 pb-4">
      {/* ── App Lock Hero Card ───────────────────────────────────────── */}
      <SettingsSection
        title="Workspace Security & App Lock"
        description="Prevent unauthorized access with 4–6 digit cryptographic PIN security."
      >
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-surface-2/30 to-surface-2/10 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative shrink-0">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-amber-500/40 shadow-[0_0_25px_rgba(251,191,36,0.2)]">
                <img
                  src={lockImg}
                  alt="App Lock"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.target.src = '/lock.gif'
                  }}
                />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-amber-500 text-black shadow-xs">
                <Lock className="h-3 w-3" />
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <h4 className="text-base font-bold text-ink">PIN Lock & Access Guard</h4>
                {lockConfig?.enabled ? (
                  <SettingsBadge variant="emerald">Protected</SettingsBadge>
                ) : (
                  <SettingsBadge variant="muted">Unprotected</SettingsBadge>
                )}
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Shield your notes, study timetable, and syllabus progress. When enabled, ProTrack requires your PIN whenever the window is restored or launched.
              </p>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Lock Configuration ──────────────────────────────────────── */}
      {!lockConfig?.enabled ? (
        <SettingsSection
          title="Enable Security Protection"
          description="Create your private PIN to restrict workspace access."
        >
          <SettingsCard className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h5 className="text-xs font-bold text-ink mb-1">Set Up Private PIN</h5>
              <p className="text-[11px] text-muted leading-relaxed">
                Configure a 4–6 digit security PIN and recovery hint to guard your workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={openEnableLockModal}
              className="shrink-0 flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-glow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Enable App Lock</span>
            </button>
          </SettingsCard>
        </SettingsSection>
      ) : (
        <>
          {/* Active Status & Quick Lock */}
          <SettingsSection
            title="Active Lock Status"
            description="Quickly lock the app on demand or configure automatic triggers."
          >
            <SettingsCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-emerald-500/20 bg-emerald-500/[0.03]">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">App Lock is Active</span>
                    <SettingsBadge variant="emerald">Live</SettingsBadge>
                  </div>
                  <p className="text-[11px] text-muted font-mono mt-0.5">
                    Length: {lockConfig.pinLength || 4} digits &bull; Hint: "{lockConfig.hint}"
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleLockNow}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black shadow-glow-sm hover:bg-amber-400 active:scale-95 transition-all cursor-pointer"
                >
                  <Lock className="h-3.5 w-3.5" /> Lock Now
                </button>
              </div>
            </SettingsCard>
          </SettingsSection>

          {/* Trigger Preferences */}
          <SettingsSection
            title="Lock Triggers & Automation"
            description="Select which system events automatically trigger the lock screen."
          >
            <div className="space-y-3">
              <SettingsToggleRow
                icon={Minimize2}
                title="Lock When Minimized"
                description="Immediately locks the workspace when ProTrack is minimized or hidden."
                checked={lockConfig.lockOnMinimize ?? true}
                onChange={handleToggleLockOnMinimize}
              />

              <SettingsToggleRow
                icon={Power}
                title="Lock When Closed to Tray"
                description="Requires PIN authentication when restoring the app from the system tray."
                checked={lockConfig.lockOnClose ?? true}
                onChange={handleToggleLockOnClose}
              />
            </div>
          </SettingsSection>

          {/* Management Controls */}
          <SettingsSection
            title="Credential Management"
            description="Modify your security PIN, update your hint, or disable protection."
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openChangePinModal}
                className="rounded-xl border border-line bg-surface-2/40 px-4 py-2.5 text-xs font-semibold text-ink hover:bg-surface-2 hover:border-accent transition-colors cursor-pointer"
              >
                Change PIN & Hint
              </button>
              <button
                type="button"
                onClick={openDisableLockModal}
                className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                Disable App Lock
              </button>
            </div>
          </SettingsSection>
        </>
      )}

      {/* ── Cryptographic Notice ─────────────────────────────────────── */}
      <SettingsSection
        title="Cryptographic Architecture"
        description="Technical transparency on PIN encryption and recovery."
      >
        <SettingsCard className="p-5 flex items-start gap-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent mt-0.5">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <span className="block text-xs font-bold text-ink">Salted SHA-256 Hashing</span>
            <p className="text-[11px] text-muted leading-relaxed mt-1">
              Your PIN is hashed client-side using salted SHA-256 before verification. Plaintext PINs are never saved to disk or transmitted across networks.
            </p>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── PIN Setup / Change / Disable Modal ────────────────────────── */}
      <AnimatePresence>
        {lockModalMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <div
              className="absolute inset-0"
              onClick={() => !lockSubmitting && setLockModalMode(null)}
            />
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
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3.5">
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
                      className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
                    />
                  </div>
                )}

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
                        className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
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
                        className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
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
                        placeholder="e.g. Graduation year, favorite 4 digits..."
                        className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none focus:border-accent"
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

                {lockError && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs font-semibold text-rose-400">
                    {lockError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3">
                  <button
                    type="button"
                    onClick={() => setLockModalMode(null)}
                    disabled={lockSubmitting}
                    className="rounded-xl border border-line bg-surface-2/40 px-4 py-2 text-xs font-semibold text-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLock}
                    disabled={lockSubmitting}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-glow-sm transition-all active:scale-95 cursor-pointer',
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
    </div>
  )
}
