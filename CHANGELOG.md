# Changelog

## v1.1.9 — 2026-06-06

- feat: changelog auto-syncs to shipped releases (2bb635d)


## v1.1.8 — 2026-06-06

- feat: priority dot at end of task/todo row + visible legend strip (cdcd031)
- feat: flip clock pinned to top-left by default, double-click toggles auto-hide (b0030fc)


## v1.1.7 — 2026-06-06

- feat: aggressive auto-update with full event surfacing (0d588c0)


## v1.1.6 — 2026-06-06

- ci: auto-merge now explicitly dispatches release.yml (GITHUB_TOKEN pushes don't trigger workflows) (b1e0dfc)
- fix: signInWithPopup auth/argument-error — initializeAuth needs an explicit popupRedirectResolver (6eba40f)
- ci: release pipeline now syncs bump commit to development too — prevents auto-merge divergence (faa5e66)
- docs: rewrite README with branded landing format [skip ci] (69f6395)
- feat: gemini model fix, flip clock, priority + notes + reorder (c326773)


## v1.1.5 — 2026-06-06

- feat: lock down DevTools in packaged production builds (a8b3b69)
- fix: trim Firebase env values — CI secrets pasted with trailing newlines silently broke auth (projectId became 'my-id\n' → invalid auth domain) (71d872c)


## v1.1.4 — 2026-06-06

- ci: split build & publish — synchronous installer upload (c1c7b52)
- ci: harden auto-merge PR fallback (soft-fail) [skip ci] (e233b89)
- ci: enable full automation — push to master auto-releases [skip ci] (7fa9bef)
- ci: auto-merge development → master when verified (facb0cb)


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
