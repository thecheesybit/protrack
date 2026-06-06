# Changelog

## v1.1.3 — 2026-06-06

- fix: explicit auth persistence for Electron file:// protocol (ed7ce2b)


## v1.1.2 — 2026-06-06

- fix: auth-loader timeout + 8-char code login fallback (8d46866)


## v1.1.1 — 2026-06-06

- fix: never crash when Firebase config is missing at build time (591a1f7)


## v1.1.0 — 2026-06-06

- ci: dispatch-only trigger for the first v1.1.0 release (8b3d01f)
- feat: production hardening — v1.1.0 ready for release (8fea705)


## v1.1.0 — Production Hardening

### Added
- **Display settings** — Compact / Standard / Large font scale, persisted to localStorage. Applies instantly via `--root-font-size` CSS variable cascade.
- **Gemini function-calling layer** — the AI assistant can now `complete_task`, `set_subject_progress`, `add_subject`, `add_task`, `add_todo`, `mark_todo_done`, `add_timetable_slot`, `toggle_habit_today`, and `add_habit` from natural language. Tool calls run through the existing per-domain services; outcomes surface as inline chips in chat.
- **Intelligent Habit Engine** — interval-based reminders (`every-1h`, `every-2h`, `every-4h`, `morning`, `evening`) fire OS notifications, suppressed once daily target is met. Missed reminders aggregate as a backlog badge on the Habits widget.
- **Window state persistence** — size, position, maximized, and fullscreen survive restart (`userData/window-state.json`, no extra dependency).
- **Two-workflow CI/CD** — `ci.yml` on every push (lint + build + emoji guard); `release.yml` on push to master (version bump, conventional-commit changelog, Netlify deploy, matrix Electron build for Windows/macOS/Linux, GitHub Release with installers).

### Changed
- Electron `BrowserWindow` is now locked to native device pixels (`zoomFactor: 1.0`, `useContentSize: true`, visual zoom limits clamped to 1:1). HiDPI rendering is crisp on all DPI tiers.
- `body` text rendering switched from `optimizeLegibility` to `geometricPrecision` to avoid softened hinting on Windows HiDPI.
- QR login retries with exponential backoff (1.5s → 15s) on transient network failure and self-heals on the `online` event, instead of waiting for the 110s refresh cycle.

### Fixed
- Blurry UI on 1.25x / 1.5x Windows display scaling.
- QR screen stuck on error after a transient network blip on app start.
