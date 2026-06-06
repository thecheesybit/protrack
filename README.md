# PRO TRACK

A hyper-minimalist, gamified, all-in-one productivity ecosystem. A secure React **web gateway** (Netlify) pairs with a native **Electron desktop app**, both backed by a single **Firebase Spark free-tier** project. Sign-in flows from phone to desktop via a JioHotstar-style QR handshake — Google OAuth never runs inside the desktop's embedded browser.

> **Crafted by [AYUSH KUMAR](https://github.com/thecheesybit).**

---

## What it does

- **Workspace modes** — partition everything (subjects, timetable, tasks, analytics) by execution scope: UPSC, M.Tech, GATE, and more. The active mode re-tints the entire UI.
- **Universal Dynamic Island** — one floating, morphing notifier for Pomodoro alerts, hydration nudges, sync state, and live progress.
- **Chrono-adaptive aesthetics** — surfaces and ambient light shift by time of day (crisp midday, deep obsidian at night) without overriding your light/dark choice.
- **Pixel-perfect typography** — Compact / Standard / Large display modes scale the entire UI through a single CSS variable. Electron is locked to native device pixels (`zoomFactor: 1.0`, pinch-zoom disabled) for HiDPI sharpness.
- **Interactive calendar** — click the grid and type natural language ("Revise Polity tomorrow 5pm for 2h") to create a session, a deadline to-do, or a subject-linked task. A live timeline flag tracks the day.
- **Deep focus** — Pomodoro with ambient soundscapes, a growing forest, and an always-on miniature timer that follows you across modules.
- **Automated Kanban sync** — drag a task to *Done* and the parent subject's syllabus percentage recalculates instantly.
- **Apple-style activity rings** + a read-only **achievement ledger**.
- **Intelligent Habit Engine** — habits with `every-1h`, `every-2h`, `every-4h`, `morning`, or `evening` intervals trigger persistent OS notifications. Missed reminders aggregate as an inline backlog badge on the Habits widget.
- **AI companion with write access** — the Gemini chat assistant can complete tasks, set subject progress, add to-dos, schedule timetable slots, toggle habits, and create subjects via natural-language commands ("I finished my Calculus study session" → marks the task done + recomputes progress + logs to the ledger).
- **Window state persistence** — size, position, maximize, and fullscreen all survive restart.

## Native desktop

- Minimize-to-tray background execution; alarms and chimes fire even when minimized (`backgroundThrottling: false`).
- Global hotkeys: `Ctrl/Cmd+Shift+P` (show/hide), `Ctrl/Cmd+Shift+Space` (pause/resume focus), `Ctrl/Cmd+Shift+F` (fullscreen), `Ctrl/Cmd+Shift+H` (hide to tray), `Ctrl/Cmd+Shift+M` (mute).
- Hardware-fingerprint device identity bound to the account; session encrypted at rest via OS `safeStorage` (DPAPI / Keychain / libsecret).
- Automatic over-the-air updates with an enforced update gate.
- Frameless window with custom chrome, strict min bounds (940×600), HiDPI-locked rendering.

---

## Architecture at a glance

```
Phone (web gateway)        Firebase (Spark)            Desktop (Electron)
  Google OAuth   ───────▶  Auth · Firestore         ◀───────  QR + ID-token sign-in
                                                              workspace dashboard
```

- **Web (`pro-track-app.netlify.app`)** renders only the marketing landing page and the `/link` mobile-auth gateway — never the functional dashboard.
- **Desktop** renders the workspace after the QR handshake (mobile writes its Google ID token to a one-shot Firestore handshake doc; the desktop consumes it with `signInWithCredential` and deletes the doc).
- See [`claude.md`](./claude.md) for the full architectural blueprint, state map, and data model.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite |
| Styling | Tailwind CSS v3 (CSS-variable theming, `--root-font-size` cascade) |
| Animation | Framer Motion (shared-layout morphing) |
| State | Zustand (feature slices) |
| Backend | Firebase — Google Auth, Firestore (persistent cache) |
| AI | `@google/generative-ai` with function-calling (write-access tools) |
| Desktop | Electron + electron-builder + electron-updater |
| NL parsing | chrono-node |
| CI/CD | GitHub Actions (multi-OS matrix, version bump, changelog, Netlify deploy) |
| Deploy | Netlify (web) · GitHub Releases (desktop) |

---

## Install (end users)

| Platform | Download |
|---|---|
| Windows | latest `.exe` from [Releases](https://github.com/thecheesybit/pro-track/releases) |
| macOS | latest `.dmg` from [Releases](https://github.com/thecheesybit/pro-track/releases) |
| Linux | latest `.AppImage` from [Releases](https://github.com/thecheesybit/pro-track/releases) |

After install, scan the QR from your phone (or click **Sign in with Google** on desktop). The app auto-updates from the GitHub release feed.

## Develop

```bash
npm install
npm run dev                 # web renderer (browser); use ?desktop=1 to preview the workspace
npm run electron:dev        # full desktop app against the dev server
```

Create a `.env` (gitignored) with your Firebase web config:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_WEB_URL=https://pro-track-app.netlify.app
```

## Build & release

Releases are fully automated. A push to `master` triggers `.github/workflows/release.yml`:

1. Bumps `package.json` to the next patch (or honors `workflow_dispatch` choice).
2. Regenerates `CHANGELOG.md` from conventional commits since the last tag.
3. Deploys the web build to Netlify (if secrets configured).
4. Builds Electron installers in parallel for Windows, macOS, Linux.
5. Publishes a new GitHub Release with all installer assets — auto-update picks them up.

Required repository secrets:

| Secret | Purpose |
|---|---|
| `GITHUB_TOKEN` | provided automatically — used for release publishing |
| `NETLIFY_AUTH_TOKEN` | optional — enables web deploy |
| `NETLIFY_SITE_ID` | optional — enables web deploy |

Local one-shot build:

```bash
npm run build                 # web production build -> dist/
npm run electron:build:win    # Windows .exe -> release/
npm run electron:build:mac    # macOS .dmg  -> release/
```

## Free-tier discipline

Firestore persistent local cache means reloads cost ~0 reads; ephemeral state (timer ticks, the timeline flag, the Dynamic Island, NL drafts) never touches the database; writes coalesce via `arrayUnion`/`increment`; the ledger is bounded to 200 entries. A heavy day lands in the low hundreds of ops against the 50k read / 20k write ceiling. **No Cloud Functions or paid plan required.**

## Security

- Gemini API key: browser `localStorage` only — never uploaded.
- Desktop session: encrypted locally via `safeStorage` (DPAPI / Keychain / libsecret).
- QR `sessionId`: 256-bit single-use bearer secret, 2-minute TTL, deleted on claim.
- Firestore rules: strict owner-only access on `users/{uid}/**`; handshake docs are writeable by any authenticated client (a deliberate trade-off to keep the architecture Spark-plan-compatible — the docs are write-once, single-use, and TTL-bounded).
- Hardware fingerprint: SHA-256 of hostname + platform + arch + CPU model + non-internal MACs. Raw identifiers never leave the device.

## License

Personal, non-commercial use. See the in-app Privacy Policy and Terms.
