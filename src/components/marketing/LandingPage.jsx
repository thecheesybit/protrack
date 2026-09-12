import { motion } from 'framer-motion'
import {
  Download,
  Github,
  QrCode,
  LogIn,
  LayoutDashboard,
  MonitorSmartphone,
  Timer,
  CalendarRange,
  CalendarClock,
  ListChecks,
  Layers,
  GraduationCap,
  MessageSquareHeart,
  Mic,
  Bot,
  BellRing,
  ArrowRight,
} from 'lucide-react'
import { AuroraBackground } from '@/components/common/AuroraBackground'
import { Logo } from '@/components/common/Logo'
import { WallOfHonor } from '@/components/support/WallOfHonor'
import { APP_LINKS, CREATOR } from '@/lib/constants'

const FEATURES = [
  {
    icon: CalendarRange,
    title: 'Day at a glance',
    body: 'One vertical timeline merges classes, events, due to-dos, focus sessions and deadlines — with a live "now" line and an end-of-day countdown.',
  },
  {
    icon: Timer,
    title: 'Deep focus that grows a forest',
    body: 'Pomodoro sessions plant trees on your calendar. The timer and audio keep running even in the floating mini-window.',
  },
  {
    icon: CalendarClock,
    title: 'Two-way Google Calendar',
    body: 'Recurring slots, one-off events and dated to-dos sync both ways while the app is open — edits and deletes included.',
  },
  {
    icon: Layers,
    title: 'Workspace modes',
    body: 'Partition everything by UPSC, GATE, M.Tech — switch the whole board in one tap, or see every scope at once.',
  },
  {
    icon: ListChecks,
    title: 'Habits & Kanban',
    body: 'Interval habit reminders with a per-day backlog chip, and a board that auto-syncs syllabus progress on drop-to-done.',
  },
  {
    icon: MessageSquareHeart,
    title: 'Check-ins & calm prompts',
    body: 'Morning, midday and evening check-ins take over screen-centre behind a blur, ask one question, then hand the screen back. Snooze if unanswered.',
  },
  {
    icon: GraduationCap,
    title: 'Exam scorecards',
    body: 'Paste a raw mock-test result or log sectionals by hand. Track score, accuracy and percentile trends with an AI coach on your error patterns.',
  },
  {
    icon: Mic,
    title: 'Bulk & voice task entry',
    body: 'Type or dictate "add lesson 18 to 36" inside a subject — one task per lesson in a single write, with a preview before it commits.',
  },
  {
    icon: Bot,
    title: 'AI companion',
    body: 'A Gemini assistant that knows your active mode. Slash commands like /done, /todo and /tasks work offline with no API key.',
  },
]

const STEPS = [
  {
    icon: Download,
    title: 'Download the desktop app',
    body: 'Grab the Windows installer — it sets up in seconds and updates itself silently.',
  },
  {
    icon: LogIn,
    title: 'Sign in',
    body: 'Use "Sign in with Google" on the desktop, or scan the one-time QR with your phone.',
  },
  {
    icon: LayoutDashboard,
    title: 'Your workspace opens',
    body: 'Modes, deep focus, the calendar, habits, analytics and the AI companion — one calm board.',
  },
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
              PRO TRACK unifies a day-at-a-glance timeline, deep focus, two-way Google Calendar,
              habits, exam scorecards, analytics and an AI companion into a single hyper-minimal
              workspace — built to run quietly in your tray.
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
            <p className="mt-3 text-xs text-muted">
              Free · no servers to run · your data stays in your own Firebase.
            </p>
          </motion.div>
        </section>

        {/* How sign-in works */}
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
          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
            <QrCode className="h-3.5 w-3.5 text-accent" />
            Google blocks sign-in inside desktop browsers, so the phone QR uses a secure
            single-use handshake — your credentials never touch the desktop directly.
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
          <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted/80">
            <BellRing className="h-3.5 w-3.5 text-accent" />
            Every notification plays one fitting tone — and a single setting mutes them all.
          </p>
        </section>

        {/* Wall of Honor — supporters keeping PRO TRACK free */}
        <section className="py-10">
          <p className="mb-5 text-center text-sm text-muted">
            PRO TRACK is free and open-source. There are no servers to run — contributions
            cover API costs and the maker&rsquo;s time.
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
          <p className="text-[calc(0.7rem*var(--text-scale,1))] text-muted/70">PRO TRACK — a calm, all-in-one productivity workspace.</p>
        </footer>
      </div>
    </div>
  )
}
