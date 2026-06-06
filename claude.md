# PRO TRACK — Architectural Blueprint

Technical map for maintainers (and for Claude). Pairs with [`README.md`](./README.md), which is the user-facing overview.

---

## 1. System footprint

Three runtimes, one backend:

| Surface | Role | Renders |
|---|---|---|
| **Web (Netlify)** | Gateway only | Landing/marketing + `/link` mobile auth. **Never** the dashboard. |
| **Desktop (Electron)** | The product | Full workspace after QR sign-in or direct Google Login. |
| **Firebase (Spark)** | Shared backend | Auth, Firestore. Cloud Functions are optional fallbacks now. |

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
│  ├─ support/            SupportModal (Philosophy + ContributionCard + WallOfHonor overlay)
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
| `uiSlice` | maximized widget, open panels, focus overlay context, supportOpen, fullscreen | local / IPC sync |
| `modeSlice` | modes, `activeModeId` | Firestore listener (modes) |
| `userSlice` | settings, stats | Firestore listener (user doc) |
| `focusSlice` | timer status/phase/secondsLeft/session | **local only** — ticks never write |
| `chromeSlice` | `chromeHidden` | local |
| `islandSlice` | active event + FIFO queue | **local only** — pure UI notifier |
| `chronoSlice` | time-of-day band | local (driven by `useChronoTheme`) |
| `updateSlice` | auto-update status/version/progress | fed by Electron IPC |

Orchestration that owns timers/side-effects lives in hooks, never slices: `useFocusEngine` (tick, chime, notify, persist, ledger), `useIslandCycle` (auto-dismiss), `useChronoTheme` (writes `data-chrono` on `<html>`), `useNowMinutes` (timeline flag), `useAutoUpdate`, `useDesktopIntegration` (fingerprint + hotkeys + window state listeners).

## 3. Firestore data model

```
users/{uid}
  profile, settings { theme, activeModeId, hydrationIntervalMin, onboarding{...} }, statsAggregate
  modes/{modeId}                      { name, icon, accentColor, order }
    subjects/{subjectId}              { name, color, progressPct, links[], flags[] }
      tasks/{taskId}                  { title, column, order }   ← Kanban
    timetableSlots/{slotId}           { dayOfWeek, startMin, endMin, label, color }
    goals/{goalId}
  habits/{habitId}                    { name, icon, color, doneDates[], timesPerWeek, timesPerDay, interval }
  todos/{todoId}                      { text, done, modeId, dueAt, subjectId }
  focusSessions/{id}                  { modeId, subjectId, durationMin, startedAt, hourOfDay }
  ledger/{id}                         { kind, title, detail, modeId, at }   ← bounded read (50)
  devices/{fingerprint}               { label, platform, boundAt, lastSeen }
desktopHandshakes/{sessionId}         { desktopUid, status, token?, expiresAt }  ← ephemeral
```

Rules (`firestore.rules`): everything under `users/{uid}/**` is owner-only. Handshake docs are writable by authenticated client devices to support the client-side Google popup auth bypass.

## 4. Key real-time flows

- **Direct Auth & Client-Side Handshake (Spark Plan Bypass)**:
  - Added direct **"Sign in with Google"** on desktop (`QrLoginScreen`).
  - Mobile `/link` page uses a direct client-side Google login popup. When a user approves desktop linking, the mobile client writes the Google ID token directly to `desktopHandshakes/{sessionId}`. The desktop app grabs it, signs in with `signInWithCredential`, deletes the handshake doc, and binds the fingerprint. This eliminates Cloud Function requirements, running completely on the **Firebase Spark (free) plan**.
  - Firestore subscription is immediately unsubscribed before authentication changes to avoid transient `insufficient permissions` warning flashes.
  - Handled Electron popup restrictions in `main.js` by explicitly allowing Firebase Auth endpoints (`/__/auth/`) to open inside custom frames instead of default system web browsers.
- **Support Corner Overlay**:
  - Removed from the active board canvas widget grid. Now triggers via a premium Heart icon tab button in the top navigation bar.
  - Renders inside the centered glass `Modal` layout. Shows Philosophy card, Contribution Card, and the Wall of Honor side-by-side (`max-w-4xl`).
- **Aesthetic Fullscreen Layout**:
  - Fullscreen mode can be entered by pressing `F` (when idle) or clicking the TitleBar fullscreen icon.
  - The custom window `TitleBar` auto-hides (returns `null` in rendering) when fullscreen is active.
  - The main container wrapper dynamically applies `max-w-7xl px-6 py-6` to expand the viewport and fill the height while retaining clean, balanced margins.
  - Main section bottom padding is reduced from `pb-20` to `pb-6` to avoid empty screen space.
  - A yellow "Exit Full Screen" button (with the `Minimize2` icon) is added to `TopBar`. Users can exit fullscreen by hovering near the top edge to slide down the TopBar and clicking the button, or by pressing `Escape` when no other modals/panels are open, or pressing `F` anytime.
- **NL calendar capture** — `lib/nlParse.parseCapture` (chrono-node) parses locally; one write creates a slot / to-do / subject-linked task. Zero reads.
- **Kanban → subject sync** — on drop to *Done*, `MicroKanban` recomputes `progressPct = done/total` from in-memory tasks, writes it once, announces via the Island, appends a ledger entry.
- **Auto-update** — `electron-updater` (GitHub feed) → IPC → `updateSlice` → `UpdateGate` obscures the dashboard and pauses focus until the user restarts to install.

## 5. Free-tier discipline (hard rules for new features)

1. Ephemeral/derived state stays local (timers, flags, island, drafts, rings).
2. One bounded listener per active collection; never global/un-scoped. Tear down on mode switch.
3. Coalesce writes with `arrayUnion`/`arrayRemove`/`increment`; prefer one transaction over read-modify-write.
4. Bound history reads (`limit`). Sort client-side to avoid composite indexes.
5. Keep backend dependencies strictly compatible with the Firebase Spark (free) plan. Do not depend on Cloud Functions or servers.

## 5b. Production hardening additions (v1.1+)

### Resolution discipline
- Electron `BrowserWindow` is locked to native device pixels: `webPreferences.zoomFactor: 1.0`, `useContentSize: true`, `defaultFontSize: 16`, and `setVisualZoomLevelLimits(1, 1)` on the renderer. Persisted zoom from prior sessions is cleared on `did-finish-load`.
- CSS uses a single `--root-font-size` variable on `<html>`; every `rem` in the app scales from it. `useFontScale` mirrors `uiSlice.fontScale` (`compact` | `standard` | `large`) onto `data-font-scale`. The preference is persisted in `localStorage` (`protrack:fontScale`) so it survives reloads without a Firestore round-trip.
- `text-rendering: geometricPrecision` (not `optimizeLegibility`) avoids softened hinting on Windows HiDPI; `image-rendering: -webkit-optimize-contrast` keeps 1px hairlines crisp on 1.25x/1.5x DPI scaling.

### Gemini function-calling (write access)
- `src/services/geminiTools.js` exports `TOOL_DECLARATIONS` (Gemini schema) and an `executeTool(name, args, ctx)` dispatcher. Tools call the per-domain services — they never write Firestore directly.
- Tools: `complete_task`, `set_subject_progress`, `add_subject`, `add_task`, `add_todo`, `mark_todo_done`, `add_timetable_slot`, `toggle_habit_today`, `add_habit`.
- `chatWithGemini(history, contextText, ctx)` loops up to 4 hops, executing tool calls and feeding `functionResponse` back to the model. Returns `{ text, toolEvents }`; `ChatTab` renders the tool events as inline chips below the assistant bubble.
- Adding a tool: declare it in `TOOL_DECLARATIONS`, add a case to `executeTool`, no other changes needed.

### Intelligent Habit Engine
- `useHabitReminders` (mounted in `Dashboard.jsx`) schedules a rolling `setTimeout` per habit whose `interval` is `every-1h` / `every-2h` / `every-3h` / `every-4h` / `morning` / `afternoon` / `evening`. All timers are cleared on rebuild/unmount.
- `missedToday(habit)` is a pure function computing the per-day backlog (expected pings vs. completions). The Habits widget renders it as an amber `BellRing` chip on each habit row.
- Notification action buttons (`Done` / `Snooze`) are intentionally NOT used: Electron + Chromium don't expose action buttons without a Service Worker, and the cross-platform behavior is unreliable. Clicking the notification focuses the window; the user marks done in the widget. This keeps the engine dependency-free.

### Window state persistence
- `electron/main.js` reads/writes `userData/window-state.json` (no `electron-store` dep). Bounds are debounced on resize/move (300 ms) and captured only while NOT maximized/fullscreen, so the next unmaximize restores the prior "normal" size. Maximized + fullscreen flags are restored on `ready-to-show`.

### QR login latency hardening
- `QrLoginScreen` now retries `createHandshake` with exponential backoff (1.5s → 15s cap) on transient failure and self-heals on the `online` event. Previously a flaky first attempt left the QR empty for the full 110 s refresh cycle.

### Hardware fingerprint
- `deviceFingerprint()` (electron/main.js) hashes hostname + platform + arch + CPU model + sorted non-internal MACs with SHA-256, truncated to 32 hex chars. It can be spoofed by a privileged local actor (anything running as the user can fake `os.networkInterfaces()`); the design relies on this being **bound** to a Firebase auth account, not on the fingerprint alone being unforgeable. Account binding is the security boundary.

### CI/CD
- `.github/workflows/ci.yml` runs lint (if present) + multi-target build + an emoji-in-source guard on every non-master push and PR.
- `.github/workflows/release.yml` runs on push to `master` (or `workflow_dispatch` with a bump choice): version bump → CHANGELOG regen from conventional commits → Netlify deploy → matrix Electron build (Win/Mac/Linux) → GitHub Release with installer assets and extracted release notes.
- Required secrets: `GITHUB_TOKEN` (auto), `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` (optional). Code signing is intentionally skipped (`CSC_IDENTITY_AUTO_DISCOVERY: false`); add certs later when the project ships paid plans.

## 6. Maintenance guidelines

- **Brand:** zero emojis anywhere in UI/strings — Lucide icons only. There is a CI-friendly grep for emoji ranges; keep it clean.
- **Immutability:** slices return new objects; never mutate state in place.
- **Files:** small and feature-scoped (~200–400 lines). One service module per domain.
- **Bundle:** import Lucide icons by name (never `import * as`), or tree-shaking breaks and the bundle balloons. Heavy deps get a `manualChunks` vendor split in `vite.config.js`.
- **Build gates:** `npm run build` (web) and `ELECTRON=true vite build` (main + preload) must both stay green.
- **Releasing desktop:** bump `package.json` version, add a `content/changelog.js` entry, publish a GitHub release with the installer + `latest.yml`.
- **GitHub Release Automation:** configured `.github/workflows/release.yml` with `permissions: contents: write` and `--publish always` options.

## 7. Manual console prerequisites (not CLI-automatable)

- Firebase Auth: enable **Google** + **Anonymous** providers; add `pro-track-app.netlify.app` and `localhost` to authorized domains.
- For public desktop downloads + auto-update: the GitHub repo/release must be public (or the updater configured with a token).
