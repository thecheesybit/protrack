import { useState, useEffect } from 'react'
import { ExternalLink, ChevronDown, Calendar, RefreshCw } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import { updateSettings } from '@/services/userService'
import {
  getGeminiKey, setGeminiKey,
  getElevenLabsKey, setElevenLabsKey,
  getOpenAIKey, setOpenAIKey,
  getAnthropicKey, setAnthropicKey,
  getDeepSeekKey, setDeepSeekKey,
  hasApiKey
} from '@/services/geminiService'
import {
  listVoices,
  primeVoices,
  getVoicePreference,
  setVoicePreference,
  getProviderPreference,
  setProviderPreference,
} from '@/lib/tts'
import {
  isCalendarConnected,
  connectCalendar,
  resetCalendarSyncState,
  getLastSyncAt,
} from '@/services/calendarService'
import { GCAL_SYNC_NOW_EVENT } from '@/hooks/useCalendarSync'
import { GCAL_ENABLED } from '@/lib/flags'
import { SettingsSection, SettingsCard, SettingsBadge, SettingsToggleRow } from '../SettingsUI'

function formatLastSync(ms) {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`
  return new Date(ms).toLocaleDateString()
}

export function IntegrationsTab({ user, settings, modes, activeModeId }) {
  const [keyInput, setKeyInput] = useState(() => getGeminiKey())
  const [openaiInput, setOpenaiInput] = useState(() => getOpenAIKey())
  const [anthropicInput, setAnthropicInput] = useState(() => getAnthropicKey())
  const [elevenlabsInput, setElevenlabsInput] = useState(() => getElevenLabsKey())
  const [deepseekInput, setDeepseekInput] = useState(() => getDeepSeekKey())

  const [expandedProvider, setExpandedProvider] = useState(null)
  const [aiPreferred, setAiPreferred] = useState(
    () => localStorage.getItem('protrack:ai_preferred_provider') || 'auto'
  )

  const [ttsProvider, setTtsProvider] = useState(() => getProviderPreference())
  const [ttsVoiceURI, setTtsVoiceURI] = useState(() => getVoicePreference())
  const [ttsVoices, setTtsVoices] = useState([])
  const [calConnected, setCalConnected] = useState(() => isCalendarConnected())

  useEffect(() => {
    primeVoices()
    setTtsVoices(listVoices())
    const timer = setTimeout(() => setTtsVoices(listVoices()), 300)
    return () => clearTimeout(timer)
  }, [])

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

  const handleConnectCal = async () => {
    try {
      await connectCalendar()
      setCalConnected(true)
      toast.success('Google Calendar connected')
      window.dispatchEvent(new Event(GCAL_SYNC_NOW_EVENT))
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDisconnectCal = () => {
    resetCalendarSyncState()
    setCalConnected(false)
    toast.success('Google Calendar disconnected')
  }

  const handleSyncNow = () => {
    window.dispatchEvent(new Event(GCAL_SYNC_NOW_EVENT))
    toast.success('Syncing Google Calendar…')
  }

  const handleSetGcalInboxMode = async (modeId) => {
    try {
      await updateSettings(user.uid, { gcalInboxModeId: modeId })
    } catch (err) {
      console.error('[settings] gcal inbox mode save failed', err)
    }
  }

  const handleToggleGcalAutoSync = async (next) => {
    try {
      await updateSettings(user.uid, { gcalAutoSync: next })
      if (next) window.dispatchEvent(new Event(GCAL_SYNC_NOW_EVENT))
    } catch (err) {
      console.error('[settings] gcal auto-sync save failed', err)
    }
  }

  return (
    <div className="space-y-8 pb-4">
      {/* ── Artificial Intelligence Routing ──────────────────────────── */}
      <SettingsSection
        title="Artificial Intelligence & Model Routing"
        description="Connect your private model credentials. API keys remain strictly local to this machine."
      >
        <SettingsCard className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink">
                Preferred Primary Provider
              </label>
              <p className="text-[11px] text-muted mt-0.5">
                Primary provider for chat tutor, syllabus breakdown, and voice summaries. Automatic falls back seamlessly.
              </p>
            </div>
            <select
              value={aiPreferred}
              onChange={(e) => savePreferredProvider(e.target.value)}
              className="rounded-xl border border-line/70 bg-surface-2/40 px-3.5 py-2 text-xs font-semibold text-ink outline-none focus:border-accent"
            >
              <option value="auto">Automatic (Auto-Fallback)</option>
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (GPT-4o-mini)</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="deepseek">DeepSeek-V3</option>
            </select>
          </div>
        </SettingsCard>

        {/* Expandable Accordion Provider Key Configuration List */}
        <div className="space-y-2.5">
          {[
            {
              id: 'gemini',
              label: 'Google Gemini',
              desc: 'Powers the study companion, voice transcript summaries, and custom quotes.',
              keyPlaceholder: 'AIzaSy...',
              link: 'https://aistudio.google.com/app/apikey',
              linkText: 'Get free key',
              val: keyInput,
              setVal: setKeyInput,
              onSave: saveKey,
            },
            {
              id: 'openai',
              label: 'OpenAI (GPT)',
              desc: 'Use OpenAI models for chat, tutoring assistance, and general intelligence.',
              keyPlaceholder: 'sk-proj-...',
              val: openaiInput,
              setVal: setOpenaiInput,
              onSave: saveOpenAIKey,
            },
            {
              id: 'anthropic',
              label: 'Anthropic (Claude)',
              desc: 'Connect Claude models for advanced coding explanations and analytical breakdowns.',
              keyPlaceholder: 'sk-ant-...',
              val: anthropicInput,
              setVal: setAnthropicInput,
              onSave: saveAnthropicKey,
            },
            {
              id: 'elevenlabs',
              label: 'ElevenLabs Voice',
              desc: 'Enables hyper-realistic, natural voice generation when reading Zen quotes aloud.',
              keyPlaceholder: 'ElevenLabs Key...',
              val: elevenlabsInput,
              setVal: setElevenlabsInput,
              onSave: saveElevenLabsKey,
            },
            {
              id: 'deepseek',
              label: 'DeepSeek',
              desc: 'Access cost-efficient, high-performance DeepSeek reasoning models.',
              keyPlaceholder: 'DeepSeek Key...',
              val: deepseekInput,
              setVal: setDeepseekInput,
              onSave: saveDeepSeekKey,
            },
          ].map((prov) => {
            const isConfigured = hasApiKey(prov.id)
            const isExpanded = expandedProvider === prov.id
            return (
              <div
                key={prov.id}
                className="rounded-2xl border border-line/60 bg-surface-2/20 overflow-hidden transition-all duration-200"
              >
                {/* Row Header */}
                <button
                  type="button"
                  onClick={() => setExpandedProvider(isExpanded ? null : prov.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-surface-2/40 transition-colors text-left cursor-pointer"
                >
                  <div className="flex flex-col items-start gap-1 min-w-0 flex-1 pr-3">
                    <span className="text-xs font-bold text-ink">{prov.label}</span>
                    <span className="text-[11px] text-muted line-clamp-1">{prov.desc}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SettingsBadge variant={isConfigured ? 'emerald' : 'muted'}>
                      {isConfigured ? 'Configured' : 'Missing'}
                    </SettingsBadge>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 text-muted transition-transform duration-200',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </div>
                </button>

                {/* Row Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-line/40 bg-surface-2/10 p-5 space-y-3.5"
                    >
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <input
                          type="password"
                          value={prov.val}
                          onChange={(e) => prov.setVal(e.target.value)}
                          placeholder={prov.keyPlaceholder}
                          className="flex-1 rounded-xl border border-line/70 bg-surface px-3.5 py-2.5 text-xs text-ink outline-none transition-colors focus:border-accent"
                        />
                        <button
                          type="button"
                          onClick={prov.onSave}
                          className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white shadow-glow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                        >
                          Save Key
                        </button>
                      </div>
                      {prov.link && (
                        <a
                          href={prov.link}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline font-semibold"
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
      </SettingsSection>

      {/* ── Voice Synthesis & Hands-Free ─────────────────────────────── */}
      <SettingsSection
        title="Voice Synthesis & Hands-Free Loops"
        description="Tune conversational turn limits and spoken synthesis voices."
      >
        <SettingsCard className="space-y-5 p-5 sm:p-6">
          {/* Hands-Free Turn Limit Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink">Hands-Free Turn Limit</label>
              <span className="font-mono text-xs font-bold text-accent bg-accent/10 border border-accent/20 rounded-lg px-2.5 py-0.5">
                {settings?.handsFreeTurnLimit || 6} turns
              </span>
            </div>
            <p className="text-[11px] text-muted">
              Maximum consecutive speech-response turns before requiring re-activation.
            </p>
            <input
              type="range"
              min="1"
              max="20"
              value={settings?.handsFreeTurnLimit || 6}
              onChange={(e) =>
                updateSettings(user.uid, { handsFreeTurnLimit: Number(e.target.value) })
              }
              className="w-full accent-accent cursor-pointer"
            />
          </div>

          {/* Assistant Spoken Voice */}
          <div className="pt-4 border-t border-line/40 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink">Assistant Voice Engine</label>
              <p className="text-[11px] text-muted mt-0.5">
                Select between neural ElevenLabs/OpenAI synthesis or built-in system TTS.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={ttsProvider}
                onChange={(e) => {
                  setTtsProvider(e.target.value)
                  setProviderPreference(e.target.value)
                }}
                className="rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-accent"
              >
                <option value="auto">Auto (ElevenLabs → OpenAI → Device)</option>
                <option value="elevenlabs">ElevenLabs Neural Voice</option>
                <option value="openai">OpenAI TTS</option>
                <option value="web">Device Native TTS Voice</option>
              </select>

              <select
                value={ttsVoiceURI}
                onChange={(e) => {
                  setTtsVoiceURI(e.target.value)
                  setVoicePreference(e.target.value)
                }}
                className="rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-accent"
              >
                <option value="">Best Available Native Voice</option>
                {ttsVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </SettingsCard>
      </SettingsSection>

      {/* ── Google Calendar Synchronization ─────────────────────────── */}
      {GCAL_ENABLED && (
        <SettingsSection
          title="Calendar Synchronization"
          description="Synchronize timetable study slots and review alerts directly to Google Calendar."
        >
          {calConnected ? (
            <div className="space-y-3.5">
              <SettingsCard className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-emerald-500/25 bg-emerald-500/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">Google Calendar Connected</span>
                      <SettingsBadge variant="emerald">Live</SettingsBadge>
                    </div>
                    <span className="text-[11px] text-muted font-mono">
                      Last sync: {formatLastSync(getLastSyncAt())}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink hover:border-accent transition-colors cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Sync Now
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectCal}
                    className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-3.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>
              </SettingsCard>

              <SettingsToggleRow
                icon={RefreshCw}
                title="Auto-Sync While App is Open"
                description="Automatically syncs timetable on launch, on focus, and periodically every 5 minutes."
                checked={settings?.gcalAutoSync !== false}
                onChange={handleToggleGcalAutoSync}
              />

              {modes?.length > 0 && (
                <SettingsCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-semibold text-ink">
                      Default Mode for Google Events
                    </span>
                    <span className="block text-[11px] text-muted mt-0.5">
                      Events imported from Google Calendar land into this workspace mode.
                    </span>
                  </div>
                  <select
                    value={
                      settings?.gcalInboxModeId ||
                      (activeModeId !== 'all' ? activeModeId : modes[0]?.id) ||
                      ''
                    }
                    onChange={(e) => handleSetGcalInboxMode(e.target.value)}
                    className="rounded-xl border border-line/70 bg-surface-2/40 px-3 py-2 text-xs font-semibold text-ink outline-none focus:border-accent"
                  >
                    {modes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </SettingsCard>
              )}
            </div>
          ) : (
            <SettingsCard className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2/60 border border-line/60 text-muted">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-ink">
                    Google Calendar Not Linked
                  </span>
                  <span className="block text-[11px] text-muted mt-0.5">
                    Connect your Google account to sync timetable slots and exam milestones.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleConnectCal}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-white shadow-glow-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <Calendar className="h-4 w-4" />
                <span>Connect Calendar</span>
              </button>
            </SettingsCard>
          )}
        </SettingsSection>
      )}
    </div>
  )
}
