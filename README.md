# PRO TRACK

A hyper-minimalist, gamified, all-in-one productivity ecosystem. A secure React **web gateway** (Netlify) pairs with a native **Electron desktop app**, both backed by a single **Firebase Spark free-tier** project. Sign-in flows from phone to desktop via a JioHotstar-style QR handshake — Google OAuth never runs inside the desktop's embedded browser.

> Crafted by **[AYUSH KUMAR](https://github.com/thecheesybit)**.

---

## What it does

- **Workspace modes** — partition everything (subjects, timetable, tasks, analytics) by execution scope: UPSC, M.Tech, GATE, and more. The active mode re-tints the entire UI.
- **Universal Dynamic Island** — one floating, morphing notifier for Pomodoro alerts, hydration nudges, sync state, and live progress.
- **Chrono-adaptive aesthetics** — surfaces and ambient light shift by time of day (crisp midday, deep obsidian at night) without overriding your light/dark choice.
- **Interactive calendar** — click the grid and type natural language ("Revise Polity tomorrow 5pm for 2h") to create a session, a deadline to-do, or a subject-linked task. A live timeline flag tracks the day.
- **Deep focus** — Pomodoro with ambient soundscapes, a growing forest, and an always-on miniature timer that follows you across modules.
- **Automated Kanban sync** — drag a task to *Done* and the parent subject's syllabus percentage recalculates instantly.
- **Apple-style activity rings** + a read-only **achievement ledger**.
- **Pre-baked habits** + custom intervals.
- **AI companion** (Gemini) — mode-aware chat and voice-note summaries; your API key never leaves the device.

## Native desktop

- Minimize-to-tray background execution; alarms and chimes fire even when minimized (`backgroundThrottling: false`).
- Global hotkeys: `Ctrl/Cmd+Shift+P` (show/hide), `Ctrl/Cmd+Shift+Space` (pause/resume focus).
- Hardware-fingerprint device identity bound to the account; session encrypted at rest via OS `safeStorage` (DPAPI / Keychain / libsecret).
- Automatic over-the-air updates with an enforced update gate.
- Frameless window with custom chrome, strict min bounds (940×600) so layouts never break.

---

## Architecture at a glance

```
Phone (web gateway)        Firebase (Spark)            Desktop (Electron)
  Google OAuth   ───────▶  Auth · Firestore · CF  ◀───────  QR + custom-token sign-in
                            mintDesktopToken                  workspace dashboard
```

- **Web (`pro-track-app.netlify.app`)** renders only the marketing landing page and the `/link` mobile-auth gateway — never the functional dashboard.
- **Desktop** renders the workspace after the QR handshake mints a single-use custom token.
- See [`claude.md`](./claude.md) for the full architectural blueprint, state map, and data model.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite |
| Styling | Tailwind CSS v3 (CSS-variable theming) |
| Animation | Framer Motion (shared-layout morphing) |
| State | Zustand (feature slices) |
| Backend | Firebase — Google Auth, Firestore (persistent cache), Cloud Functions |
| Desktop | Electron + electron-builder + electron-updater |
| NL parsing | chrono-node |
| Deploy | Netlify (web) · GitHub Releases (desktop) |

---

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
```

## Build & release

```bash
npm run build               # web production build -> dist/ (Netlify)
npm run electron:build:win  # Windows .exe installer -> release/
```

Releasing the desktop app: bump `version` in `package.json` + add a `CHANGELOG` entry, then publish a GitHub release with the installer + `latest.yml`. Older clients auto-update from the feed defined in `electron-builder.yml`.

## Free-tier strategy

Firestore persistent local cache means reloads cost ~0 reads; ephemeral state (timer ticks, the timeline flag, the Dynamic Island, NL drafts) never touches the database; writes coalesce via `arrayUnion`/`increment`; the ledger is bounded to 50 entries. A heavy day lands in the low hundreds of ops against the 50k read / 20k write ceiling.

## Security

- Gemini API key: browser `localStorage` only — never uploaded.
- Google Calendar token: session memory only.
- Desktop session: encrypted locally via `safeStorage`.
- QR `sessionId`: 256-bit single-use bearer secret, 2-minute TTL, deleted on claim.
- Firestore rules: strict owner-only access; clients can never write the custom token.

## License

Personal, non-commercial use. See the in-app Privacy Policy and Terms.
