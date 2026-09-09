import { useState, useRef, useEffect } from 'react'
import { RefreshCw, Github, ExternalLink, Sparkles, Play, Pause, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import { isDesktop, desktopBridge } from '@/desktop/isDesktop'
import { CHANGELOG } from '@/content/changelog'
import { CREATOR } from '@/lib/constants'
import { APP_VERSION } from '@/lib/version'
import whatsNewVideo from '@/assets/video-pack/whats-new.mp4'
import { SettingsSection, SettingsCard, SettingsBadge } from '../SettingsUI'

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
        <code
          key={matchIndex}
          className="rounded bg-accent/15 px-1 py-0.2 text-[0.6875rem] text-accent font-mono border border-accent/10"
        >
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

export const UPDATE_MODE_STORAGE_KEY = 'protrack:update_mode'

export function UpdatesTab({
  appInfo,
  updateStatus,
  updateVersion,
  updateError,
  setWhatsNewOpen,
}) {
  const [checking, setChecking] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [updateMode, setUpdateMode] = useState(() => {
    try {
      return localStorage.getItem(UPDATE_MODE_STORAGE_KEY) || 'auto'
    } catch {
      return 'auto'
    }
  })
  const videoRef = useRef(null)

  const handleUpdateModeChange = (mode) => {
    setUpdateMode(mode)
    try {
      localStorage.setItem(UPDATE_MODE_STORAGE_KEY, mode)
    } catch {}
    toast.success(
      mode === 'manual'
        ? 'Manual mode active: automatic background downloads are deferred.'
        : 'Automatic background updates enabled.'
    )
  }

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay policy might require user interaction, muted avoids this in most browsers
      })
    }
  }, [])

  const toggleVideoPlayback = (e) => {
    e.stopPropagation()
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
    }
  }

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

  return (
    <div className="space-y-8 pb-4">
      {/* ── App Updates & Deployment ─────────────────────────────────── */}
      {isDesktop && appInfo?.storeBuild && (
        <SettingsSection
          title="App Updates & Channel"
          description="Automatic background package deployment managed through the Windows Store."
        >
          <SettingsCard className="p-5">
            <p className="text-xs leading-relaxed text-muted">
              This installation is managed by the{' '}
              <span className="font-semibold text-ink">Microsoft Store</span> — updates download and
              apply automatically in the background.
            </p>
          </SettingsCard>
        </SettingsSection>
      )}

      {isDesktop && !appInfo?.storeBuild && (
        <SettingsSection
          title="App Updates & Channel"
          description="Manage automatic vs. manual update deployment to prevent unexpected background downloads."
        >
          <div className="space-y-3.5">
            {/* Delivery Mode Selector */}
            <SettingsCard className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line/40">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-ink">Update Delivery Mode</span>
                    <SettingsBadge variant={updateMode === 'auto' ? 'emerald' : 'amber'}>
                      {updateMode === 'auto' ? 'Automatic Silent' : 'Manual / Defer'}
                    </SettingsBadge>
                  </div>
                  <p className="mt-1 text-xs text-muted leading-relaxed">
                    Choose whether ProTrack downloads updates silently in the background or waits for manual consent.
                  </p>
                </div>

                <div className="flex rounded-xl border border-line/60 bg-surface-2/40 p-1 shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleUpdateModeChange('auto')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                      updateMode === 'auto'
                        ? 'bg-accent text-white shadow-xs'
                        : 'text-muted hover:text-ink'
                    )}
                  >
                    Automatic
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateModeChange('manual')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                      updateMode === 'manual'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-muted hover:text-ink'
                    )}
                  >
                    Manual / Opt-Out
                  </button>
                </div>
              </div>

              {updateMode === 'manual' && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 space-y-1">
                  <p className="font-semibold text-amber-200">Manual Update Mode Active</p>
                  <p className="text-amber-300/90 leading-relaxed text-[0.6875rem]">
                    Automated background downloads are deferred until verified stable builds to keep your workstation light, preserve network bandwidth, and avoid mid-session pauses.
                  </p>
                </div>
              )}

              {/* Check for Updates Action */}
              <button
                onClick={
                  updateStatus === 'ready'
                    ? () => desktopBridge?.update?.install?.()
                    : checkForUpdates
                }
                disabled={checking || updateStatus === 'downloading'}
                className="flex w-full items-center justify-between rounded-xl border border-line/60 bg-surface-2/30 px-4 py-3 text-xs transition-colors hover:border-accent/40 disabled:opacity-60 cursor-pointer"
              >
                <span className="flex items-center gap-2.5 font-semibold text-ink">
                  <RefreshCw
                    className={cn(
                      'h-4 w-4 text-accent',
                      (checking || updateStatus === 'ready') && 'animate-spin'
                    )}
                  />
                  {updateStatus === 'ready' ? 'Restart & apply update' : 'Check for updates manually'}
                </span>
                <span className="text-xs text-muted font-mono font-semibold">
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
            </SettingsCard>
          </div>
        </SettingsSection>
      )}

      {/* ── What's New Autoplay Video ────────────────────────────────── */}
      <SettingsSection
        title="What's New Video Tour"
        description="Highlights of recent updates, timetable views, and focus tools."
      >
        <div
          onClick={() => setWhatsNewOpen(true)}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line/60 bg-surface-2/20 shadow-glass transition-all duration-300 hover:border-accent/50 hover:shadow-glow-sm"
        >
          <div className="relative aspect-video w-full overflow-hidden bg-black/80">
            <video
              ref={videoRef}
              src={whatsNewVideo}
              autoPlay
              muted
              playsInline
              loop
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            />
            {/* Overlay gradient & controls */}
            <div className="absolute inset-0 flex flex-col justify-between p-5 bg-gradient-to-t from-black/85 via-black/30 to-black/40 pointer-events-none">
              <div className="flex items-center justify-between pointer-events-auto">
                <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-white backdrop-blur-md flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  v{appInfo?.version || APP_VERSION} Release Tour
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleVideoPlayback}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 border border-white/20 text-white hover:bg-black/75 transition-colors cursor-pointer"
                    title={isPlaying ? 'Pause video' : 'Play video'}
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                  </button>
                  <span className="hidden sm:inline-block rounded-full bg-white/10 px-3 py-1 text-[0.6875rem] font-medium text-white/90 backdrop-blur-sm">
                    Click card for fullscreen tour
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between gap-4 pointer-events-auto">
                <div>
                  <p className="font-display text-base sm:text-lg font-bold text-white drop-shadow">
                    PRO TRACK Feature Tour
                  </p>
                  <p className="text-xs text-white/80 mt-0.5">
                    Explore timetable sync, deep focus scenes, scorecard analytics &amp; shortcuts
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-semibold text-white shadow-glow-xs backdrop-blur-md transition-all hover:bg-white/25 hover:border-white/40">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  <span>Watch Tour</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Version Identity ────────────────────────────────────────── */}
      <SettingsSection
        title="Version Identity"
        description="Current release build and open-source workstation development info."
      >
        <SettingsCard className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted">
            <div>
              <p className="font-semibold text-ink">
                PRO TRACK {appInfo?.version ? `v${appInfo.version}` : `v${APP_VERSION}`}
              </p>
              <p className="text-xs text-muted/80 mt-0.5">
                A calm, distraction-free productivity workstation.
              </p>
            </div>
            <a
              href={CREATOR.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline shrink-0"
            >
              <Github className="h-4 w-4" />
              Crafted by {CREATOR.name}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Changelog & Release Notes ───────────────────────────────── */}
      <SettingsSection
        title="Changelog & Historical Releases"
        description="Chronological record of recent features, visual improvements, and stability fixes."
      >
        <div className="max-h-[42vh] overflow-y-auto rounded-2xl border border-line/60 bg-surface-2/15 p-6 shadow-inner pr-4">
          <div className="relative border-l border-line/70 ml-2 pl-6 space-y-7 py-1">
            {CHANGELOG.map((c, idx) => (
              <div key={idx} className="relative group">
                {/* Timeline Node Dot */}
                <div className="absolute -left-[32px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-accent/30 bg-accent/10 shadow-xs transition-all duration-300 group-hover:border-accent/60 group-hover:scale-110">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                </div>

                {/* Release Content */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="rounded-md bg-accent/10 border border-accent/20 px-2 py-0.5 text-[0.625rem] font-mono font-bold text-accent tracking-wider uppercase">
                      v{c.version}
                    </span>
                    {c.date && (
                      <span className="text-[0.625rem] font-mono font-bold text-muted/80 uppercase tracking-wider">
                        {c.date}
                      </span>
                    )}
                  </div>

                  {c.title && (
                    <h5 className="font-bold text-ink text-xs mb-2 leading-tight">
                      {c.title}
                    </h5>
                  )}

                  <ul className="space-y-2.5">
                    {c.highlights.map((h, i) => {
                      const match = h.match(/^\*\*(.*?)\*\*:\s*(.*)$/)
                      if (match) {
                        const [_, title, desc] = match
                        return (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
                            <div className="flex-1">
                              <div className="font-bold text-ink text-xs leading-none mb-1">
                                {title}
                              </div>
                              <div className="text-xs leading-relaxed text-muted font-medium">
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
      </SettingsSection>
    </div>
  )
}
