# PRO TRACK — Architectural Blueprint

Technical map for maintainers (and for Claude). Pairs with [`README.md`](./README.md), which is the user-facing overview.

---

## 1. System footprint

Three runtimes, one backend:

| Surface | Role | Renders |
|---|---|---|
| **Web (Netlify)** | Gateway only | Landing/marketing + `/link` mobile auth. **Never** the dashboard. |
| **Desktop (Electron)** | The product | Full workspace after QR sign-in. |
| **Firebase (Spark)** | Shared backend | Auth, Firestore, one Cloud Function (`mintDesktopToken`). |

The split is enforced by `src/desktop/isDesktop.js → isWorkspaceHost`: true only inside Electron (or a DEV `?desktop=1` preview). `import.meta.env.DEV` gates the preview, so the production web build can never expose the dashboard.

```
src/
├─ app / App.jsx          route fork: /link → gateway; !isWorkspaceHost → Landing; else gated Workspace
├─ components/
│  ├─ marketing/          LandingPage (web)
│  ├─ onboarding/         OnboardingGate (legal + scope select)
│  ├─ layout/             Workspace (gate), Dashboard, BoardCanvas, TopBar, ModeSwitcher
│  ├─ island/             DynamicIsland (universal notifier)
│  ├─ desktop/            UpdateGate (forced auto-update overlay)
│  ├─ focus/              FocusPanel, FocusMiniOverlay, ForestView
│  ├─ calendar/           NlQuickCapture (chrono-node)
│  ├─ timetable/          TimetableGrid (+ live "now" flag), SlotEditor, TodayAgenda
│  ├─ subjects/           SubjectDetail, MicroKanban (drag→Done sync)
│  ├─ analytics/          HealthRings
│  ├─ widgets/            registry + per-widget components (incl. LedgerWidget)
│  └─ settings/           SettingsPanel (shortcuts, changelog, credits)
├─ hooks/                 useChronoTheme, useIslandCycle, useNowMinutes,
│                         useDesktopIntegration, useAutoUpdate, useFocusEngine, …
├─ store/slices/          Zustand feature slices (below)
├─ services/              Firestore/IPC data access (one module per domain)
├─ content/              legal.js, changelog.js
├─ desktop/               isDesktop, TitleBar
└─ lib/                   firebase, color, nlParse, time, icons, constants
electron/                 main.js, preload.js, (auto-update inline in main)
functions/                mintDesktopToken
```

## 2. State management (Zustand)

Single store (`store/useStore.js`) composed from pure slices. Components read via fine-grained selectors. Truth lives where it's cheapest:

| Slice | Holds | Sync model |
|---|---|---|
| `uiSlice` | maximized widget, open panels, focus overlay context | local |
| `modeSlice` | modes, `activeModeId` | Firestore listener (modes) |
| `userSlice` | settings, stats | Firestore listener (user doc) |
| `focusSlice` | timer status/phase/secondsLeft/session | **local only** — ticks never write |
| `chromeSlice` | `chromeHidden` | local |
| `islandSlice` | active event + FIFO queue | **local only** — pure UI notifier |
| `chronoSlice` | time-of-day band | local (driven by `useChronoTheme`) |
| `updateSlice` | auto-update status/version/progress | fed by Electron IPC |

Orchestration that owns timers/side-effects lives in hooks, never slices: `useFocusEngine` (tick, chime, notify, persist, ledger), `useIslandCycle` (auto-dismiss), `useChronoTheme` (writes `data-chrono` on `<html>`), `useNowMinutes` (timeline flag), `useAutoUpdate`, `useDesktopIntegration` (fingerprint + hotkeys).

## 3. Firestore data model

```
users/{uid}
  profile, settings { theme, activeModeId, hydrationIntervalMin, onboarding{...} }, statsAggregate
  modes/{modeId}                      { name, icon, accentColor, order }
    subjects/{subjectId}              { name, color, progressPct, links[], flags[] }
      tasks/{taskId}                  { title, column, order }   ← Kanban
    timetableSlots/{slotId}           { dayOfWeek, startMin, endMin, label, color }
    goals/{goalId}
  habits/{habitId}                    { name, icon, color, doneDates[] }
  todos/{todoId}                      { text, done, modeId, dueAt, subjectId }
  focusSessions/{id}                  { modeId, subjectId, durationMin, startedAt, hourOfDay }
  ledger/{id}                         { kind, title, detail, modeId, at }   ← bounded read (50)
  devices/{fingerprint}               { label, platform, boundAt, lastSeen }
desktopHandshakes/{sessionId}         { desktopUid, status, token?, expiresAt }  ← ephemeral
```

Rules (`firestore.rules`): everything under `users/{uid}/**` is owner-only. Handshake docs are creatable/readable/deletable only by the desktop UID; the `token` field is writable **only** by the Cloud Function (Admin SDK bypasses rules).

## 4. Key real-time flows

- **QR auth handshake** — desktop signs in anonymously, writes `desktopHandshakes/{sessionId}` (256-bit id, 2-min TTL), shows a QR to `…/link?s=`. Phone does real Google OAuth, calls `mintDesktopToken`, which verifies + writes a single-use custom token. The desktop's `onSnapshot` picks it up, `signInWithCustomToken`, deletes the doc, binds the hardware fingerprint, reveals the workspace.
- **NL calendar capture** — `lib/nlParse.parseCapture` (chrono-node) parses locally; one write creates a slot / to-do / subject-linked task. Zero reads.
- **Kanban → subject sync** — on drop to *Done*, `MicroKanban` recomputes `progressPct = done/total` from in-memory tasks, writes it once, announces via the Island, appends a ledger entry.
- **Auto-update** — `electron-updater` (GitHub feed) → IPC → `updateSlice` → `UpdateGate` obscures the dashboard and pauses focus until the user restarts to install.

## 5. Free-tier discipline (hard rules for new features)

1. Ephemeral/derived state stays local (timers, flags, island, drafts, rings).
2. One bounded listener per active collection; never global/un-scoped. Tear down on mode switch.
3. Coalesce writes with `arrayUnion`/`arrayRemove`/`increment`; prefer one transaction over read-modify-write.
4. Bound history reads (`limit`). Sort client-side to avoid composite indexes.
5. The only Blaze dependency is `mintDesktopToken`; it stays within the free function allotment.

## 6. Maintenance guidelines

- **Brand:** zero emojis anywhere in UI/strings — Lucide icons only. There is a CI-friendly grep for emoji ranges; keep it clean.
- **Immutability:** slices return new objects; never mutate state in place.
- **Files:** small and feature-scoped (~200–400 lines). One service module per domain.
- **Bundle:** import Lucide icons by name (never `import * as`), or tree-shaking breaks and the bundle balloons. Heavy deps get a `manualChunks` vendor split in `vite.config.js`.
- **Build gates:** `npm run build` (web) and `ELECTRON=true vite build` (main + preload) must both stay green.
- **Releasing desktop:** bump `package.json` version, add a `content/changelog.js` entry, publish a GitHub release with the installer + `latest.yml`.

## 7. Manual console prerequisites (not CLI-automatable)

- Firebase Auth: enable **Google** + **Anonymous** providers; add `pro-track-app.netlify.app` to authorized domains.
- Upgrade to **Blaze** (stays $0 under free quotas) → `firebase deploy --only functions` for `mintDesktopToken`.
- For public desktop downloads + auto-update: the GitHub repo/release must be public (or the updater configured with a token).
