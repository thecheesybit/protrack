# Changelog

## v2.2.0 — 2026-09-08

### Added
- **Per-Subject AI & Voice Bulk Task Entry (P12):**
  - Interactive `<SubjectQuickAdd />` mounted in `SubjectDetail` above MicroKanban with text input and speech recognition mic button (`useSpeechRecognition`).
  - Pure deterministic range & list parser (`src/lib/bulkParse.js`): instantly extracts "lesson 18 to 36", "1-5", "chapters 3, 5, 7", "lectures 10-12", or comma/multiline lists into formatted titles.
  - Single-shot Gemini AI fallback for freeform natural language study prompts when a Gemini key is configured.
  - Safe confirmation preview modal displaying total task count and removable item chips before committing to Firestore.
  - Chunked batched creation `addTasksBulk` in `subjectService.js` (chunk size <= 400, single progress recalculation, single ledger entry).
  - Gemini function-calling tool `add_tasks_bulk` in `geminiTools.js` and `/tasks <spec> @<subject>` slash command in `ChatTab.jsx`.
- **Raster Forest Sprites on Calendar (P13):**
  - 9 transparent tree sprites and 3 shrub sprites cropped and downscaled from source sheets with automated script (`scripts/crop_forest_sprites.py`).
  - High-performance sprite renderer (`ForestSprites.jsx`) with Framer Motion spring pop-in physics.
  - Integrated into `CalendarForest.jsx` `DayGrove` dynamically mapping to daily completed focus sessions.
- **Frictionless Quick-Add & Live Open-Items Counter (P11):**
  - Pure item counter `openItemCounts` (`src/lib/counts.js`) aggregating open to-dos, today's events, and overdue items.
  - Clickable live counter pill in `TimetableWidget` header jumping directly to day view.
  - Double-click on empty todo column body or persistent "+ tile" to focus task creation pre-targeted to that column.
- **Timetable To-Dos & Carry-Forward (P10):**
  - Compact numbered markers replacing cramped shelf lines in week and day views.
  - Rich floating `ItemDetailPopover` in the timetable gutter on hover/focus with quick actions.
  - Display-only carry-forward of overdue incomplete items onto today's view without mutating `dueAt`.
  - Double-click empty cells in timetable grid to create events at that time slot.
- **Subjects UX & Add-Anywhere (P9):**
  - Exhaustive scrollable compact list (no 5-item cap).
  - Add subject from anywhere with global scope mode picker (`SubjectEditorModal`).
  - Persistent collapsible two-pane rail in hero view.
  - Double-click on empty subjects container to add.

## v2.1.1 — 2026-09-07

### Added
- **Day-at-a-glance timeline (`TodayAgenda` redesign):** the Timetable widget's Day view is now a single merged, chronological timeline. It pulls together timetable slots, one-time events, to-dos & tasks with due dates, completed focus sessions and note deadlines for the selected day into one list — left time-rail with a continuous connector, colour-chipped cards showing title / time-range / duration, an "Anytime" bucket for untimed items, inline check-off for to-dos, a live red "now" line that auto-scrolls into view, and an "End of day · Xh Ym left" footer. Works in the global **All Scopes** view with a per-item mode-colour dot; cross-mode items are never hidden.
- **`src/lib/dayAgenda.js`:** pure, unit-tested aggregator — `buildDayTimeline({ slots, events, todos, tasks, sessions, notes, date, nowMin })` and `summarizeDay(items, nowMin)`. No Firestore reads or side-effects; it only reshapes data the widgets already subscribe to, so it adds zero backend cost.
- **Center-blur prompt system (`promptSlice` + `CenterPrompt`):** anything that needs an answer — daily check-ins, routine/habit cues, idle quotes — now takes over screen-center behind a full backdrop-blur, one prompt at a time, with a visible "Esc / ✕ to close" hint and a focus-trapped input. Closing without answering **snoozes** rather than losing the prompt. Replaces the bottom-left check-in card and the habit reminder toast. Suppressed during a running or locked focus session. Informational toasts stay in the Dynamic Island.
- **Universal notification chimes:** every Dynamic Island event now plays one fitting sound (distinct tones for success / progress / deadline / sync / focus), driven by `chimeForIslandKind` at the render layer so the notifier slice stays pure. A single **Settings → Sounds** toggle now mutes everything.
- **Unified sound module (`src/lib/sound.js`):** one 7-tone bank — `chime`, `pop`, `success`, `habit`, `notify`, `error`, `prompt` — behind `playSound(name)`, plus `chimeForIslandKind()`. The two previously drifting "sounds enabled" flags are consolidated into a single `protrack:sounds` key with a one-time migration. `src/lib/audioFX.js` is now a thin compatibility shim so existing callers keep working.

### Changed
- **Daily check-ins** surface as a center-blur prompt instead of a bottom-left glass card; dismissing still snoozes all slots for 90 minutes.

## v2.0.0 — 2026-09-07

### Added
- **Deep Focus Calendar Forest & Focus Tree:**
  - Gamified session growth visualization: every completed focus interval plants a unique, lush tree into your personal productivity forest mapped across the calendar month.
  - Interactive tree inspect modal with completion stats, streak growth, and celebratory visual effects (`SessionCompleteModal`, `FocusTree`, `CalendarForest`).
  - Dedicated shrubs border and ambient art assets for calendar and timetable views (`/forest/tree-hero.png`, `/forest/shrubs-border.png`).
- **Picture-in-Picture (PiP) Floating Focus Mode:**
  - Native always-on-top micro-timer window in Electron desktop builds via custom IPC channels (`pip.js`).
  - Draggable, responsive floating overlay (`FloatingFocusPip`, `PipFocusWindow`, `PipAppView`) for distraction-free multitasking.
  - Full session controls: pause/resume, break skip, elapsed/remaining time countdown, and instant restore to the primary workspace.
- **App Lock & Client-Side Encryption Security Vault:**
  - Dedicated security lock screen with animated lock visuals and PIN keypad (`AppLockOverlay`, `lockSlice`).
  - End-to-end client-side encryption using Web Crypto API (`PBKDF2` key derivation, `AES-GCM` 256-bit encryption with random salt and IVs in `cryptoService.js` & `lockService.js`).
  - Auto-lock after configurable idle duration (1m, 5m, 15m, 30m, 1h) or manual instant lock.
  - Secure PIN recovery mechanism and subscription caching.
- **Dedicated Notes & Audio Quick-Capture Widget:**
  - 8th core workspace widget (`NotesWidget.jsx`, `noteService.js`, `useNotes.js`): rich categorized note-taking with color coding, pinning, and multi-scope partitioning.
  - Voice note transcription and hands-free recording integration.
  - Markdown preview, search, tag filtering, and instant Firestore synchronization.
- **Interactive Habit Reminders & In-App Toasts:**
  - Real-time in-app interactive toasts (`HabitReminderToast.jsx`) with 10-minute snooze and one-tap completion.
  - Synchronized with native OS notifications on desktop.
  - Intelligent interval tracking (`every-1h`, `every-2h`, `every-4h`, `morning`, `evening`) and backlog aggregation.
- **Workspace Modes Contextual Menu & Safe Deletion:**
  - Right-click / ellipsis contextual actions on workspace mode chips (`ModeContextMenu.jsx`).
  - Safe mode deletion dialog (`DeleteModeModal.jsx`) with subject/task migration and orphan prevention.
  - Refined mode editing, color badge selection, and visual order adjustments.
- **Timetable & Today Agenda Overhaul:**
  - Redesigned daily agenda view (`TodayAgenda.jsx`, `TimeContextPanel.jsx`) with live time indicator, slot completion toggles, and integrated forest view.
  - Enriched drag handles, slot snapping, and seamless natural language capture integration in `TimetableGrid.jsx`.
  - Expanded timetable grid with responsive zoom and day/week view toggles.

### Changed
- **Settings Panel Complete Redesign:** Reorganized tabbed Settings panel (`SettingsPanel.jsx`) with dedicated sections for General, Appearance, Focus & Forest, Security & Lock, AudioFX, Sync & Backup, and Wall of Honor.
- **AudioFX Synthesizer Expansion:** Web Audio API synthesized audioFX library (`audioFX.js`) for crisp completion sounds, timer transitions, and button clicks without external audio asset dependencies.
- **Widget Canvas & Layout Stability:** Strengthened `BoardCanvas` layout engine and `WidgetFrame` boundaries with fluid transitions, min/max bounds, and responsive grid resizing.
- **Todos & Kanban Cards:** Enriched card controls, inline due-date pickers, tag pills, priority toggles, and smoother drag-and-drop mechanics.

### Fixed
- **Electron Production Builds & Localhost Fallback:** Fixed YouTube iframe embed playback and media permissions across packaged Windows/Mac/Linux environments.
- **CSP & Google Auth Gate:** Allowed `apis.google.com` in desktop Content Security Policy for flawless OAuth popup sign-in.
- **Auto-Update Stability:** Improved resilience against GitHub release asset 504 timeouts and enhanced update manifest resolution.
- **Lint & Test Coverage:** Added unit test suites for `cryptoService`, `lockService`, `CalendarForest`, and `FlipClock`, bringing total test count to 201 tests across 11 test suites.

## v1.8.0 — 2026-06-08

### Added
- **Deep Focus music / scene picker on the lock screen:** the curated background scenes (Forest River, Lo-fi Jazz, mantras, …) plus an Off switch are now reachable directly from the Deep Focus lock screen — tap the music button under the volume slider to start or change the ambient scene without leaving focus or opening Settings. Previously the picker only lived in the maximized Focus widget and in Settings, so it was effectively hidden once a session started. The preset list is now a single shared source (`src/lib/focusScenes.js`) used by the lock screen, the Focus widget, and Settings so it can never drift between surfaces.

## v1.7.2 — 2026-06-08

### Fixed
- **Auto-update "504 Gateway Time-out" spam:** the installed app polls GitHub's releases feed, which intermittently 504s during GitHub-side hiccups; every blip surfaced an alarming "Update failed" notice with a raw HTML/headers dump. Transient network/CDN errors (502/503/504, timeouts, dropped sockets, DNS) are now retried quietly with backoff and never shown — only genuinely persistent errors surface. Focus-triggered checks are debounced (≥10 min apart) to stop hammering GitHub, and the manual "Check for updates" returns a calm "GitHub is temporarily unavailable" message instead of the raw error.

## v1.7.1 — 2026-06-08

### Fixed
- **Version display drift:** the version shown in the top-left workspace branding (and a couple of Settings/Support fallbacks) was hardcoded to an old `v1.4.0` / `v1.0.0`. The version is now baked in from `package.json` at build time (`__APP_VERSION__`, exposed via `src/lib/version.js`) so every surface always shows the real shipped version in both the web and desktop builds.
- **Deep Focus video background:** the curated YouTube scene stopped playing in the packaged app. The embed URL had gained an `&origin=` parameter; in the installed build the renderer runs over `file://`, so the origin is the opaque `"file://"` and YouTube's `enablejsapi` check rejected the player (black screen). Removed the parameter from both the lock-screen and background-audio iframes — playback is restored and postMessage volume control is unaffected — and pinned `autoplayPolicy: no-user-gesture-required` on the Electron window.
- **Auto-update release pipeline:** a transient electron-builder binary-mirror 504 on a single OS used to fail the whole `build-electron` job — which `finalize` depends on — and silently drop the entire release (v1.6.0 was lost this way). The build step now retries up to 3× and the electron / electron-builder binary downloads are cached across runs.
- **macOS/Linux auto-update 404:** installer artifact names now use hyphens (`PRO-TRACK-…`) instead of the space-containing product name, so the on-disk file, `latest-*.yml`, and the uploaded GitHub asset all match (GitHub rewrites spaces in asset names to dots, which broke the updater's download).
- **Lint gate:** fixed two `no-empty` errors in `useSpeechRecognition.js` and several unused-variable warnings so `npm run lint` is green again.

### Changed
- Removed the dead `UpdateGate` overlay (superseded by Dynamic Island update notifications in v1.6.0) and refreshed the related docstrings.

## v1.6.0 — 2026-06-08

### Added
- **Smart Kanban Columns Height:** Backlog and In Progress (doing) lists in the Todos widget now dynamically scale their heights when stacked vertically. If one column is empty, it collapses to fit its header and empty hint (76px), letting the other occupy all remaining height. If both have tasks, height is distributed proportionally (clamped between 0.3 and 0.7).
- **Voice Activity Detection (VAD):** Integrated live microphone volume levels to power real-time speech activity tracking. Exposed `speechActive` state to keep the inactivity timer refreshed, preventing premature pauses during active fallback recording.
- **Silent Auto-Updates:** Replaced the blocking UpdateGate fullscreen screen with interactive, non-blocking Dynamic Island notifications (`update-downloading` and `update-ready`) and a quick-trigger install button inside the Settings Panel.

### Changed
- **Sidebar Menu Stabilization:** Sidebar rail now displays all 7 widgets permanently in a fixed, logical order with a custom active indicator bar and ambient background glow, ensuring spatial muscle memory is preserved.
- **Focus Widget Decluttering:** Simplified the controls in the Deep Focus panel by grouping them into a sleek glassmorphic tabbed switcher (Time, Audio, Scene) with smooth fade/slide transitions.
- **Hands-Free Loop Stabilization:** Wrapped the context builder and state object in `useCallback` and `useMemo` hooks, resolving a major stale closure bug that was feeding outdated workspace information to the voice engine.

### Fixed
- **Gemini MIME Type Error:** Stripped parameters and codec information (e.g., `;codecs=opus`) from recording audio blobs before sending them to the Gemini API, eliminating the `400 Bad Request` transcription failures.
- **Voice Restart Failures:** Removed the defensive same-transcript comparison check to prevent silent speech recognition locks and ensure voice restarts are 100% reliable.

## v1.2.0 — 2026-06-07

### Added
- **Per-item deadlines:** Tasks in Kanban and Todos now carry a `dueAt` field. A `datetime-local` picker in each card lets users set/clear due dates. Color-coded Calendar icons (rose = overdue, amber = upcoming) show status at a glance in compact view.
- **Deadline engine:** `lib/deadlines.js` provides pure helpers (`classifyDeadline`, `isDueToday`, `getUpcomingItems`). `useDeadlines` hook fires Dynamic Island notifications for overdue and due-today items on a 60-second debounce — zero new Firestore reads.
- **Deep Focus video background:** Five curated YouTube presets (Forest River, Varanasi Temple, Lo-fi Jazz, Hari Mantra, Shiv Stuti) plus a custom URL field in Settings. A cover-fill iframe plays as a fullscreen background behind the timer; `BackgroundAudioPlayer` is suppressed when the lock screen is already carrying audio.
- **Slash commands in AI Chat:** `/done`, `/todo`, `/progress`, `/habit`, `/task` commands bypass the Gemini API entirely — they map directly to tool calls, making the AI panel useful offline and without an API key.
- **Lazy analytics:** Recharts (`vendor-charts`, 364 KB) is only fetched when the Analytics widget is maximized. Non-hero mode shows four stat cards and zero chart bundle.
- **Settings — Deep Focus Scene:** Preset gallery + custom URL + visibility toggle for the focus video background.
- **Settings — Zen & Motivation:** Toggle to enable/disable the idle quote overlay and four duration choices (15 s / 30 s / 1 m / 2 m).
- **Gemini tool:** `set_todo_due` — set or clear a to-do's due date by natural-language text match.
- **Unit test suite:** Vitest 4 + ESLint 10 wired as `npm test` / `npm run lint`. 95 unit tests covering `lib/deadlines`, `lib/priority`, `lib/time`, `lib/nlParse`, and the `missedToday` habit-backlog helper.

### Changed
- NL quick-capture now stores `dueAt` on subject Kanban tasks (previously embedded the date only in notes), enabling calendar rendering and the deadline engine.
- Analytics widget grid variant shows a compact stat-card summary; hero variant adds charts via `React.lazy` + `Suspense`.
- `CommandMatrix` "Quick" section replaced with "Shortcuts" showing all slash command examples.
- `useFocusEngine` ledger write is now coalesced; no duplicates on rapid state transitions.

### Fixed
- CI: `auto-merge.yml` now dispatches with `bump=auto` so promotion uses the conventional-commit detector instead of hard-coding `patch`.
- `transcribeAudio` chunked base64 encoding prevents `RangeError` on recordings longer than ~1 s.
- `gcal-sync` Netlify function returns `501` instead of logging caller payloads unauthenticated.
- Bundle: unused `firebase/storage` + `firebase/functions` removed from `vendor-firebase` chunk; `getStorage`/`getFunctions` init dropped from `src/lib/firebase.js`.

## v1.1.15 — 2026-06-06

- feat: enforce architectural alignment, calendar credentials storage, settings restructuring, and kanban fixes (d779a86)


## v1.1.14 — 2026-06-06

- feat: complete v1.2.0 5-Module Overhaul (dce5757)


## [1.2.0] - PRO TRACK 5-Module Overhaul

### Added
- **Multi-Track Audio Engine:** Web Audio API multi-channel mixer with independent volume controls and synthesized UI event chimes (`task-complete`, `todo-added`, `lock-initiated`).
- **YouTube Background Stream:** Load ad-free lo-fi streams or custom audio URLs directly into the Focus dashboard via an integrated text field and "Load Stream" button.
- **Dynamic Lock Screen:** The `FocusLockScreen` component now overlays a frosted, distraction-free view over the entire workspace during Deep Work sessions, hiding all non-essential navigation.
- **Custom Timer Inputs:** Focus and break durations can now be customized dynamically via numeric inputs, rather than being restricted to predefined presets.
- **Universal Floating Clock:** The `FlipClock` is now a floating, draggable, and scroll-wheel resizable split-flap clock that persists its position and scale in `localStorage`.
- **All Scopes Mode:** A unified "All Scopes" aggregate view is permanently affixed to the front of the ModeSwitcher to provide a holistic view of all subjects and tasks.
- **Edge-Hosted Zen Quotes:** Replaced API-dependent motivational quotes with a fast, zero-latency, free-tier `zen_quotes.json` edge-hosted file.
- **Offline Resilience:** Deployed an intercepting `sw.js` Service Worker utilizing a stale-while-revalidate strategy to cache the SPA app shell and quotes JSON.

### Changed
- **Speech Recognition Lock:** The Web Speech API `useSpeechRecognition` hook now implements an explicit locking debounce to continuously restart and prevent premature mic drops during pauses.
- **Google Calendar Sync:** Shifted OAuth logic to a Netlify serverless function (`netlify/functions/gcal-sync.js`) for secure token exchange and bi-directional sync without client-side secrets.
- **Widget Resiliency:** Implemented strict bounds (`min/max` heights) to prevent layout jitter and shifting within widget frames during state transitions.

### Removed
- **Drag-and-Drop Reordering:** Eliminated DnD from the main ModeSwitcher navigation to prevent accidental structural changes, forcing users to use the Settings modal for mode management.
