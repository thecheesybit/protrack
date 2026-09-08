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
│  ├─ island/             DynamicIsland (universal notifier — chimes per event)
│  ├─ prompt/             CenterPrompt (blur takeover) + CheckinPromptBody, RoutinePromptBody
│  ├─ desktop/            UpdateGate (forced auto-update overlay)
│  ├─ focus/              FocusPanel, FocusMiniOverlay, ForestView
│  ├─ calendar/           NlQuickCapture (chrono-node)
│  ├─ timetable/          TimetableGrid (+ live "now" flag), SlotEditor, TodayAgenda
│  ├─ subjects/           SubjectDetail, MicroKanban (drag→Done sync), SubjectQuickAdd (bulk/voice)
│  ├─ scorecard/          ScorecardWidget + editors/detail/charts/mistakes/AI-coach (exam mock tracker)
│  ├─ analytics/          HealthRings
│  ├─ support/            SupportModal (Philosophy + ContributionCard + WallOfHonor overlay)
│  ├─ widgets/            registry + per-widget components (incl. LedgerWidget)
│  └─ settings/           SettingsPanel (shortcuts, changelog, credits)
├─ hooks/                 useChronoTheme, useIslandCycle, useNowMinutes,
│                         useDesktopIntegration, useAutoUpdate, useFocusEngine,
│                         useDeadlines (Island deadline notifications),
│                         useCalendarSync (two-way Google Calendar live sync), …
├─ store/slices/          Zustand feature slices (below)
├─ services/              Firestore/IPC data access (one module per domain)
├─ content/              legal.js, changelog.js
├─ desktop/               isDesktop, TitleBar
└─ lib/                   firebase, color, nlParse, time, icons, constants,
                          deadlines (pure helpers), priority (taxonomy),
                          dates (ymd/streak/lastNDays), counts (openItemCounts),
                          bulkParse (pure range and list parser),
                          dayAgenda (pure day-timeline aggregator: buildDayTimeline/summarizeDay),
                          tags (pure unified tag layer: parseHashtags/normalizeTag/deriveAutoTags/mergeTags — lowercase hyphen slugs, additive tags[]),
                          gcalMap (pure event↔item mapping: eventToItem/itemToEvent/mergeStrategy),
                          sound (unified 7-tone bank: playSound(name)/chimeForIslandKind; audioFX is a shim),
                          tts (tiered text-to-speech: speak()/stopSpeaking()/getPreferredVoice())
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
| `checkinSlice` | recent check-ins | Firestore listener (checkins, limit 14); prompting now routes through `promptSlice` |
| `promptSlice` | active center-blur prompt + FIFO queue | **local only** — pure blocking-prompt queue (check-ins, routine cues, quotes) |
| `navSlice` | `moduleContext` + bounded `navStack` (last 10) | **local only** — pure cross-module nav/context bus: `openModule(widgetId, ctx)` / `navBack()` / `clearModuleContext()`. `BoardCanvas` reacts (maximise + `context` prop + Back chip); `uiSlice.openFocus` delegates here with `activate:false`. Tag/date/subject context for P8 widgets. |

Orchestration that owns timers/side-effects lives in hooks, never slices: `useFocusEngine` (tick, chime, notify, persist, ledger), `useIslandCycle` (auto-dismiss + chime per new event via `chimeForIslandKind`), `useChronoTheme` (writes `data-chrono` on `<html>`), `useNowMinutes` (timeline flag), `useAutoUpdate`, `useDesktopIntegration` (fingerprint + hotkeys + window state listeners).

## 3. Firestore data model

```
users/{uid}
  profile, settings { theme, activeModeId, hydrationIntervalMin, gcalInboxModeId, gcalAutoSync, onboarding{...} }, statsAggregate
  modes/{modeId}                      { name, icon, accentColor, order }
    subjects/{subjectId}              { name, color, progressPct, links[], flags[] }
      tasks/{taskId}                  { title, column, order }   ← Kanban
    timetableSlots/{slotId}           { dayOfWeek, startMin, endMin, label, color, googleEventId?, source? }
    goals/{goalId}
    exams/{examId}                    { name, category, targetScore?, targetAccuracy?, color, order, deletedAt? }  ← soft-delete, 15-day restore (examService)
    scorecards/{id}                   { examId, type:'flt'|'sectional', title, score, totalMarks, accuracy?, percentile?, correct/wrong/unattempted, mistakes[], attemptDate }  ← per-mode listener; raw-paste parser + Gemini coach
  gcal/handshake                      { status, accessToken?, expiresAt?, error? }  ← ephemeral (desktop→browser OAuth)
  habits/{habitId}                    { name, icon, color, doneDates[], timesPerWeek, timesPerDay, interval }
  todos/{todoId}                      { text, done, modeId, dueAt, subjectId }
  focusSessions/{id}                  { modeId, subjectId, durationMin, startedAt, hourOfDay }
  ledger/{id}                         { kind, title, detail, modeId, at }   ← bounded read (50)
  checkins/{ymd}                      { date, answers: { morning|midday|evening: { qid, type, value, note?, at } } }  ← bounded read (14)
```

**Updated field shapes (v1.2):**
```
tasks/{taskId}   { title, column, order, priority, notes, dueAt, createdAt }
todos/{todoId}   { text, done, modeId, dueAt, subjectId, type?, eventDate?, eventStartMin?, eventEndMin?, googleEventId?, source? }
                 ← `type:'event'` + eventDate/eventStartMin/eventEndMin for one-time calendar events;
                   googleEventId/source:'gcal' set when the item is mirrored to Google Calendar (P2)
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
- **NL calendar capture** — `lib/nlParse.parseCapture` (chrono-node) parses locally; one write creates a slot / to-do / subject-linked task. `dueAt` is now stored on tasks too, enabling calendar rendering and the deadline engine.
- **Google Calendar two-way live sync** (P2) — `src/hooks/useCalendarSync.js` (mounted once in `Dashboard`) runs `calendarService.syncEverything` on launch, every 5 min, on `window` focus, and on the `protrack:gcal-sync-now` event (fired by Settings → *Sync now* and the timetable header button). It is **live while the app is open**: the Firebase Google OAuth token can't refresh in the background on the Spark plan, so a lapse throws `CalendarAuthError` → one sticky `sync-offline` Island prompt (reconnect via Settings / the calendar header — **never** an automatic browser re-open). `lib/gcalMap.js` (pure, tested) maps events↔items: weekly RRULE→slot, one-off timed→`type:'event'` to-do, all-day→dated to-do; conflicts are last-write-wins by `updated` (`mergeStrategy`). Pull is delta-based via a persisted `syncToken` (`secureStorage['protrack:gcal_sync_token']`, `410`→full resync); `cancelled` events delete the mapped local item. Push creates events for local items lacking a `googleEventId` and PATCHes when a cheap content signature (`protrack:gcal_push_sigs`) changed; a `googleEventId` with no surviving local item is deleted from Google. New Google items land in `settings.gcalInboxModeId` (Settings picker; default = active mode). `settings.gcalAutoSync:false` disables the automatic triggers (manual *Sync now* still works). Free-tier: no new always-on listeners — reuses `useTimetable('all')` + the shared todos listener; bounded one-shot API reads. Known gap: per-subject Kanban `tasks` are **not** fed to the sync or the day timeline — a deliberate free-tier choice (a `collectionGroup('tasks')` listener would break "one bounded listener per active collection"); to-dos and one-time events with a `dueAt` already sync/surface. After-mutation debounced sync is a follow-up (interval + focus only for v1).
- **Kanban → subject sync** — on drop to *Done*, `MicroKanban` recomputes `progressPct = done/total` from in-memory tasks, writes it once, announces via the Island, appends a ledger entry.
- **Auto-update (fully silent)** — `electron-updater` (GitHub feed) → IPC → `updateSlice` → `useAutoUpdate`. `autoDownload` + `autoInstallOnAppQuit` are on, so the new build downloads unattended and installs on the next quit with no UI. `electron-builder.yml` uses the **NSIS one-click** target (no wizard, no "Next"); `update:install` calls `autoUpdater.quitAndInstall(true, true)` (`isSilent` + relaunch). The only prompt is one non-blocking "Restart to apply update" action in the Dynamic Island (and the mirrored button in Settings → Updates); `UpdateGate` still obscures the dashboard while a download is in flight. Store builds skip all of this (`isStoreBuild` → `initAutoUpdate` early-returns).
- **Exam scorecards** — `ScorecardWidget` (registry id `scorecard`) with `useExams(modeId)` + `useScorecards(modeId, examId)` (both fan out per-mode in `all` scope, same pattern as `useSubjects`). Exams are soft-deleted with a 15-day restore window (`examService`, `EXAM_RETENTION_DAYS`). `scorecardParser.js` turns a pasted Oliveboard/Testbook/PracticeMock result into a structured attempt (regex first, Gemini fallback); `ScorecardAiCoach` calls `generateGeminiExpertAnalysis` → `callAIProvider` (any configured provider) and caches the markdown report in `localStorage`. `html-to-image` powers the shareable scorecard PNG export. Charts (`ScorecardCharts`) use the same lazy-Recharts discipline as analytics.
- **Deadline engine** (`src/hooks/useDeadlines.js`) — mounted in `Dashboard`; uses `getUpcomingItems` from `lib/deadlines.js` (pure, no reads) to check overdue/due-today items from Zustand-cached todos and fires Island notifications with a 60-second debounce. No new Firestore reads.
- **Deep Focus video background** — `FocusLockScreen` reads `settings.focusAudioUrl` and `settings.focusVideoEnabled`. When a YouTube URL is stored and video is enabled, it renders a cover-fill iframe (177.78 vh × 56.25 vw, centered) behind a `bg-black/55` overlay with the timer panel on top. `BackgroundAudioPlayer` in `Dashboard` early-returns null when the lock screen is already playing the iframe to prevent duplicate audio. Five curated presets plus a custom URL field live in **Settings → Deep Focus Scene**. **Never add `&origin=` to the embed URL** — the packaged app runs over `file://`, so `window.location.origin` is the opaque `"file://"` and YouTube's `enablejsapi` origin check then refuses to play (this regressed the feature in v1.6.0). The window also pins `autoplayPolicy: 'no-user-gesture-required'` so the scene autoplays.
- **Slash commands** in `ChatTab` — `SLASH_PATTERNS` + `parseSlashCommand()` intercept `/done`, `/todo`, `/progress`, `/habit`, `/task` before the Gemini key gate; they call `executeTool` directly, making the AI useful offline and without an API key for common mutations.
- **Lazy analytics** — `AnalyticsCharts.jsx` (all Recharts imports) is a separate file loaded via `React.lazy`. Non-hero mode shows stat cards with zero chart bundle; `vendor-charts` (364 KB) is only fetched when the widget is maximized.
- **Zen overlay settings** — `settings.zenEnabled` (bool, default true) and `settings.zenDuration` (ms) control the idle quote overlay. Both are configurable in **Settings → Zen & Motivation**.
- **Assistant voice / TTS** (P6) — `src/lib/tts.js` is the single tiered speak path for every spoken surface (`HandsFreeTab`, `BackgroundHandsFree`, `ZenOverlay` — the old copy-pasted `speakHandsFree`/`fallbackWebSpeech`/`speakQuote` are gone). `speak(text, { lang, voiceEnabled, rate=1.0, pitch=1.0, onStart, onEnd })` tries **ElevenLabs → OpenAI TTS → Web Speech** (order pinnable via `protrack:tts_provider`); each tier degrades gracefully and always fires `onEnd`. The Web Speech tier picks the most natural installed voice (`getPreferredVoice` scores neural/"Natural"/named voices up, espeak/compact down, honours `protrack:tts_voice`) at rate/pitch ~1.0 — the fix for the old robotic 0.85/0.9 fallback. `stopSpeaking({ fade })` interrupts any tier. **Settings → AI → Assistant Voice** picks the provider tier + device voice. Keys still come from `geminiService` getters (never hardcoded).
- **Center-blur prompts** (P4) — `promptSlice` (pure FIFO) + `CenterPrompt` (mounted once in `Dashboard`): any prompt that needs an answer — check-ins, routine/habit cues, idle quotes — takes over screen-center behind a full `backdrop-blur` overlay (`z-[60]`, above the Island), one at a time, with a persistent "Esc / ✕ to close · snoozes" hint and focus-trap. `useCheckIns`, `useHabitReminders` and `ZenOverlay` push into the queue instead of rendering their own card/toast; the old `CheckInCard` + `HabitReminderToast` renders are retired. Closing unanswered runs that type's snooze (never silently lost). Suppressed during a running/locked focus session. Plays `playSound('prompt')` on open.
- **Universal Island chimes** (P5) — `useIslandCycle` plays `playSound(chimeForIslandKind(kind))` once per new `islandActive` id (last-sounded id tracked to prevent replay). `islandSlice` stays pure — sound is added at the render layer only. One Settings toggle drives the single canonical `protrack:sounds` flag via `setSoundsEnabled` (old `protrack:sounds_enabled` is migrated once).
- **Daily check-ins** — `lib/checkin.js` (pure, tested) defines three slots (morning 5–12 / midday 12–17 / evening 17–23), a rotating question bank, `shouldPrompt` gating (enabled, slot unanswered, snooze, 90 s settle), and trend/insight derivation. `useCheckIns` (mounted in `Dashboard`) evaluates once a minute — never during a running/locked focus session — and hydrates the bounded `checkins` listener into `checkinSlice`; it now pushes a `type:'checkin'` entry into `promptSlice` (rendered by `CenterPrompt`, not the old bottom-left card). Each answer is one merge-write (≤3/day). The evening question references the morning intent when one was set (rule-based, zero tokens); the morning wording may be AI-personalized at most once per day via `fetchCheckinQuestion` (localStorage-cached, silent fallback to the bank when no key/network). Quiet adaptation: a ≤2 rating queues one gentle Island suggestion; a morning intent can become a to-do in one tap. Toggle: `settings.checkinsEnabled` (Settings → Sounds & Notifications → Wellness Controls). Dismissing snoozes all slots 90 min (`protrack:checkin:snoozedUntil`).

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
- Tools: `complete_task`, `set_subject_progress`, `add_subject`, `add_task`, `add_tasks_bulk`, `add_todo`, `mark_todo_done`, `add_timetable_slot`, `toggle_habit_today`, `add_habit`, `set_todo_due`.
- `chatWithGemini(history, contextText, ctx)` loops up to 4 hops, executing tool calls and feeding `functionResponse` back to the model. Returns `{ text, toolEvents }`; `ChatTab` renders the tool events as inline chips below the assistant bubble.
- **Slash commands** bypass the model entirely: `/done <title> [@subject]`, `/todo <text>`, `/progress <subject> <pct>`, `/habit <name>`, `/task <title> @<subject>`, `/tasks <range/list> @<subject>`. See `ChatTab.jsx → SLASH_PATTERNS`.
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
- `.github/workflows/ci.yml` runs lint (if present) + multi-target build on every non-master push and PR.
- `.github/workflows/release.yml` runs on push to `master` (or `workflow_dispatch` with a bump choice): auto-detects version bump from conventional commits (feat→minor, feat!/BREAKING→major, else patch) → Netlify deploy → matrix Electron build (Win/Mac/Linux) → GitHub Release with installer assets and release notes extracted from `CHANGELOG.md`. **Never overwrites `CHANGELOG.md`** — the developer curates it before merging. Heading format must be `## v<semver> — YYYY-MM-DD` so the `awk` extractor in the finalize job finds the right section.
- Required secrets: `GITHUB_TOKEN` (auto), `NETLIFY_AUTH_TOKEN` + `NETLIFY_SITE_ID` (optional). Code signing is intentionally skipped (`CSC_IDENTITY_AUTO_DISCOVERY: false`); add certs later when the project ships paid plans.

### Shipping targets (Windows)
Two distribution channels from one codebase, split at packaging time:
- **GitHub (default)** — `nsis` **one-click** target (`oneClick: true`, no install-dir prompt), self-updates **silently** via `electron-updater` reading the GitHub release feed (see §4 "Auto-update"). This is what CI builds. Existing installs upgrade in place via the registry entry regardless of the one-click switch.
- **Microsoft Store** — `npm run electron:build:appx` produces an `.appx` for Partner Center submission. The `appx` block in `electron-builder.yml` carries **placeholder** `identityName`/`publisher` values — they MUST be replaced with the Partner Center product-identity values before submission. At runtime `process.windowsStore` (exposed to the renderer as `app:info → storeBuild`) disables `electron-updater` entirely (`initAutoUpdate` early-returns, `update:check` returns a calm message, Settings → Updates shows a Store notice instead of the check button): the Store owns update delivery, and self-updating would both violate Store policy and fail inside the AppX sandbox. `appx` is deliberately NOT in the default `win.target` list so CI release assets keep matching `latest.yml`.

## 6. Maintenance guidelines

- **Design system (v2 "premium"):** the UI is mid-migration to a refined design language —
  Fraunces/DM Sans/DM Mono type, warm parchment canvas, dark "island" cards, token-driven
  palette, a 7-slot time-of-day theme, and an icon-only sidebar shell. The living spec, locked
  decisions, reuse map, and phased roadmap live in [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md).
  Foundation (fonts, tokens, `WidgetFrame`, Kanban) has landed; the shell rebuild + time theme +
  data-viz upgrades are the next phases. Read that doc before doing UI work.
- **Focus ring total:** `phaseTotalSec` (focusSlice) is the single source of truth for the current
  phase length — every ring (`FocusWidget`, `FocusMiniOverlay`, `FocusLockScreen`) computes
  progress from it so mid-session +/- adjustments and custom timers stay proportional. Do not
  reintroduce `focusMin`/`customTimerSetting` into ring math.
- **Brand:** Zero emojis are preferred in UI strings, but Unicode emoji support exists for user convenience (the CI brand guard has been removed).
- **Immutability:** slices return new objects; never mutate state in place.
- **Files:** small and feature-scoped (~200–400 lines). One service module per domain.
- **Bundle:** import Lucide icons by name (never `import * as`), or tree-shaking breaks and the bundle balloons. Heavy deps get a `manualChunks` vendor split in `vite.config.js`.
- **Build gates:** `npm run build` (web) and `ELECTRON=true vite build` (main + preload) must both stay green. `npm test` (Vitest, 95 unit tests) and `npm run lint` (ESLint 10) must also pass.
- **Tests:** pure logic lives in `src/lib/__tests__/` and `src/hooks/__tests__/`. Use `vi.useFakeTimers()` for any test that depends on `new Date()`. Mock React/Firebase imports via `vi.mock` when testing hooks that pull them in at the top level.
- **Releasing desktop:** bump `package.json` version, add a `content/changelog.js` entry, publish a GitHub release with the installer + `latest.yml`.
- **GitHub Release Automation:** configured `.github/workflows/release.yml` with `permissions: contents: write` and `--publish always` options.

## 7. Manual console prerequisites (not CLI-automatable)

- Firebase Auth: enable **Google** + **Anonymous** providers; add `pro-track-app.netlify.app` and `localhost` to authorized domains.
- For public desktop downloads + auto-update: the GitHub repo/release must be public (or the updater configured with a token).
