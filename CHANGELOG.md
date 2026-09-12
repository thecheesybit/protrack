# Changelog

## v2.8.2 — 2026-09-12

### 🔍 App-Wide Rendering Crispness
- **Fixed systemic fractional-pixel spacing**: the document root's font-size used to move with your text-size preference (18px for "Standard"), which made every half-unit Tailwind spacing/sizing class (`p-1.5`, `gap-1.5`, `h-1.5`, and dozens like them, used everywhere) compute to a fractional CSS pixel value — e.g. 6.75px instead of 6px. Fractional box and border dimensions force the browser into sub-pixel anti-aliasing, which reads as general softness across borders, dots, and hairlines even at 100% display scaling, by default, for every user.
- **The fix**: the root is now permanently fixed at 16px, so all spacing/sizing/border-radius utilities always land on whole pixels. Text-size preference still works exactly as before — it now scales through a separate multiplier applied only to text, so every preset renders text at exactly the same size it did previously. Nothing about the "Standard" default look changes; only the fractional-pixel spacing artifact goes away.

### ⏰ Alarm Clock Reliability
- **Fixed a silent alarm loss**: if two alarms were due close together, the second would never ring at all once its exact due-minute passed — which, since dismissing an alarm can take a minute or more, was a real and repeatable way to lose a scheduled alarm entirely. A second alarm due while one is already ringing now queues and rings the instant the first is dismissed.

### 🌦️ Weather Sandbox Fixes
- **Atmospheric Effects toggle was missing**: the on/off switch for rain/fog/wind particle effects existed in the underlying logic but had no control in the UI — added to the Weather Sandbox panel.
- **Wind speed now actually affects the animation**: gusty presets (Loo, squalls) previously looked identical in speed to a calm breeze; particle and wind-line animation now scales with the simulated wind speed.

### 🌳 Focus Forest Variety
- Both the daily and monthly Focus Forest views now render the intended mix of oak/pine/blossom/palm tree species per session instead of always falling back to fully random sprites — the variety logic existed but was never wired to the render.

### 🐛 Smaller Fixes
- **To-dos no longer go stale at midnight**: in a long-running session, "today" could get stuck on the previous day, hiding tasks actually due today and breaking the overdue carry-forward check. Now re-checked continuously.
- **Deleting a snoozed habit no longer leaves a ghost reminder**: a pending 5-minute snooze re-fire is now cancelled when its habit is deleted, instead of notifying for (and failing to mark done) a habit that no longer exists.
- **Esc now correctly closes the Weather Sandbox** modal — it previously read a stale value and never closed on Escape.
- **Clearer message when notifications aren't supported** on the current platform, instead of the misleading "permission not granted by browser."

### 🚚 Removed
- **Timetable Legends** (the interactive hover rail, subject inspector, and class-type legend introduced in v2.8.0) has been removed.

### 🛠️ Release Pipeline — Independent Per-Platform Publishing
- Windows, macOS, and Linux installers now build and publish **independently** — previously, all three had to succeed before *any* installer shipped, so a single flaky macOS notarization run could hold back Windows and Linux releases that had already built successfully. Each platform now uploads straight to the release as soon as it's ready.
- **Releases no longer ship with a blank description** when the developer forgets to add a matching `CHANGELOG.md` section before tagging — falls back to GitHub's auto-generated notes instead.

### 🧹 Code Quality
- Resolved every ESLint warning and error in `src/` (21 errors, 54 warnings) — several turned out to be genuinely half-wired features (see Weather/Forest fixes above) rather than dead code.

## v2.8.0 — 2026-09-09

### 🎛️ Timetable Legends — Interactive Hover Rail, Subject Inspector & Class Type Legend
- **Dynamic Context Rail**: A glassmorphic hover rail anchored to the timetable card that expands on slot hover or click, showing a full live inspector, subject roster, and class type reference.
- **3-Tab Segmented Switcher**:
  - **Inspect**: Live slot inspector with subject name, type badge (`[L]` Lecture, `[Lab]` Lab, `[T]` Tutorial, `[S]` Seminar, `[Rev]` Revision), time & duration, room/venue, custom topic, and a 1-click "Focus on this Class" action button.
  - **Subjects**: Color-swatched subject roster with weekly session counts, total hours, and study-load progress bars. Hovering any subject highlights all its timetable sessions with a pulsing accent ring.
  - **Types**: Tactile cheat-sheet cards for all class type badges.
- **5-Second Linger Grace Period**: When the cursor leaves a slot, a visible countdown runs; hovering the panel within 5s cancels the close. Complete idle inactivity (no mouse movement) also triggers auto-close.
- **Pin/Unpin Toggle**: Persistent pin button to keep legends locked open (`localStorage` backed).
- **Push Pill to Close**: Tactile `✕ Close` button and `Escape` key for instant collapse.

### 🔒 Legend Lock Toggle (`L` Key)
- **Locked by Default**: Legends start disabled on first launch — no accidental expansion from slot hovers.
- **`L` Key Global Shortcut**: Press `L` anywhere to toggle legends on/off. Registered in the `?` shortcuts sheet.
- **Locked Hover Hint**: When locked, hovering the legend pill shows a high-visibility badge: `Legends locked · Press [L] to turn on`.
- **Click-to-Unlock**: Clicking the legend pill while locked instantly unlocks and expands it.

### 🎯 Pill & Legend Mutual Exclusivity Engine
- **Pill (A) ↔ Legend (B)**: Opening one always closes the other; both can be closed, but never both open simultaneously.
- **Scope Dropdown Integration**: Opening the scope selector closes legends and blocks them from opening. Both pills (Mode Switcher + Legend) and the bottom dock notch bar disappear while the scope list is down.
- **Store-Level Enforcement**: All mutual exclusion rules enforced in `uiSlice.js` with comprehensive unit tests.

### 📐 Legend Height & Clock Clearance
- **2 cm Bottom Clearance Increase**: Legend pill raised by ~76px (`bottom-[120px]` → `bottom-[196px]`, `bottom-[12px]` → `bottom-[88px]`), reserving ample space for area (C) and the desk clock.
- **Clock Always Visible**: With the increased clearance, the FlipClock no longer hides when legends expand — the `blocksLegend` intersection logic is removed entirely.

### ⏰ Reimagined Alarm Pop-Up & Audio Testing Station
- **Theme-Aligned Chrono Design**: Dynamic `var(--accent)` styling matching the time-of-day palette. Two tabs: **Set Alarm** and **Saved Alarms**.
- **Tactile Digital Steppers**: Retro flip-card hour/minute steppers with AM/PM toggle pill replacing raw browser selects.
- **Quick Presets**: One-tap offset buttons (`+5m`, `+15m`, `+30m`, `+1h`, `Next :00`) and productivity purpose chips (`Deep Focus`, `Drink Water`, `Review Notes`, etc.).
- **Play & Test Audio**: Interactive audio testing with 5 sound profiles (*Vibrant Alarm*, *Temple Bell*, *Crystal Chime*, *Singing Bowl*, *Marimba Alert*), live equalizer animation, and automatic mute detection with 1-click unmute.
- **Ctrl+T Zen Mode**: Alarm button cleanly hidden in full-screen centered desk clock mode.

### 🔔 Per-Notification Habit Snooze Policy
- **Instance-Level Snooze**: Snooze tracks per scheduled notification instance (`routine_snooze_slot_${today}_${habitId}_${cue.time}`), not per day.
- **1 Snooze per Notification**: Each cue can be snoozed exactly once; the snoozed reminder shows "Already snoozed once". Subsequent cues for the same habit later that day remain snoozeable.

### ⚡ Performance & Architecture
- **Consolidated 1-Second Heartbeat (`useGlobalTick`)**: Single reference-counted singleton timer aligned to wall-clock seconds, replacing independent `setInterval` timers.
- **Aurora Low Power Mode**: Settings toggle to replace heavy 140px blur layers with a lightweight CSS radial glow on integrated GPUs.
- **Focus Timer Leaf Isolation**: Extracted `<FocusTimerLeaf />` so only the countdown subscribes to `secondsLeft`, eliminating 60 full-widget re-renders per minute.
- **BoardCanvas rAF Throttling**: Split divider drag cached via `getBoundingClientRect` on pointerdown + `requestAnimationFrame` throttling.
- **Long List Virtualization**: `useVirtualList` hook windowing completed tasks and ledger entries past 20 items.

### 🏛️ Mode Archiving, Analytics Goals & Notes Markdown
- **Mode Archiving**: Soft-delete modes with 1-click restore or permanent purge from a dedicated modal.
- **Custom Analytics Goals**: Configurable daily focus and session targets with dynamic health rings.
- **Notes Markdown Rendering**: Zero-dependency markdown engine with headings, lists, bold/italic, code, links, and interactive hashtag chips.
- **Subtask Checklists**: Inline subtask creation, toggle, and deletion within Kanban cards with progress badges.

### 🛠️ Fixes
- **Dashboard Not Rendering**: Resolved missing `useAlarmWatcher` import causing `ReferenceError` on dashboard mount.
- **`useMemo is not defined`**: Added missing React hook import in FlipClock.jsx with automated import verification test.
- **Settings Tabs**: Fixed Account Tab blank screen (IIFE wrapper bug), Privacy Tab crash (missing `APP_VERSION` import), and Security Tab missing PIN modal.

### 📊 Test & Build
- **542 tests** passing across **46 test suites** (100% pass rate).
- Production build in **~11.5s** with zero errors.

## v2.6.0 — 2026-09-09

### ⏰ Phone Alarm Clock & Resonant Hourly Chime
- **Tactile 3D Alarm Plunger on Flip Clock**: Added a mechanical, physical plunger button positioned directly below the Flip Clock chassis with realistic spring depression physics and tactile pop sound. Toggleable via `Alt+A` or direct click.
- **Continuous Smartphone Marimba Ringtone**: Procedurally synthesized multi-bar upbeat marimba melody with dual-frequency harmonic overtones and bassline (`E3`, `A3`, `B3`) looping continuously until turned off or snoozed.
- **Interactive Desktop OS Notification**: High-priority native notification pinned with `requireInteraction: true` that prompts "Click to turn off alarm", instantly restoring and focusing the app window when clicked.
- **Full-Screen Phone Alarm Clock Ringing HUD**: Immersive overlay with vibrating bell shockwaves, live real-time digital clock, bold alarm label, giant tactile **TURN OFF ALARM** button, and **Snooze (+5m)** button. Supports one-key dismissal via `Space`, `Enter`, or `Escape`.
- **Temple Bell Hourly Chime**: Resonant dual-tone gong chime ringing automatically on the hour (`:00`) to keep users mindful of time without opening the window.

### 🌌 Aesthetic Obsidian Aurora Boot Canvas
- **Video & Bloat Removal**: Completely eliminated heavy background videos and clashing white-background GIFs from the loading screen, saving ~3 MB from the initial boot bundle.
- **Signature Cosmic Atmosphere**: Grounded in ProTrack's authentic obsidian canvas (`#07080c`) with 3 shifting aurora blooms (`animate-aurora`), dotted blueprint grid (`bg-grid`), and a 90-star deterministic starfield matching `AuroraBackground`.
- **Celestial Gyroscope Emblem**: Dual counter-revolving orbital rings carrying glowing starlight nodes (`#818cf8` and `#c084fc`) surrounding a frosted glass shield with the floating `a9.png` brand mark.
- **Seamless Window Header**: Seamless full-screen alignment (`fixed inset-0 z-40`) behind frameless desktop titlebar controls, removing all color seams. Centered brand heading with adjacent version pill (`v2.6.0`) and scaled creator attribution ("Crafted with obsession by AYUSH KUMAR").

### 🚀 What's New Video Tour
- **First-Boot Post-Update Showcase**: Automatic focused pop-up on restart after updates featuring an optimized, silent video preview of new capabilities, smoothly transitioning to release highlights and a thank-you screen. Launchable on demand from **Settings → Updates**.

### ⌨️ Global Shortcuts & Ergonomics
- **Instant Access Shortcuts**: Added one-key shortcuts across the app:
  - `Alt+T` / `T`: Quick add to-do pre-focused on Backlog.
  - `Alt+S` / `S`: Open Subjects manager.
  - `Alt+N` / `N`: Open Notes & quick capture.
  - `Alt+F` / `F`: Launch Deep Focus session.
  - `Alt+C` / `C`: Switch to Timetable / Calendar.
  - `Alt+E` / `E`: Open Exam Scorecards.
  - `Alt+A` / `A`: Open Alarm scheduler.
- **Sidebar Tooltip Alignment**: Portaled floating icon tooltips directly to `document.body` to eradicate vertical translation drift.

### 📋 To-Dos (MicroKanban) Hover Accordion & Ordering
- **Dynamic Hover Accordion**: Hovering over Backlog, In Progress, or Completed smoothly expands that section to ~60% height while compressing sibling columns.
- **Invisible Scrollbars**: Implemented `.no-scrollbar` styling so all task columns scroll seamlessly with mousewheel without visual bar clutter.
- **Recent-on-Top Sorting**: Completed tasks sort descending by completion timestamp so newly finished tasks land at the top of the Completed column.

### 📅 Timetable Past Days Greying Out
- **Visual Past Days Dimming**: In Week View, all past days are clearly greyed out and dimmed across header pills, all-day trays, and column bodies, highlighting today and the upcoming week.
- **Full 24-Hour Cycle**: Full day support from 6 AM to 6 AM past midnight.

## v2.4.0 — 2026-09-08

> Supersedes the intermediate v2.3.0 auto-release — same work, complete notes.

### Subjects ↔ Timetable — build your class schedule
- The **subject editor** (create *and* edit, from the compact list or the fullscreen rail) now has a **Class / lab times** builder: per row — **type** (Lecture / Lab / Tutorial / Seminar; sets the on-grid style), **start–end**, **room**, a custom label, a **start date**, and an **end** (runs indefinitely / ends on a date / ends after *N* sessions).
- **Smart repeats:** every week (weekday picker) · every weekday (Mon–Fri) · every day · every 2 / 3 / 4 weeks · specific days (7-chip multi-select) · just once (single date). The extra pickers appear only when they apply. Same class twice a week → two rows. `isSlotOnDay` honours all of these plus the term window using the column's real date, so a class stops showing once its term ends.
- Saving a subject syncs those rows to timetable slots tagged with the subject (its colour + name), so your week fills in automatically. `SubjectDetail` also gets a quick "Class schedule" list to view / add / remove times.
- Slots carry `recurrenceStartDate` + `recurrenceEndDate`; a class stops appearing on the grid once its term ends (`isSlotOnDay` now honours the real column date for every recurrence type).

### Timetable
- **Zoom** the week grid 0.75×–4× (persisted) — a `+ / −` control in the nav; sub-hour gridlines densify (30 → 15 → 5 min) and the axis gains `:15` labels past 2×, so 9–10 AM opens into a clean minute view.
- Clicking a weekday header opens that day in the Day view (was firing the add-task popup).
- Undated to-dos created today render inline on the grid at their created time, numbered 1·2·3 — not piled in the top "+N" tray.
- **Week / Day / Month** switcher in every mode, including fullscreen; **Month** is a real 6×7 calendar grid (click a day → Day view), and works from local data with or without a Google connection.

### Google Calendar — shipped as a hidden beta
- The two-way sync plumbing is complete (GIS silent-refresh token, all-calendars pull incl. holidays, local-cache display, calendar-only push, robust 403/429 handling) but the OAuth/consent flow is too fiddly for the free tier, so **`GCAL_ENABLED = false`**: every connect/login affordance is hidden and the sync hook is inert. Flip `src/lib/flags.js` to re-expose it.

### AI
- The Gemini model cascade listed retired 1.5-* models, so a "high demand" 503 fell through to 404s and gave up. Current ids only (2.5-flash → 2.0-flash → *-lite → 2.5-pro), one retry on the preferred model then a graceful walk down the list.

### Elsewhere
- **`?` shortcuts sheet** — the `?` key or a top-right button (kept clear of the window controls) opens a grouped reference of global, in-app and window shortcuts.
- Answered daily check-ins are also filed as all-scope **memory notes** so the AI can recall your mock status / intent / energy later.
- Compact **To-dos** "Completed" panel no longer floats over the board.
- **Zero ESLint warnings** (was ~73); forest source sheets (~5 MB) and unused shrub art removed.

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

- **Cross-module navigation / context bus (`navSlice`) — P7:** a single pure Zustand slice — `moduleContext` plus a bounded 10-entry `navStack` — lets any item hand context to another module. `openModule(widgetId, { itemType, itemId, subjectId?, date?, tag?, activate? })` records the target and `BoardCanvas` surfaces that widget (maximise + a Back chip in the dock) and passes the context down as a `context` prop for a widget to scroll-to / highlight the item; `navBack()` and `clearModuleContext()` round it out. `uiSlice.openFocus` now delegates to `openModule('focus', … , { activate: false })`, so the Subject→Focus / Slot→Focus / Zen→Focus deep-links additionally record their origin while the Focus overlay keeps driving the visible UI exactly as before.
- **Unified tag layer (`src/lib/tags.js`) — P7:** pure, tested helpers for one tag taxonomy across todos / tasks / notes / slots / subjects — `parseHashtags(text)`, `normalizeTag(s)`, `deriveAutoTags({ text, subjectName, modeName })` and `mergeTags(existing, derived)`. Tags are additive metadata — a `tags[]` is only *added* where missing, mirroring the dormant `notes.tags[]`; the tag index is derived client-side with no new Firestore reads. Shared `TagPill` / `ScopeChip` primitives ship in `src/components/common/`.
- **Google Calendar two-way live sync (P2):** `useCalendarSync` (mounted in `Dashboard`) runs `calendarService.syncEverything` on launch, every 5 min, on window focus and on the `protrack:gcal-sync-now` event. Pure `lib/gcalMap.js` maps events↔items (weekly RRULE→slot, one-off→`type:'event'` to-do, all-day→dated to-do; last-write-wins by `updated`). Delta pull via a persisted `syncToken`, `cancelled`→delete local, push creates/PATCHes/deletes remote; new Google items land in `settings.gcalInboxModeId`. A lapsed OAuth token raises `CalendarAuthError` → one sticky "Reconnect Google Calendar" prompt (no silent browser re-open). Settings → Schedules Sync gains last-sync time, Sync now, inbox-mode picker and an Auto-sync toggle.
- **Natural assistant voice + centralized TTS (P6):** `src/lib/tts.js` is the single tiered speak path (ElevenLabs → OpenAI TTS → Web Speech) for Hands-Free replies and spoken quotes; `getPreferredVoice()` picks the most natural installed voice and speaks at rate/pitch ~1.0 (the old robotic 0.85/0.9 fallback is gone). Provider tier + device voice are pickable in Settings → AI → Assistant Voice.

### Changed
- **Auto-update is now fully silent.** Download is unattended (as before); install no longer shows the NSIS wizard — `electron-builder.yml` uses the one-click target and `update:install` calls `quitAndInstall(true, true)`. The two competing "restart" prompts collapse to a single non-blocking "Restart to apply update" action in the Dynamic Island; the update also applies on the next quit regardless.
- **Dynamic Island chimes for auto-update events.** `chimeForIslandKind` now maps `update-ready` / `milestone` to the success tone and keeps the background `update-downloading` state silent (was an undifferentiated `notify`).
- **Habit reminders no longer dogpile (P4b).** Only one habit cue can hold the center-blur prompt at a time — further cues land in the Dynamic Island instead of stacking. A cue that keeps re-firing folds onto its own prompt (`promptSlice.coalesceKey`) rather than enqueuing duplicates.
- **One snooze per habit cue per day, and it's 5 minutes** (was unlimited, 10). After the snooze the button disables to "Snoozed once".
- **Skipped cues auto-mark missed (P4b).** Each cue carries a window (`habitCueExpiry`); if unanswered when it closes, the cue dismisses itself and the ping is counted by the existing `missedToday` backlog. No new Firestore reads or writes.
- **Picture-in-Picture is finished (P3).** Double-clicking the floating timer expands the window back to its exact prior state (geometry / maximized / fullscreen) with the countdown and scene audio unbroken. The mini widget gains an always-visible bottom bar (mm:ss + a pause/resume dot). **Expand vs Close are now distinct:** Expand restores and keeps the clock running; Close restores *and pauses* the session.

### Removed
- **Dead PiP variants (P3).** `FloatingFocusPip.jsx` is deleted; `PipFocusWindow.jsx` is now strictly the browser-only Document Picture-in-Picture fallback. Desktop runs 100% on the single-window morph path.
- **Dead check-in / habit-toast debris.** `src/components/wellness/HabitReminderToast.jsx` (orphaned since P4) and the unused `checkinSlice.checkinPrompt` / `setCheckinPrompt` / `clearCheckinPrompt` fields are removed.

### Fixed
- **Scorecard suite consolidation.** 20 dead imports/vars removed; the widget no longer flashes the "Add Your First Exam" empty state before `useExams` resolves; the AI coach shows "add an AI provider key in Settings" instead of a raw "Gemini key missing" when generation fails for a missing key.

### Docs
- **Marketing landing page rewritten** to match the v2.2 workspace (day-at-a-glance timeline, Google Calendar sync, exam scorecards, bulk/voice entry, silent updates); the "zero-cost backend" vs "keep the servers running" copy contradiction is resolved.
- **Known gaps (unchanged, documented):** P8 (per-widget tag pills + cross-module drill-downs on top of P7's bus) is not yet built. The merged day timeline still excludes per-subject Kanban *cards* with a due date — a deliberate free-tier choice (no `collectionGroup` task listener); to-dos and one-time events with a `dueAt` already appear.

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
