import { Shield, Lock, Cpu, Cloud, Calendar, Mic, FileText, CheckCircle2 } from 'lucide-react'
import { APP_VERSION } from '@/lib/version'
import { CREATOR } from '@/lib/constants'
import { SettingsSection, SettingsCard, SettingsBadge } from '../SettingsUI'

const PRIVACY_PILLARS = [
  {
    icon: Shield,
    title: 'Zero-Telemetry Architecture',
    badge: '100% Private',
    badgeVariant: 'emerald',
    body: 'ProTrack embeds zero third-party advertising trackers, user behavior analytics SDKs, or session recording beacons. Your study schedules, exam scores, syllabus milestones, and habits remain strictly confidential.',
  },
  {
    icon: Cpu,
    title: 'Client-Side Key Custody (BYOK)',
    badge: 'Local Only',
    badgeVariant: 'accent',
    body: 'All artificial intelligence API keys (Google Gemini, OpenAI GPT, Anthropic Claude, DeepSeek, and ElevenLabs) are encrypted and stored exclusively in your local device storage. They are never transmitted to ProTrack servers or logged in external cloud databases.',
  },
  {
    icon: Cloud,
    title: 'Firebase Isolation & Data Ownership',
    badge: 'Isolated UID',
    badgeVariant: 'accent',
    body: 'When cloud synchronization is active, your timetable, subjects, and todos are synced to Google Firebase Firestore under strict per-user security rules. Database access is cryptographically restricted to your authenticated user ID — no other user or administrator has access to your records.',
  },
  {
    icon: Calendar,
    title: 'Google Calendar Scope Boundaries',
    badge: 'Scoped OAuth',
    badgeVariant: 'accent',
    body: 'When you link Google Calendar, ProTrack requests only the minimal OAuth permission necessary to read and write timetable study slots (calendar.events). OAuth tokens are stored locally on your machine. ProTrack never requests or accesses your personal emails, contacts, or Google Drive documents.',
  },
  {
    icon: Mic,
    title: 'Ephemeral Hands-Free Audio',
    badge: 'In-RAM Only',
    badgeVariant: 'emerald',
    body: 'Hands-Free voice companion audio streams are processed ephemerally in device RAM. Speech buffers are streamed directly to your configured AI provider endpoint (using your local API key) and are immediately discarded. We never retain, store, or train on your spoken voice recordings.',
  },
  {
    icon: Lock,
    title: 'Cryptographic Workspace Lock',
    badge: 'SHA-256 Hashed',
    badgeVariant: 'accent',
    body: 'Workspace lock screen PINs are verified using salted SHA-256 cryptographic one-way hashing. Plaintext PINs are never stored in browser memory, local storage, or cloud databases.',
  },
]

const TERMS_SECTIONS = [
  {
    title: '1. Personal Study License',
    body: 'ProTrack is provided as an all-in-one focus and productivity workstation for personal educational and productivity use. You are granted a personal, non-exclusive, revocable license to utilize the application on compatible web and desktop environments.',
  },
  {
    title: '2. BYOK Provider Consumption & Responsibilities',
    body: 'When configuring third-party AI provider keys (Gemini, OpenAI, Anthropic, DeepSeek, ElevenLabs), you acknowledge that you are using your own developer accounts. You are solely responsible for any API usage fees, rate limits, or quota overages incurred through your provider.',
  },
  {
    title: '3. Data Portability & Complete Right to Erasure',
    body: 'You maintain full ownership of your data at all times. You can trigger an instantaneous wipe of all timetable and study metrics via "Reset Account Data" or permanently eradicate your user account, cloud nodes, and authentication tokens via "Danger Zone & Account Purge".',
  },
  {
    title: '4. Service Availability & Limitation of Liability',
    body: 'ProTrack is provided "as is" and "as available", without warranties of any kind, whether express or implied. While engineered for maximum stability and offline resilience, the maintainers are not liable for accidental data loss, third-party cloud outages, or study timetable discrepancies.',
  },
]

export function PrivacyTab({ appInfo }) {
  return (
    <div className="space-y-8 pb-4">
      {/* ── Privacy & Data Charter ──────────────────────────────────── */}
      <SettingsSection
        title="Privacy Charter & Security Architecture"
        description="Our non-negotiable commitment to student data sovereignty, local-first storage, and tracker-free productivity."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {PRIVACY_PILLARS.map((pillar, idx) => {
            const IconComp = pillar.icon
            return (
              <SettingsCard key={idx} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent">
                      <IconComp className="h-4 w-4" />
                    </div>
                    <SettingsBadge variant={pillar.badgeVariant}>
                      {pillar.badge}
                    </SettingsBadge>
                  </div>
                  <h5 className="font-sans text-xs font-bold text-ink mb-1.5">
                    {pillar.title}
                  </h5>
                  <p className="font-sans text-xs text-muted leading-relaxed">
                    {pillar.body}
                  </p>
                </div>
              </SettingsCard>
            )
          })}
        </div>
      </SettingsSection>

      {/* ── Terms and Conditions ────────────────────────────────────── */}
      <SettingsSection
        title="Terms of Service & Usage Agreement"
        description="Plain-English legal conditions governing the use of ProTrack and connected cloud interfaces."
      >
        <SettingsCard className="p-6 space-y-5">
          <div className="flex items-center gap-2 pb-2 border-b border-line/40">
            <FileText className="h-4 w-4 text-accent" />
            <span className="font-sans text-xs font-bold uppercase tracking-wider text-ink">
              End-User Agreement Summary
            </span>
          </div>

          <div className="space-y-4">
            {TERMS_SECTIONS.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                <h6 className="font-sans text-xs font-bold text-ink/90">
                  {sec.title}
                </h6>
                <p className="font-sans text-xs text-muted leading-relaxed">
                  {sec.body}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-line/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Full user data sovereignty guaranteed</span>
            </div>
            <span className="font-mono text-[0.6875rem] text-muted/80">
              Version {appInfo?.version || APP_VERSION} · ProTrack
            </span>
          </div>
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}
