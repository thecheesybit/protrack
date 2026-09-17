import { ShieldCheck, Cloud, Download } from 'lucide-react'
import { SettingsSection, SettingsCard } from '../SettingsUI'
import { CompanionPairingPanel } from '@/components/auth/CompanionPairingPanel'

/**
 * Settings → "Tablet Companion" — a dedicated home for linking an Android
 * tablet: the live QR / pairing-code panel plus a short primer. Desktop-only
 * surface (a tablet pairs *to* a desktop, not the other way round).
 */
export function CompanionTab() {
  return (
    <div className="space-y-8 pb-4">
      <SettingsSection
        title="Link a Tablet Companion"
        description="Run the full PRO TRACK workspace on an Android tablet, kept in sync with this account. Generate a single-use pass below and scan it (or type the code) on the tablet — no password re-entry."
      >
        <SettingsCard hover={false} className="p-3 sm:p-4">
          <CompanionPairingPanel />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection
        title="How it works"
        description="A zero-password, free-tier handshake — no cloud functions."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: 'Single-use & short-lived',
              body: 'Each pass is a 2-minute, single-use token. It is deleted the moment the tablet claims it.',
            },
            {
              icon: Cloud,
              title: 'Live sync',
              body: 'Once paired, the tablet reads the same Firestore data — modes, syllabus, tasks, timetable — in real time.',
            },
            {
              icon: Download,
              title: 'Get the app',
              body: 'Install the PRO TRACK companion APK on the tablet first (from the GitHub release), then open it to scan.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col gap-2 rounded-2xl border border-line/60 bg-surface-2/20 p-3.5"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Icon className="h-4.5 w-4.5" />
              </span>
              <h5 className="font-sans text-xs font-bold text-ink">{title}</h5>
              <p className="text-[11px] text-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </SettingsSection>
    </div>
  )
}
