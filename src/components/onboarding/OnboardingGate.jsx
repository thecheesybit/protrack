import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ShieldCheck,
  FileText,
  Check,
  ChevronRight,
  Loader2,
  Sparkles,
  Layers,
  BookOpen,
  GraduationCap,
  Cpu,
  Stethoscope,
  Calculator,
  FlaskConical,
  Globe,
  Users,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { GlassCard } from '@/components/ui/GlassCard'
import { PRIVACY_POLICY, TERMS, LEGAL_UPDATED } from '@/content/legal'
import { MODE_PRESETS } from '@/lib/constants'
import { completeOnboarding } from '@/services/onboardingService'

// Explicit map (not a namespace import) so Vite tree-shakes lucide-react.
const PRESET_ICONS = { BookOpen, GraduationCap, Cpu, Stethoscope, Calculator, FlaskConical, Globe, Users }

function PolicyBlock({ icon: Icon, doc }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-accent" />
        {doc.title}
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted">{doc.intro}</p>
      <div className="space-y-3">
        {doc.sections.map((s) => (
          <div key={s.heading}>
            <h4 className="text-[0.8rem] font-semibold text-ink/90">{s.heading}</h4>
            <p className="text-xs leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Checkbox({ checked, onChange, children }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-2xl border border-line/70 bg-surface/50 p-3 text-left transition-colors hover:border-accent/50"
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked ? 'border-accent bg-accent text-white' : 'border-line bg-transparent'
        }`}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <span className="text-xs leading-relaxed text-muted">{children}</span>
    </button>
  )
}

/**
 * First-run gate shown on the workspace host before the dashboard renders.
 * Step 1 — interactive Privacy Policy + Terms with two mandatory checkboxes.
 * Step 2 — execution-scope (mode) selection. On finish, writes legal acceptance
 * + selected modes, after which Workspace swaps to the live dashboard.
 */
export function OnboardingGate() {
  const { user } = useAuth()
  const existingModes = useStore((s) => s.modes)

  const [step, setStep] = useState('legal') // 'legal' | 'scopes'
  const [agreePrivacy, setAgreePrivacy] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pre-select presets that already exist (if any), otherwise start clean with no modes
  const initialSelected = useMemo(() => {
    const existingNames = new Set(existingModes.map((m) => m.name))
    const matches = MODE_PRESETS.filter((p) => existingNames.has(p.name)).map((p) => p.name)
    return new Set(matches)
  }, [existingModes])
  const [selected, setSelected] = useState(initialSelected)

  const bothAgreed = agreePrivacy && agreeTerms
  const canFinish = true

  const toggleScope = (name) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

  const finish = async () => {
    if (!user || !canFinish) return
    setSubmitting(true)
    setError('')
    try {
      const selectedPresets = MODE_PRESETS.filter((p) => selected.has(p.name))
      await completeOnboarding(user.uid, { selectedPresets, existingModes })
      // FirestoreSyncProvider observes the onboarding stamp and Workspace swaps
      // to the dashboard automatically — no local nav needed.
    } catch (err) {
      console.error('[onboarding] failed to complete', err)
      setError(err.message || 'Could not save your setup. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center p-4 sm:p-6">
      <AuroraBackground />
      <GlassCard className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line/60 p-6">
          <Logo className="h-10 w-10 drop-shadow" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold tracking-tight">Welcome to PRO TRACK</h1>
            <p className="text-xs text-muted">
              {step === 'legal' ? `Review and accept · updated ${LEGAL_UPDATED}` : 'Choose your execution scopes'}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`h-1.5 w-6 rounded-full ${step === 'legal' ? 'bg-accent' : 'bg-line'}`} />
            <span className={`h-1.5 w-6 rounded-full ${step === 'scopes' ? 'bg-accent' : 'bg-line'}`} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'legal' ? (
            <motion.div
              key="legal"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <PolicyBlock icon={ShieldCheck} doc={PRIVACY_POLICY} />
                <PolicyBlock icon={FileText} doc={TERMS} />
              </div>
              <div className="space-y-2.5 border-t border-line/60 p-6">
                <Checkbox checked={agreePrivacy} onChange={setAgreePrivacy}>
                  I have read and agree to the <span className="font-medium text-ink">Privacy Policy</span>.
                </Checkbox>
                <Checkbox checked={agreeTerms} onChange={setAgreeTerms}>
                  I accept the <span className="font-medium text-ink">Terms &amp; Conditions</span>.
                </Checkbox>
                <button
                  type="button"
                  disabled={!bothAgreed}
                  onClick={() => setStep('scopes')}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="scopes"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <p className="mb-4 text-sm text-muted">
                  Pick the tracks you want active, or start with a clean slate (no modes). You can add, rename, or remove scopes anytime — the
                  first one becomes your active mode.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {MODE_PRESETS.map((preset) => {
                    const Icon = PRESET_ICONS[preset.icon] || Layers
                    const on = selected.has(preset.name)
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => toggleScope(preset.name)}
                        className={`group relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all ${
                          on
                            ? 'border-accent/70 bg-accent/10 shadow-glow-sm'
                            : 'border-line/70 bg-surface/50 hover:border-accent/40'
                        }`}
                      >
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{ backgroundColor: `${preset.accentColor}22`, color: preset.accentColor }}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="text-sm font-semibold text-ink">{preset.name}</span>
                        <span className="text-[0.7rem] leading-snug text-muted">{preset.blurb}</span>
                        <span
                          className={`absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full transition-opacity ${
                            on ? 'bg-accent text-white opacity-100' : 'opacity-0'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    )
                  })}
                </div>
                {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
              </div>
              <div className="flex items-center gap-3 border-t border-line/60 p-6">
                <button
                  type="button"
                  onClick={() => setStep('legal')}
                  className="rounded-2xl border border-line/70 px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-ink"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={finish}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 font-semibold text-white shadow-glow transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Setting up…
                    </>
                  ) : selected.size > 0 ? (
                    <>
                      <Sparkles className="h-4 w-4" /> Enter PRO TRACK
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Enter PRO TRACK (Clean slate)
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </div>
  )
}
