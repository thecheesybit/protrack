# PRO TRACK — Design System (v2 "premium")

Living reference for the premium UI overhaul. Pairs with [`claude.md`](../claude.md)
(architecture) and is the source of truth for tokens, typography, component specs, and the
time-of-day theme. Brand rule still applies everywhere: **zero emojis, Lucide icons only.**

Status legend: `[x]` landed · `[~]` partial · `[ ]` planned.

---

## 0. Status snapshot

**Foundation (landed this cycle)**
- [x] Google Fonts: Fraunces (display), DM Sans (body), DM Mono (mono) — `index.html`
- [x] Tailwind families `font-display` / `font-sans` / `font-mono`; `shadow-premium-{sm,md,lg}` — `tailwind.config.js`
- [x] Warm parchment canvas (`--bg: 240 236 228`) + premium tokens (radii, shadows, text scale,
      `--color-canvas`, `--color-island`) — `src/index.css`
- [x] `.font-display` + `.island-dark` utilities; `prefers-reduced-motion` kill-switch — `src/index.css`
- [x] `WidgetFrame` — Fraunces titles, DM Mono subtitles, gradient icon chip
- [x] To-dos Kanban: drag/drop, double-tap → In Progress, **dismiss pushes back to Backlog
      (not delete)**, animated focus banner, dark-island Done section
- [x] Sidebar Stabilization: permanent 7-widget order, active accent indicator and sliding glow — `BoardCanvas.jsx`
- [x] Focus Controls Decluttering: tabbed switcher (Time, Audio, Scene) with smooth transitions — `FocusWidget.jsx`
- [x] Smart Kanban Column Heights: dynamic, proportional flex sizing and empty states — `TodosWidget.jsx`
- [x] Speech & Updates Overhaul: VAD silence detection, silent Dynamic Island auto-updates, Gemini MIME-type transcription fix.

**Bug fixes (landed this cycle)**
- [x] Focus ring progress now reads `phaseTotalSec` (single source of truth) in `FocusWidget`,
      `FocusMiniOverlay`, and `FocusLockScreen` — previously the grid widget/mini ring used
      `customTimerSetting`/legacy `focusMin`, so the ring overshot or went negative after the
      mid-session +/- time pills, and was wrong for custom timers.

**Overhaul (planned — see §8 phases)**
- [ ] Full shell rebuild: 64px icon-only sidebar (absorbs the mode switcher), floating header
- [ ] Dramatic 7-slot time theme + DEV time slider + SkyOverlay/starfield + Time HUD
- [ ] Full-bleed KPI hero cards
- [ ] Blob/aura chart, pill-gradient Gantt bars, animated rings
- [ ] Dark-island wrapping for calendar / plan / secondary stats

---

## 1. Decisions locked

- **Shell:** full rebuild — a 64px icon-only left sidebar holds primary nav AND the mode
  switcher; the horizontal mode-pill carousel is removed from the top.
- **Time theme:** full dramatic spec — extend the existing 4-band chrono system to 7 slots with
  per-slot canvas colors (near-black at deep_night/dawn/dusk/evening). Dark slots MUST also
  darken surfaces so cards never sit white-on-black.
- **FAB:** keep the single existing AI Sparkles FAB (bottom-right, 56px) and restyle to spec; do
  not add a competing amber Plus FAB in the same corner.

---

## 2. Palette

Implemented as CSS custom properties in `src/index.css`. Theme-aware tokens are RGB channel
triplets so Tailwind's `<alpha-value>` works (`bg-surface/60`).

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--bg` (canvas) | `240 236 228` (#f0ece4) | `7 8 12` | warm parchment / obsidian |
| `--surface` | `255 255 255` | `16 17 23` | card surface |
| `--surface-2` | `248 245 240` | `23 25 33` | inset surface |
| `--text` | `16 17 23` | `240 241 247` | primary ink |
| `--muted` | `99 102 116` | `148 151 167` | secondary text |
| `--border` | `218 213 205` | `32 34 44` | hairline |
| `--accent` / `--accent-2` | time-driven | time-driven | owned by `useChronoTheme` |
| `--color-island` | `#1c1c22` | `#1c1c22` | dark island card bg |

Accent palette (to register as Tailwind colors in Phase A so components stop hardcoding hex):
`amber #f59e0b · rose #f43f5e · violet #7c3aed · sky #0ea5e9 · sage #4ade80`.

---

## 3. Typography

- Display: **Fraunces** (`font-display`) — hero numbers, section/widget titles.
- Body: **DM Sans** (`font-sans`) — default.
- Mono: **DM Mono** (`font-mono`) — time labels, counters, badges.

Scale (CSS vars in `:root`): `--text-hero` clamp(2rem,5vw,3.5rem)/700 · `--text-display` 1.5rem/600
· `--text-title` 1.125rem/600 · `--text-body` .875rem/400 · `--text-label` .75rem/500 upper +.05em
· `--text-mono` .8125rem. Rule: no 600+ weight on body copy.

---

## 4. Spacing / radii / elevation

- Spacing: 4px grid (`--space-1..10`).
- Radii: `--radius-{sm 8, md 12, lg 16, xl 20, 2xl 28, pill 999}px`.
- Elevation: `--shadow-{sm,md,lg}` (also Tailwind `shadow-premium-{sm,md,lg}`).
  Rule: shadows only on floating cards / FABs — never on flat inline elements.

---

## 5. Component specs

- **Sidebar (new):** 64px, icon-only, no border. Widget nav (maximize) from `widgetRegistry`;
  mode switcher absorbed (port `ModePill` logic); bottom avatar + settings/theme. Active = accent
  pill (`bg-accent/12`, accent icon); hover = `bg-black/4` + `scale(1.05)`. Reuse `getIcon`
  (`lib/icons`) and the `DockChip` visual language from `BoardCanvas.jsx`.
- **Floating header:** no bg/border. Fraunces title + muted breadcrumb; centered 340px pill
  search; right = notification bell + avatar; Time HUD top-right.
- **KPI hero cards:** full-bleed category gradient (sky-teal / violet / rose-amber), Fraunces
  number, 64px right-aligned Lucide icon, hover `translateY(-4px)` + shadow-lg. Upgrade the shared
  `Stat` card (duplicated in `AnalyticsWidget.jsx` + `FocusWidget.jsx`) into `ui/StatCard.jsx`.
- **Gantt pill bars:** extend `ui/ProgressBar.jsx` with a gradient pill variant
  (sky→violet / violet→rose / rose→amber / amber→sage), animate width 0→N% on mount.
- **Blob/aura chart (new):** SVG blurred radial glows, mix-blend, gentle pulse. Replace the
  "Focus minutes · 14 days" Recharts `BarChart` in `AnalyticsCharts.jsx`.
- **Rings:** reuse existing SVG-dashoffset pattern (`HealthRings.jsx`, Focus `Ring`,
  `FocusMiniOverlay` `MiniRing`); add a 4-up mini efficiency-ring variant where needed. Do not
  build a new ring engine.
- **Dark islands:** `island-dark` utility (bg `--color-island`, inverse text); wrap calendar /
  plan / compact stats. Verify ≥4.5:1 contrast.
- **FAB:** restyle the existing AI FAB in `Dashboard.jsx` (56px, bottom-right, gradient) to spec.

---

## 6. Time-of-day theme (7 slots)

Extends the existing chrono pipeline (`useChronoTheme` → `data-chrono` on `<html>` → CSS +
`chronoSlice`). Today it is 4 bands (`dawn|day|dusk|night`). Expanding to 7 is a **breaking
rename** — every consumer below changes together:
`useChronoTheme.js`, `index.css` (`[data-chrono]` blocks), `context/ThemeContext.jsx`,
`components/focus/FocusLockScreen.jsx` (`BAND_META`), `store/slices/chronoSlice.js`.

| Slot | Hours | Canvas | Surface (dark island) | Accent |
|---|---|---|---|---|
| deep_night | 0–4 | #08080f | #0d0d1a | violet |
| dawn | 5–6 | #1a100a | #1c120c | amber + rose |
| morning | 7–10 | #f0ece4 | #1c1c22 | sky |
| midday | 11–14 | #f5f2eb | #1a1f2e | sky + sage |
| afternoon | 15–17 | #f2ede3 | #1c1608 | amber |
| dusk | 18–20 | #18090e | #1f0d10 | rose + amber |
| evening | 21–23 | #0d0b14 | #130e1f | violet |

Dark slots (deep_night, dawn, dusk, evening): also toggle dark surfaces so cards aren't
white-on-black. Ambient: `SkyOverlay` fixed inset-0 z-0 pointer-events-none (opacity 0.12 light /
0.28 dark); starfield canvas only for deep_night/evening/dusk; Time HUD (DM Mono slot + time +
SkyIcon, `island-dark`). Add a DEV-only time override (guard with `import.meta.env.DEV`, surfaced
in `SettingsPanel`) to test all 7 slots without waiting for the clock.

---

## 7. Reuse map (do not rebuild)

- SVG rings: `analytics/HealthRings.jsx`, `widgets/FocusWidget.jsx` `Ring`,
  `focus/FocusMiniOverlay.jsx` `MiniRing`, `focus/FocusLockScreen.jsx` `Ring`.
- Ambient bg: `common/AuroraBackground.jsx` (extend for `SkyOverlay`, don't duplicate).
- Icons: `lib/icons.getIcon`. Mode logic: `layout/ModeSwitcher.jsx` `ModePill`. Dock visuals:
  `layout/BoardCanvas.jsx` `DockChip`.
- Chrono pipeline: `useChronoTheme` + `chronoSlice` + `data-chrono` CSS.
- Stat card: existing `Stat` in `AnalyticsWidget.jsx` / `FocusWidget.jsx`.
- Focus total: `phaseTotalSec` (store) is the only correct phase-length source for rings.

---

## 8. Migration phases (next session)

- **A — Tokens:** register accent + canvas/island/inverse colors in Tailwind.
- **B — Shell:** new `layout/Sidebar.jsx`; slim `TopBar` to floating header; remove `ModeSwitcher`
  from top (port into sidebar); offset main content; restyle AI FAB.
- **C — Time theme:** expand 4→7 slots across all consumers; `common/SkyOverlay.jsx`; starfield;
  Time HUD; DEV slider.
- **D — Hero cards:** `ui/StatCard.jsx`; apply to Analytics + Focus.
- **E — Data viz:** `analytics/AuraChart.jsx` (replace a bar chart); gradient `ProgressBar`;
  ring reuse.
- **F — Lists / islands:** 56px rows w/ dot-progress; wrap calendar/plan/stats in dark islands.
- **G — Polish + QA:** staggered entrances, hover lifts, run the §9 checklist.

---

## 9. QA checklist (run before each PR)

- [ ] Backgrounds use tokens — no hardcoded #fff/#000
- [ ] Fraunces on hero/display numbers; DM Mono on time labels + counters
- [ ] Sidebar icon-only 64px with pill active state
- [ ] Canvas is warm parchment, not white
- [ ] At least one dark island on the main dashboard
- [ ] At least one blob/aura chart replacing a bar chart
- [ ] FAB present, bottom-right, 56px
- [ ] SkyOverlay z-0, pointer-events-none
- [ ] All 7 time slots tested via the DEV slider; Light-mode user never stranded on black canvas
- [ ] Dark mode verified; no shadows on flat inline elements; no 600+ weight on body copy
- [ ] `prefers-reduced-motion` disables transitions
- [ ] Build gates green: `npm run build`, `ELECTRON=true vite build`, `npm test`, `npm run lint`;
      emoji guard clean
