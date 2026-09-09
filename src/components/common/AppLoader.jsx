import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { LogOut, AlertTriangle, RefreshCw } from 'lucide-react'
import logo from '@/assets/a9.png'
import { LOADING_MESSAGES, getRandomLoadingMessage } from '@/lib/loadingMessages'
import { APP_VERSION } from '@/lib/version'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'

/**
 * Deterministic starfield matching AuroraBackground.
 * Uses Park-Miller PRNG with fixed seed 42 so celestial positions seamlessly match the workspace.
 */
const STARS = (() => {
  let seed = 42
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 90 }, (_, i) => ({
    id: i,
    x: rand() * 100,
    y: rand() * 85,
    r: rand() < 0.75 ? 0.9 : 1.5,
    delay: rand() * 5,
    dur: 2.4 + rand() * 4,
  }))
})()

/** Full-screen boot loader with ProTrack's signature obsidian aurora and celestial aesthetic. */
export function AppLoader({ error: customError }) {
  const { loadingStatus, error: authError, signOut } = useAuth()
  const displayError = customError || authError

  const [displayVersion, setDisplayVersion] = useState(APP_VERSION)
  useEffect(() => {
    if (isDesktop && desktopBridge?.appInfo) {
      desktopBridge.appInfo().then((info) => {
        if (info?.version) setDisplayVersion(info.version)
      }).catch(() => {})
    }
  }, [])

  // Random loading text selected on mount, with gentle rotation if loading takes longer
  const [randomText, setRandomText] = useState(() => getRandomLoadingMessage())

  useEffect(() => {
    const interval = setInterval(() => {
      setRandomText((prev) => {
        let next = getRandomLoadingMessage()
        while (next === prev && LOADING_MESSAGES.length > 1) {
          next = getRandomLoadingMessage()
        }
        return next
      })
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  // Prioritize slow-network or error warnings; otherwise showcase curated motivational messages
  const currentStatus = (loadingStatus && loadingStatus.startsWith('Network is slow'))
    ? loadingStatus
    : randomText

  return (
    <motion.div
      key="loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      className="fixed inset-0 z-40 flex flex-col items-center justify-between p-6 select-none overflow-hidden bg-[#07080c]"
    >
      {/* ── Ambient Cosmic Aurora & Starfield (Matches ProTrack Project Canvas from y=0 to y=100%) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
        {/* Deep atmospheric sky wash & radial lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(99,102,241,0.18)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.06)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(56,189,248,0.08)_0%,transparent_60%)]" />

        {/* Shifting multi-color aurora blooms */}
        <div className="absolute -left-36 -top-36 h-[40rem] w-[40rem] animate-aurora rounded-full bg-indigo-600/15 blur-[140px]" />
        <div
          className="absolute -right-36 top-1/4 h-[38rem] w-[38rem] animate-aurora rounded-full bg-purple-600/12 blur-[140px]"
          style={{ animationDelay: '-7s' }}
        />
        <div
          className="absolute bottom-[-8rem] left-1/3 h-[34rem] w-[34rem] animate-aurora rounded-full bg-sky-500/10 blur-[150px]"
          style={{ animationDelay: '-14s' }}
        />

        {/* ProTrack Signature Dotted Blueprint Grid */}
        <div className="absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black_35%,transparent_90%)]" />

        {/* Deterministic celestial starfield */}
        <svg className="absolute inset-0 h-full w-full opacity-80" aria-hidden="true">
          {STARS.map((s) => (
            <circle
              key={s.id}
              cx={`${s.x}%`}
              cy={`${s.y}%`}
              r={s.r}
              className="animate-twinkle fill-white"
              style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
            />
          ))}
        </svg>

        {/* Depth vignettes */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#07080c]/80 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#07080c]/80 to-transparent" />
      </div>

      {/* Top spacer (reserves TitleBar height on desktop so content stays optically centered) */}
      <div className="h-9 shrink-0 z-10" />

      {/* ── Centerpiece: Celestial Emblem + Brand & Version + Progress Indicator ── */}
      <div className="z-10 flex flex-col items-center justify-center gap-8 my-auto w-full max-w-lg px-6">
        {displayError ? (
          <div className="flex flex-col items-center gap-4 text-center max-w-md p-8 rounded-3xl border border-red-500/20 bg-red-950/20 backdrop-blur-2xl shadow-glass">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 border border-red-500/40">
              <AlertTriangle className="h-6 w-6 text-red-400" />
            </div>
            <h2 className="text-lg font-bold text-red-400 font-sans tracking-tight">Loading Failed</h2>
            <p className="text-sm text-white/80">
              {displayError}
            </p>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white/90 hover:bg-white/20 transition-all cursor-pointer shadow-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reload app
              </button>
              {signOut && (
                <button
                  onClick={signOut}
                  className="flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-all cursor-pointer shadow-sm"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Celestial Gyroscope Emblem Card */}
            <div className="relative flex items-center justify-center">
              {/* Soft ambient aura pulse behind the emblem */}
              <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-indigo-500/25 via-purple-500/20 to-sky-400/20 blur-2xl animate-pulse pointer-events-none" />

              {/* Rotating outer orbital track with glowing tracer */}
              <div className="absolute h-36 w-36 sm:h-44 sm:w-44 rounded-full border border-indigo-500/20 animate-[spin_12s_linear_infinite] pointer-events-none">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_10px_#818cf8]" />
              </div>

              {/* Counter-revolving secondary ring */}
              <div className="absolute h-44 w-44 sm:h-52 sm:w-52 rounded-full border border-purple-500/15 animate-[spin_18s_linear_infinite_reverse] pointer-events-none">
                <div className="absolute top-1/2 -right-1 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc]" />
              </div>

              {/* Main Frosted Glass Emblem Shield housing PRO TRACK logo */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-3xl border border-white/20 bg-white/[0.04] backdrop-blur-2xl shadow-glass flex items-center justify-center p-4 ring-1 ring-white/10"
              >
                <img
                  src={logo}
                  alt="PRO Track"
                  className="h-full w-full object-contain select-none pointer-events-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]"
                />
              </motion.div>
            </div>

            {/* Typography & Version Pill Next To It */}
            <div className="flex flex-col items-center gap-3.5 text-center">
              <div className="flex items-center justify-center gap-2.5 sm:gap-3">
                <h1 className="font-outfit text-3xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-white/95 to-white/80 drop-shadow-sm">
                  PRO Track
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.08] backdrop-blur-md px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-white/85 shadow-sm ring-1 ring-white/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  v{displayVersion}
                </span>
              </div>

              {/* Dynamic Status / Motivational Quote */}
              <div className="h-7 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentStatus}
                    initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="text-sm sm:text-base font-medium tracking-wide text-white/90 drop-shadow-md text-center max-w-md px-4"
                  >
                    {currentStatus}
                  </motion.p>
                </AnimatePresence>
              </div>

              {/* Sleek Laser Shimmer Progress Bar */}
              <div className="relative mt-2 h-1.5 w-44 sm:w-56 overflow-hidden rounded-full bg-white/10 backdrop-blur-sm shadow-inner ring-1 ring-white/10">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full w-2/3 rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent"
                />
              </div>

              {/* Live Workspace Telemetry Status */}
              <div className="flex items-center gap-2 pt-1 text-[11px] font-mono tracking-wider text-white/40">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
                <span>Preparing workspace session</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Bottom Footer: Crafted with obsession by AYUSH KUMAR (10% bigger) ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
        className="pb-4 z-10 text-center select-none"
      >
        <p className="text-sm sm:text-[15px] font-semibold tracking-wider text-white/60 drop-shadow-sm">
          Crafted with obsession by <span className="font-bold text-white/95 tracking-widest">AYUSH KUMAR</span>
        </p>
      </motion.div>
    </motion.div>
  )
}
