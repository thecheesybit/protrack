# Changelog

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
