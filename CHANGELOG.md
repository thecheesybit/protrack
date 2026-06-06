# Changelog

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
