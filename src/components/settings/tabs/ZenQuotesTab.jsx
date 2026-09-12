import { useState, useEffect } from 'react'
import { Sparkles, Volume2, Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import toast from 'react-hot-toast'
import { updateSettings } from '@/services/userService'
import { SettingsSection, SettingsCard, SettingsToggleRow } from '../SettingsUI'

const QUOTE_CATEGORIES = [
  { id: 'stoic', label: 'Stoic Philosophy', desc: 'Marcus Aurelius, Seneca, Epictetus' },
  { id: 'philosophy', label: 'Philosophers & Thinkers', desc: 'Eastern & Western wisdom' },
  { id: 'productivity', label: 'Productivity & Focus', desc: 'Deep work, craft, resilience' },
  { id: 'proverbs', label: 'Proverbs & Zen Koans', desc: 'Timeless cultural axioms' },
  { id: 'hindi_urdu', label: 'Hindi / Urdu Dohe', desc: 'Kabir, Rahim, Ghalib couplets' },
  { id: 'modern', label: 'Modern Literature', desc: 'Contemporary thinkers & innovators' },
]

const DURATION_OPTIONS = [
  { value: 60, label: '1 min', desc: 'Standard' },
  { value: 120, label: '2 min', desc: 'Reflective' },
  { value: 300, label: '5 min', desc: 'Meditative' },
  { value: 1800, label: '30 min', desc: 'Ambient' },
  { value: 3600, label: '1 hour', desc: 'Poster' },
]

export function ZenQuotesTab({ user, settings }) {
  const [zenEnabled, setZenEnabled] = useState(settings?.zenEnabled !== false)
  const [zenDurationSec, setZenDurationSec] = useState(
    Math.round((settings?.zenDuration || 60000) / 1000)
  )
  const [zenCategories, setZenCategories] = useState(
    settings?.zenCategories || [
      'stoic',
      'philosophy',
      'productivity',
      'proverbs',
      'hindi_urdu',
      'modern',
    ]
  )
  const [zenVoiceEnabled, setZenVoiceEnabled] = useState(settings?.zenVoiceEnabled !== false)

  useEffect(() => {
    setZenEnabled(settings?.zenEnabled !== false)
    setZenDurationSec(Math.round((settings?.zenDuration || 60000) / 1000))
    setZenCategories(
      settings?.zenCategories || [
        'stoic',
        'philosophy',
        'productivity',
        'proverbs',
        'hindi_urdu',
        'modern',
      ]
    )
    setZenVoiceEnabled(settings?.zenVoiceEnabled !== false)
  }, [settings])

  const toggleZen = async (next) => {
    setZenEnabled(next)
    try {
      await updateSettings(user.uid, { zenEnabled: next })
    } catch (err) {
      console.error('[settings] zen save failed', err)
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

  const toggleZenCategory = async (cat) => {
    let next = [...zenCategories]
    if (next.includes(cat)) {
      if (next.length > 1) {
        next = next.filter((c) => c !== cat)
      } else {
        toast.error('At least one quote category must remain selected')
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

  const toggleZenVoice = async (next) => {
    setZenVoiceEnabled(next)
    try {
      await updateSettings(user.uid, { zenVoiceEnabled: next })
      toast.success(next ? 'Zen voice narration enabled' : 'Zen voice narration disabled')
    } catch (err) {
      console.error('[settings] zenVoice save failed', err)
    }
  }

  return (
    <div className="space-y-8 pb-4">
      {/* ── Zen Idle Screen Toggles ──────────────────────────────────── */}
      <SettingsSection
        title="Zen Screen & Ambient Wisdom"
        description="Fades in minimalist typography, philosophical quotes, and calming reflections when your workstation stays idle."
      >
        <div className="space-y-3">
          <SettingsToggleRow
            icon={Sparkles}
            title="Motivational Quotes When Idle"
            description="Automatically reveals serene reflections across your dashboard after a period of workstation inactivity."
            checked={zenEnabled}
            onChange={toggleZen}
          />

          <SettingsToggleRow
            icon={Volume2}
            title="Spoken Zen Voice Narration"
            description="Softly reads quotes aloud using your configured assistant voice (ElevenLabs, OpenAI, or system TTS)."
            checked={zenVoiceEnabled}
            onChange={toggleZenVoice}
          />
        </div>
      </SettingsSection>

      {/* ── Quote Categories ─────────────────────────────────────────── */}
      <SettingsSection
        title="Quote Libraries & Traditions"
        description="Select the philosophical lineages and wisdom traditions included in your daily rotation."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {QUOTE_CATEGORIES.map((cat) => {
            const active = zenCategories.includes(cat.id)
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleZenCategory(cat.id)}
                className={cn(
                  'flex items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer select-none',
                  active
                    ? 'border-accent bg-accent/15 text-ink shadow-glow-xs ring-1 ring-accent/30'
                    : 'border-line/60 bg-surface-2/30 text-muted hover:border-line hover:text-ink hover:bg-surface-2/60'
                )}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{cat.label}</span>
                  </div>
                  <p className="text-[11px] text-muted leading-tight mt-0.5 truncate">
                    {cat.desc}
                  </p>
                </div>
                <div
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all',
                    active
                      ? 'border-accent bg-accent text-white shadow-xs'
                      : 'border-line/80 bg-surface text-transparent'
                  )}
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              </button>
            )
          })}
        </div>
      </SettingsSection>

      {/* ── Display Duration ─────────────────────────────────────────── */}
      <SettingsSection
        title="Quote Display Duration"
        description="How long each quote remains on the screen before softly transitioning to the next."
      >
        <SettingsCard className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {DURATION_OPTIONS.map((opt) => {
              const isSelected = zenDurationSec === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => saveZenDuration(opt.value)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-2xl border py-3 px-2 transition-all duration-200 cursor-pointer text-center',
                    isSelected
                      ? 'border-accent bg-accent/15 text-accent shadow-glow-xs font-bold'
                      : 'border-line/60 bg-surface-2/30 text-muted hover:text-ink hover:bg-surface-2/60'
                  )}
                >
                  <span className="text-xs font-bold">{opt.label}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider opacity-75 mt-0.5">
                    {opt.desc}
                  </span>
                </button>
              )
            })}
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
