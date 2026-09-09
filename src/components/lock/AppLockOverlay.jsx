import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Unlock, ShieldAlert, Clock, Lightbulb, Delete, ChevronRight, X, Minus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  verifyPin,
  getRemainingLockoutMs,
  recordFailedAttempt,
  clearLockoutState,
} from '@/services/lockService'
import { desktopBridge } from '@/desktop/isDesktop'
import { auth } from '@/lib/firebase'
import { deriveUniqueCode, initSessionFromAccount } from '@/services/cryptoService'
import lockImg from '@/assets/lock.gif'

/**
 * Format remaining lockout seconds into MM:SS or H:MM:SS format.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatLockoutTime(totalSeconds) {
  if (totalSeconds <= 0) return '0:00'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function AppLockOverlay() {
  const isLocked = useStore((s) => s.isLocked)
  const unlockApp = useStore((s) => s.unlockApp)
  const lockConfig = useStore((s) => s.lockConfig)
  const refreshLockConfig = useStore((s) => s.refreshLockConfig)

  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [isUnlocking, setIsUnlocking] = useState(false)
  const [remainingLockoutMs, setRemainingLockoutMs] = useState(() => getRemainingLockoutMs())

  const isLockedOut = remainingLockoutMs > 0

  // Ensure lockConfig is fresh and initialize lockout timer when overlay appears
  useEffect(() => {
    if (isLocked) {
      refreshLockConfig()
      setPin('')
      setError('')
      setShowHint(false)
      setIsUnlocking(false)

      const initialMs = getRemainingLockoutMs()
      setRemainingLockoutMs(initialMs)
    }
  }, [isLocked, refreshLockConfig])

  // Real-time countdown timer for lockout
  useEffect(() => {
    if (!isLocked) return

    const ms = getRemainingLockoutMs()
    setRemainingLockoutMs(ms)
    if (ms <= 0) return

    const interval = setInterval(() => {
      const currentMs = getRemainingLockoutMs()
      setRemainingLockoutMs(currentMs)
      if (currentMs <= 0) {
        clearInterval(interval)
        setError('')
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [isLocked, isLockedOut])

  // Attempt unlock with current PIN
  const handleUnlock = useCallback(
    async (pinToVerify) => {
      if (isLockedOut || isUnlocking) return

      const code = pinToVerify || pin
      if (!code) {
        setError('Please enter your PIN')
        setShake(true)
        setTimeout(() => setShake(false), 500)
        return
      }

      try {
        const isValid = await verifyPin(code)
        if (isValid) {
          // Initialize active encryption session with validated PIN
          const currentUser = auth?.currentUser
          const uid = currentUser?.uid || ''
          const uniqueCode = deriveUniqueCode(uid)
          await initSessionFromAccount(uid, uniqueCode, code)

          clearLockoutState()
          setRemainingLockoutMs(0)
          setIsUnlocking(true)
          setError('')
          // Allow doorway light animation to flourish before dismissing overlay
          setTimeout(() => {
            unlockApp()
            setPin('')
            setIsUnlocking(false)
          }, 350)
        } else {
          // Record failed attempt and compute new lockout if threshold reached
          const lockout = recordFailedAttempt()
          const ms = getRemainingLockoutMs()
          setRemainingLockoutMs(ms)
          setShake(true)
          setPin('')

          if (ms > 0) {
            setError('')
          } else {
            const remainingAttempts = 3 - lockout.failedAttempts
            if (remainingAttempts === 1) {
              setError('Incorrect PIN. 1 attempt remaining before 5 min lockout.')
            } else {
              setError('Incorrect PIN. Try again.')
            }
          }

          setTimeout(() => {
            setShake(false)
          }, 450)
        }
      } catch (err) {
        setError(err.message || 'Verification failed')
        setShake(true)
        setTimeout(() => setShake(false), 500)
      }
    },
    [pin, isLockedOut, isUnlocking, unlockApp],
  )

  // Handle number input (0-9) - length is secret, instant seamless auto-unlock the moment PIN matches
  const handleDigit = useCallback(
    (digit) => {
      if (isUnlocking || isLockedOut) return
      setError('')
      setPin((prev) => {
        if (prev.length >= 12) return prev
        const next = prev + digit

        // Seamless instant verification on every keystroke
        verifyPin(next)
          .then(async (isValid) => {
            if (isValid) {
              const currentUser = auth?.currentUser
              const uid = currentUser?.uid || ''
              const uniqueCode = deriveUniqueCode(uid)
              await initSessionFromAccount(uid, uniqueCode, next)

              clearLockoutState()
              setRemainingLockoutMs(0)
              setIsUnlocking(true)
              setError('')
              setTimeout(() => {
                unlockApp()
                setPin('')
                setIsUnlocking(false)
              }, 350)
            }
          })
          .catch(() => {
            /* ignore background keystroke check errors */
          })

        return next
      })
    },
    [isUnlocking, isLockedOut, unlockApp],
  )

  const handleBackspace = useCallback(() => {
    if (isUnlocking || isLockedOut) return
    setError('')
    setPin((prev) => prev.slice(0, -1))
  }, [isUnlocking, isLockedOut])

  // Global physical keyboard listener
  useEffect(() => {
    if (!isLocked) return

    const handleKeyDown = (e) => {
      if (isUnlocking || isLockedOut) return

      // Number keys 0-9 (standard keyboard & numpad)
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        handleDigit(e.key)
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        handleBackspace()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleUnlock()
      } else if (e.key === 'Escape') {
        setPin('')
        setError('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLocked, isUnlocking, isLockedOut, handleDigit, handleBackspace, handleUnlock])

  if (!isLocked) return null

  const remainingSeconds = Math.ceil(remainingLockoutMs / 1000)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg/95 dark:bg-[#09090e]/95 backdrop-blur-2xl select-none p-4 overflow-y-auto"
      >
        {/* Desktop window controls (minimize / close) so user is never trapped */}
        {desktopBridge?.window && (
          <div className="absolute top-0 right-0 z-10 flex h-10 items-center gap-1 pe-3 pt-1">
            <button
              onClick={() => desktopBridge.window.minimize?.()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted/80 transition-colors hover:bg-white/10 hover:text-white"
              title="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => desktopBridge.window.close?.()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted/80 transition-colors hover:bg-red-500/80 hover:text-white"
              title="Close to Tray"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Ambient warm golden / security red glow radiating from behind artwork */}
        <div
          className={`pointer-events-none absolute h-96 w-96 rounded-full blur-3xl transition-all duration-700 ${
            isLockedOut
              ? 'bg-rose-500/20 scale-110'
              : isUnlocking
              ? 'scale-150 bg-amber-400/30'
              : 'scale-100 bg-amber-500/15'
          }`}
        />

        {/* Main Card */}
        <motion.div
          animate={
            shake
              ? { x: [-10, 10, -8, 8, -4, 4, 0] }
              : isUnlocking
              ? { scale: 1.03, opacity: 0.9 }
              : { scale: 1, opacity: 1 }
          }
          transition={{ duration: shake ? 0.45 : 0.3 }}
          className="relative flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/10 bg-surface/90 px-6 py-7 shadow-2xl backdrop-blur-3xl"
        >
          {/* Central Artwork */}
          <div className="relative mb-5 flex flex-col items-center">
            <motion.div
              animate={isUnlocking ? { scale: 1.06, filter: 'brightness(1.2)' } : { scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`relative h-32 w-32 md:h-36 md:w-36 overflow-hidden rounded-2xl border transition-all ${
                isLockedOut
                  ? 'border-rose-500/40 shadow-[0_0_35px_rgba(244,63,94,0.25)]'
                  : 'border-amber-500/30 shadow-[0_0_35px_rgba(251,191,36,0.25)]'
              }`}
            >
              <img
                src={lockImg}
                alt="Workspace Lock"
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.src = '/lock.gif'
                }}
              />
              {/* Overlay shimmer */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </motion.div>

            {/* Lock Status Pill */}
            <div
              className={`mt-3 flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-semibold ${
                isLockedOut
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              }`}
            >
              {isUnlocking ? (
                <>
                  <Unlock className="h-3 w-3 animate-pulse" />
                  <span>Entering Workspace…</span>
                </>
              ) : isLockedOut ? (
                <>
                  <ShieldAlert className="h-3 w-3 animate-pulse" />
                  <span>Locked Out ({formatLockoutTime(remainingSeconds)})</span>
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  <span>Workspace Locked</span>
                </>
              )}
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-base font-bold tracking-tight text-ink">
            {isUnlocking
              ? 'Welcome Back'
              : isLockedOut
              ? 'Security Lockout'
              : 'Enter PIN to Unlock'}
          </h2>
          <p className="mt-1 text-xs text-muted text-center">
            {isUnlocking
              ? 'Opening your workspace…'
              : isLockedOut
              ? 'Too many failed attempts. Access is temporarily suspended.'
              : 'Enter your PIN'}
          </p>

          {/* PIN Indicator Dots or Lockout Countdown Banner */}
          {isLockedOut ? (
            <div className="my-5 flex w-full max-w-[260px] flex-col items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3.5 text-center">
              <div className="flex items-center gap-1.5 text-rose-400">
                <Clock className="h-4 w-4 animate-pulse" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Try again in</span>
              </div>
              <span className="mt-1 font-mono text-3xl font-extrabold tracking-widest text-rose-400">
                {formatLockoutTime(remainingSeconds)}
              </span>
              <span className="mt-1.5 text-[10px] text-rose-300/70">
                Lockout timer doubles on every subsequent incorrect attempt
              </span>
            </div>
          ) : (
            <div className="my-5 flex h-7 items-center justify-center gap-2.5">
              {pin.length === 0 ? (
                <div className="h-1.5 w-8 rounded-full bg-white/20 animate-pulse" />
              ) : (
                pin.split('').map((_, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className={`h-3.5 w-3.5 rounded-full border-2 ${
                      error
                        ? 'border-rose-500 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]'
                        : 'border-amber-400 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                    }`}
                  />
                ))
              )}
            </div>
          )}

          {/* Error Message */}
          {error && !isLockedOut && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 text-center text-xs font-semibold text-rose-500"
            >
              {error}
            </motion.p>
          )}

          {/* On-Screen Numeric Keypad */}
          <div
            className={`grid w-full max-w-[260px] grid-cols-3 gap-2.5 transition-opacity duration-200 ${
              isLockedOut ? 'opacity-30 pointer-events-none' : 'opacity-100'
            }`}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(String(num))}
                disabled={isUnlocking || isLockedOut}
                className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-base font-bold text-ink shadow-sm transition-all duration-150 hover:border-amber-500/40 hover:bg-amber-500/10 active:scale-95 disabled:opacity-50"
              >
                {num}
              </button>
            ))}

            {/* Hint / Forgot PIN button */}
            <button
              type="button"
              onClick={() => setShowHint((prev) => !prev)}
              disabled={isLockedOut || isUnlocking}
              className={`flex h-11 items-center justify-center rounded-xl border text-xs font-semibold transition-all duration-150 active:scale-95 disabled:opacity-40 ${
                showHint
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-400'
                  : 'border-white/10 bg-white/5 text-muted hover:border-white/20 hover:text-ink'
              }`}
              title="Show PIN Hint"
            >
              <Lightbulb className="h-4 w-4" />
            </button>

            {/* Zero */}
            <button
              type="button"
              onClick={() => handleDigit('0')}
              disabled={isUnlocking || isLockedOut}
              className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-base font-bold text-ink shadow-sm transition-all duration-150 hover:border-amber-500/40 hover:bg-amber-500/10 active:scale-95 disabled:opacity-50"
            >
              0
            </button>

            {/* Backspace */}
            <button
              type="button"
              onClick={handleBackspace}
              disabled={isUnlocking || isLockedOut || pin.length === 0}
              className="flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted shadow-sm transition-all duration-150 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 disabled:opacity-40"
              title="Backspace"
            >
              <Delete className="h-4 w-4" />
            </button>
          </div>

          {/* Action Row */}
          <div className="mt-4 flex w-full max-w-[260px] flex-col gap-2">
            <button
              type="button"
              onClick={() => handleUnlock()}
              disabled={pin.length === 0 || isUnlocking || isLockedOut}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-xs font-bold text-black shadow-glow-sm transition-all hover:brightness-110 active:scale-98 disabled:opacity-40 disabled:pointer-events-none"
            >
              {isLockedOut ? (
                <span>Locked Out ({formatLockoutTime(remainingSeconds)})</span>
              ) : (
                <>
                  <span>Unlock Workspace</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>

            {/* Hint accordion */}
            <AnimatePresence>
              {showHint && !isLockedOut && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left"
                >
                  <div className="flex items-start gap-2">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                    <div>
                      <p className="text-[11px] font-bold text-amber-400">PIN Hint</p>
                      <p className="mt-0.5 text-xs text-ink/90">
                        {lockConfig?.hint || 'No hint configured.'}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
