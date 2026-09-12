import { useState, useEffect } from 'react'
import { X, Video, Plus, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import { VIDEO_PRESETS, youtubeId, toCanonicalYouTubeUrl } from '@/lib/focusScenes'
import { updateSettings } from '@/services/userService'
import { SettingsSection, SettingsCard, SettingsToggleRow } from '../SettingsUI'

export function FocusSceneTab({ user, settings }) {
  const [focusUrlInput, setFocusUrlInput] = useState(settings?.focusAudioUrl || '')
  const [focusVideoEnabled, setFocusVideoEnabled] = useState(settings?.focusVideoEnabled !== false)
  const [customPresets, setCustomPresets] = useState(settings?.customPresets || [])
  const [newPresetUrl, setNewPresetUrl] = useState('')
  const [newPresetLabel, setNewPresetLabel] = useState('')

  useEffect(() => {
    setFocusUrlInput(settings?.focusAudioUrl || '')
    setFocusVideoEnabled(settings?.focusVideoEnabled !== false)
    setCustomPresets(settings?.customPresets || [])
  }, [settings])

  const saveFocusAudio = async (url) => {
    const canonical = url ? toCanonicalYouTubeUrl(url) || url : ''
    setFocusUrlInput(canonical)
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

  const toggleFocusVideo = async (checked) => {
    setFocusVideoEnabled(checked)
    try {
      await updateSettings(user.uid, { focusVideoEnabled: checked })
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
    const inDefault = VIDEO_PRESETS.find((p) => youtubeId(p.url) === id)
    if (inDefault) {
      toast.info(`Already in presets as "${inDefault.label}"`)
      saveFocusAudio(inDefault.url)
      setNewPresetUrl('')
      setNewPresetLabel('')
      return
    }

    const inCustom = customPresets.find((p) => youtubeId(p.url) === id)
    if (inCustom) {
      toast.info(`Already in your custom scenes as "${inCustom.label}"`)
      saveFocusAudio(inCustom.url)
      setNewPresetUrl('')
      setNewPresetLabel('')
      return
    }

    let label = newPresetLabel.trim() || `Custom Scene ${customPresets.length + 1}`
    const newPreset = { label, url: canonicalUrl }
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

  return (
    <div className="space-y-8 pb-4">
      {/* ── Preset Atmosphere Grid ─────────────────────────────────── */}
      <SettingsSection
        title="Atmospheric Focus Scenes"
        description="Plays a serene ambient YouTube scene in the background behind your Pomodoro focus timer."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {VIDEO_PRESETS.map((p) => {
            const isSelected =
              focusUrlInput === p.url ||
              (Boolean(focusUrlInput) && youtubeId(focusUrlInput) === youtubeId(p.url))
            return (
              <button
                key={p.url}
                type="button"
                onClick={() => saveFocusAudio(p.url)}
                className={cn(
                  'flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none',
                  isSelected
                    ? 'border-accent bg-accent/15 text-ink shadow-glow-xs ring-1 ring-accent/30 font-bold'
                    : 'border-line/60 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60',
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                      isSelected ? 'bg-accent text-white shadow-xs' : 'bg-surface text-muted'
                    )}
                  >
                    <Video className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold truncate">{p.label}</span>
                </div>
                {isSelected && (
                  <span className="flex h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse ml-2" />
                )}
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
                  type="button"
                  onClick={() => saveFocusAudio(p.url)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-2xl border p-4 pl-4 pr-11 text-left transition-all duration-200 cursor-pointer select-none',
                    isSelected
                      ? 'border-accent bg-accent/15 text-ink shadow-glow-xs ring-1 ring-accent/30 font-bold'
                      : 'border-line/60 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                        isSelected ? 'bg-accent text-white shadow-xs' : 'bg-surface text-muted'
                      )}
                    >
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-semibold truncate">{p.label}</span>
                  </div>
                  {isSelected && (
                    <span className="flex h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse ml-2" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={(e) => deleteCustomPreset(idx, e)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg border border-line/60 bg-surface/90 text-muted hover:text-rose-500 hover:border-rose-500/30 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                  title="Delete custom scene"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => saveFocusAudio('')}
            className={cn(
              'flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none',
              !focusUrlInput
                ? 'border-accent bg-accent/15 text-ink shadow-glow-xs ring-1 ring-accent/30 font-bold'
                : 'border-line/60 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60',
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors',
                  !focusUrlInput ? 'bg-accent text-white shadow-xs' : 'bg-surface text-muted'
                )}
              >
                <X className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold">Off / None</span>
            </div>
            {!focusUrlInput && (
              <span className="flex h-2 w-2 shrink-0 rounded-full bg-accent animate-pulse ml-2" />
            )}
          </button>
        </div>
      </SettingsSection>

      {/* ── Custom Scene Input ───────────────────────────────────────── */}
      <SettingsSection
        title="Add Custom YouTube Atmosphere"
        description="Link any relaxing study livestream, lofi audio, or ambient video by URL or YouTube ID."
      >
        <SettingsCard className="space-y-4 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Video URL or Video ID</label>
              <input
                type="url"
                value={newPresetUrl}
                onChange={(e) => setNewPresetUrl(e.target.value)}
                placeholder="https://youtu.be/... or 11-char ID"
                disabled={customPresets.length >= 5}
                className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-accent focus:bg-surface disabled:opacity-50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-ink">Scene Label (Optional)</label>
              <input
                type="text"
                value={newPresetLabel}
                onChange={(e) => setNewPresetLabel(e.target.value)}
                placeholder="e.g. Rainy Kyoto Cafe"
                disabled={customPresets.length >= 5}
                className="w-full rounded-xl border border-line/70 bg-surface-2/30 px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-accent focus:bg-surface disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <span className="font-mono text-[10px] text-muted font-medium">
              {customPresets.length >= 5
                ? 'Maximum of 5 custom scenes reached'
                : `${5 - customPresets.length} slots available (max 5)`}
            </span>
            <button
              type="button"
              onClick={addCustomPreset}
              disabled={!newPresetUrl.trim() || customPresets.length >= 5}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white shadow-glow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Custom Scene</span>
            </button>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Focus Video Background Toggle ───────────────────────────── */}
      <SettingsSection
        title="Focus Screen Rendering"
        description="Control video player rendering on fullscreen Deep Focus sessions."
      >
        <SettingsToggleRow
          icon={Video}
          title="Render Video Background"
          description="Displays ambient video visuals on fullscreen focus mode. Turn off for audio-only ambient playback."
          checked={focusVideoEnabled}
          onChange={toggleFocusVideo}
        />
      </SettingsSection>
    </div>
  )
}
