import { motion } from 'framer-motion'
import {
  Download,
  Github,
  QrCode,
  ScanLine,
  MonitorSmartphone,
  Timer,
  CalendarRange,
  BarChart3,
  ListChecks,
  Layers,
  Bot,
  ArrowRight,
} from 'lucide-react'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { WallOfHonor } from '@/components/support/WallOfHonor'
import { APP_LINKS, CREATOR } from '@/lib/constants'

const FEATURES = [
  { icon: Layers, title: 'Workspace modes', body: 'Partition everything by UPSC, M.Tech, GATE — switch context in one tap.' },
  { icon: Timer, title: 'Gamified deep focus', body: 'Pomodoro sessions that grow a forest and feed your streaks.' },
  { icon: CalendarRange, title: 'Interactive calendar', body: 'Type anywhere on the grid; a live timeline flag tracks your day.' },
  { icon: BarChart3, title: 'Activity rings', body: 'Apple-style health circles for focus hours, streaks, and completion.' },
  { icon: ListChecks, title: 'Habits & Kanban', body: 'Pre-baked habits and a board that auto-syncs syllabus progress.' },
  { icon: Bot, title: 'AI companion', body: 'A Gemini-powered assistant that understands your active mode.' },
]

const STEPS = [
  { icon: Download, title: 'Download the desktop app', body: 'Grab the Windows installer — it sets up in seconds.' },
  { icon: QrCode, title: 'Launch and see your QR', body: 'The app shows a secure, single-use code on first run.' },
  { icon: ScanLine, title: 'Scan and sign in on your phone', body: 'Authenticate with Google on mobile; the desktop unlocks instantly.' },
]

export function LandingPage() {
  return (
    <div className="relative h-full overflow-y-auto">
      <AuroraBackground />

      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-5 py-8 sm:px-8">
        {/* Top bar */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9 drop-shadow" />
            <span className="text-base font-bold tracking-tight">PRO TRACK</span>
          </div>
          <a
            href={APP_LINKS.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-line/70 bg-surface/50 px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <Github className="h-4 w-4" /> GitHub
          </a>
        </header>

        {/* Hero */}
        <section className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-surface/50 px-3 py-1 text-xs font-medium text-muted">
              <MonitorSmartphone className="h-3.5 w-3.5 text-accent" />
              Native desktop · phone-linked sign-in
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
              Your entire study life,
              <br />
              <span className="text-gradient">on one calm desktop.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted">
              PRO TRACK unifies modes, deep focus, an interactive calendar, habits, analytics, and an
              AI companion into a single hyper-minimal workspace — built to run quietly in your tray.
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={APP_LINKS.releasesLatest}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 rounded-2xl bg-accent px-6 py-3.5 font-semibold text-white shadow-glow transition-transform active:scale-[0.98]"
              >
                <Download className="h-5 w-5" /> Download for Windows
              </a>
              <a
                href={APP_LINKS.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl border border-line/70 bg-surface/50 px-6 py-3.5 font-semibold text-ink transition-colors hover:border-accent/50"
              >
                View source <ArrowRight className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-3 text-xs text-muted">Free · runs on a zero-cost backend · your data stays yours.</p>
          </motion.div>
        </section>

        {/* How linking works */}
        <section className="py-10">
          <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-muted">
            How sign-in works
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass rounded-3xl p-5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{step.body}</p>
              </motion.div>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-muted">
            Google blocks sign-in inside desktop browsers, so PRO TRACK uses a secure QR handshake —
            your credentials never touch the desktop directly.
          </p>
        </section>

        {/* Feature grid */}
        <section className="py-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="edge-light rounded-3xl border border-line/60 bg-surface/40 p-5 backdrop-blur-xl"
              >
                <f.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Wall of Honor — community supporters keeping PRO TRACK free */}
        <section className="py-10">
          <p className="mb-5 text-center text-sm text-muted">
            PRO TRACK is free and open-source. These supporters keep the servers running.
          </p>
          <WallOfHonor />
        </section>

        {/* Footer + creator credit */}
        <footer className="mt-auto flex flex-col items-center gap-2 border-t border-line/50 py-8 text-center">
          <p className="text-xs text-muted">
            Crafted by{' '}
            <a
              href={CREATOR.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-ink transition-colors hover:text-accent"
            >
              <Github className="h-3.5 w-3.5" />
              {CREATOR.name}
            </a>
          </p>
          <p className="text-[0.7rem] text-muted/70">PRO TRACK — a calm, all-in-one productivity workspace.</p>
        </footer>
      </div>
    </div>
  )
}
