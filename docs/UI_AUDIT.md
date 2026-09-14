# PRO TRACK — UI Audit (Consistency & Polish Pass)

Findings from a senior-design audit of every surface, done **before** any restyle so
scope can be confirmed. Pairs with [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (the token
spec this audit measures against) and [`claude.md`](../claude.md) (architecture).

Date: 2026-09-14 · Branch: `development` · Method: full component enumeration (130
`.jsx`), pattern greps for the specific "tells," and direct reads of every major screen.

---

## 0. Executive summary — the real problem

The premise "no design language, no tokens" is **out of date**. ProTrack already has a
mature token system: CSS-variable palette (light/dark **and** all 7 chrono slots),
radius + elevation tokens, a global accent `:focus-visible` ring, a
`prefers-reduced-motion` kill-switch, and real `ui/` primitives (`Button`, `Modal`,
`Sheet`, `ProgressBar`, `StatCard`, `GlassCard`). Much of the DESIGN_SYSTEM.md "planned"
overhaul (icon sidebar, 7-slot time theme, StatCard) has in fact **shipped**.

**The actual problem is undisciplined *application* of a system that already exists.**
The app feels "built in 13 phases" not because there's no system, but because a large
fraction of components bypass it. The evidence is quantitative:

| Finding | Count | Files |
|---|---|---|
| Hardcoded palette colors (`slate/zinc/gray/white/black-*`) instead of tokens | **434** | **90** |
| Raw OS form controls (native `input[type=number/range/date/…]`) | **47** | 19 |
| Raw OS `<select>` dropdowns | **25** | 10 |
| Ad-hoc `fixed inset-0` overlays (vs the shared `Modal`) | **22** | 22 |
| Distinct modal/overlay backdrop treatments | **≥7** | — |
| Files importing the canonical `Button` primitive | only **12** | — |
| Font families loaded (`DESIGN_SYSTEM.md` says "1–2 max") | **8** | — |

The fix is therefore **enforcement + gap-closing on the existing system**, not a new
design system. That is much lower-risk than the prompt assumes and fits the "restyle
within the existing structure" constraint.

---

## 1. What is already strong (do NOT rebuild)

- **Token palette** — `src/index.css` defines light, dark, and 7 per-slot chrono themes
  as RGB-triplet CSS vars wired into Tailwind (`bg-surface`, `text-ink`, `text-muted`,
  `border-line`, `bg-accent`). This is a genuinely good foundation.
- **`ui/Modal.jsx`** — textbook: portal to `<body>`, focus trap, Escape, body-scroll
  lock, focus restoration, full ARIA dialog pattern. The problem is only that it's
  under-adopted.
- **`ui/Button.jsx`** — 4 variants (primary/secondary/ghost/danger) × 4 sizes, token
  colors, focus ring, disabled state. Solid; under-adopted.
- **Global `:focus-visible`** accent ring on all interactive elements — keyboard focus
  is *not* missing app-wide (contrary to the prompt's assumption).
- **`prefers-reduced-motion`** globally disables transitions/animations.
- **`TitleBar.jsx`** — correct Windows frameless chrome: controls right-aligned, drag
  region via `-webkit-app-region`, red close-hover, token colors, live max/restore sync.
- **Rendering-crispness discipline** — the fixed-16px root + text-only `--text-scale`
  work is deliberate and correct; **do not touch** (see the standing note in memory:
  fractional-pixel spacing was a real regression).

---

## 2. Cross-cutting findings (ranked by impact)

### C1 — Leaf components hardcode dark chrome (the real cascade)
The **shell itself is already tokenized.** The normal workspace root
(`Dashboard.jsx:369`) is `relative flex h-full flex-col`, inheriting the body's
`bg-bg text-ink` with `AuroraBackground` painting the chrono canvas behind. The one
`bg-slate-950 text-white` at `Dashboard.jsx:363` is the **PiP-window branch only**, where
near-black is correct. So there is no single shell override to blame (an earlier draft of
this audit claimed there was — corrected after reading the render).

The drift lives in the **leaf components**: widgets and editors hardcode their own dark
chrome (`bg-black/30`, `text-white/70`, `border-white/10`) instead of deriving from
tokens. Because the app is used dark-first (auto theme is dark for every slot except
morning/midday/afternoon; the reference screenshots are all dawn/dark), this is invisible
today — but in the **daytime light slots** those dark cards sit on the parchment canvas
and read muddy. Fixing it is what makes light mode and cross-component consistency work.

### C2 — 434 hardcoded palette colors across 90 files — two kinds a grep can't tell apart
The dominant finding **and the one that most needs visual verification**, because the 434
split into two cases that must be handled oppositely:
- **Intentional dark-island surfaces** (FocusLockScreen, PipAppView, ZenOverlay,
  MonthlyForest's soil patch, ambient/weather overlays) — white-on-dark is *correct* and
  must be **preserved**. At most, rename raw `white`/`black` to `island` + an
  `--text-inverse` token; appearance must not change.
- **Real drift** (theme-adaptive widgets, editors, modals, prompts) — `slate-950`,
  `text-white/70`, `bg-black/30` where `bg-surface`/`text-ink`/`text-muted` belong. This
  is the part to convert.

Telling these apart per-site is a visual judgment in **both** light and dark, not a
mechanical replace — a blind global sweep would flatten the intentional dark surfaces.
This is the biggest reason the sweep must be verified surface-by-surface (see §5).

### C3 — 72 raw OS form controls (the "browser-y" tell)
Native `input[type=number|range|datetime-local|date|time|checkbox]` (47) and `<select>`
(25) render OS-default chrome that clashes with the rest of the UI. Concentrated in the
editor modals: `ScorecardEditorModal` (12), `SlotEditorModal` (6+5 select),
`SubjectEditorModal` (6+4 select), `ExamEditorModal` (4+2), `IntegrationsTab` (4 select).
No shared styled form-control layer exists — every control is hand-styled or left raw.

### C4 — Modal/overlay fragmentation
The excellent `Modal.jsx` is used by ~12 dialogs, but **22 components roll their own**
`fixed inset-0` centered overlay (SessionCompleteModal, CenterPrompt, FocusPanel,
TimeContextPanel, SupportModal, AIAssistant, AlarmRingingBanner, …). Backdrops vary
across at least **7 treatments**: `bg-black/40`, `/50`, `/60`, `/80`, `bg-slate-950/80`,
`/92`, `/95` — no single scrim token. Result: inconsistent dim level, blur, radius, and
close affordance between dialogs that should feel identical.

### C5 — `Button` under-adoption
Only 12 files import `ui/Button`; the rest hand-roll `<button className="…">` with
per-instance padding/radius/hover. Primary-action buttons especially drift (amber
gradient here, `bg-accent` there, `bg-emerald-500` elsewhere).

### C6 — Font-family sprawl
8 families are loaded/referenced: Fraunces, DM Sans, DM Mono, **Outfit, Inter**
(`font-brand`), Playfair (`font-serif-quote`), Cinzel, Rozha. DESIGN_SYSTEM.md commits
to "1–2 typefaces max" (Fraunces/DM Sans/DM Mono). The quote/brand fonts are decorative
and should be justified or dropped.

### C7 — Radius system is doubly-defined and mismatched
`index.css` tokens say `--radius-2xl: 28px`, but `tailwind.config.js` overrides
`rounded-2xl → 1.125rem (18px)` and `rounded-3xl → 24px`. So `rounded-2xl` in markup
≠ `--radius-2xl` the token. Plus arbitrary `rounded-[..]` values appear ad hoc. Pick one
radius source of truth.

### C8 — Hidden scrollbars everywhere
`* { scrollbar-width: none }` + `::-webkit-scrollbar { display: none }` globally removes
all scrollbars. On a desktop app this kills the primary affordance that a region
scrolls (Kanban columns, notes list, settings). Consider a thin styled scrollbar for
genuinely scrollable panes rather than a blanket hide.

### C9 — Spacing scale: doc/impl mismatch (not a real inconsistency)
DESIGN_SYSTEM.md references `--space-1..10`, but those vars are **not** defined in
`index.css`; components use Tailwind's default spacing — which *is* a 4px grid, so
spacing is actually fairly consistent. This is a doc cleanup, not a code fix. Ad-hoc
`px-2 py-1.5`-style values do vary between analogous rows and are worth a rhythm pass.

### C10 — Toast styling
`react-hot-toast` is used app-wide; confirm a single themed toast config (position,
radius, token colors, icon set) rather than default white toasts — needs a spot-check
during implementation.

---

## 3. Per-surface notes

Concise; each surface's headline issues. "Tokens" = C1/C2 color drift, "Forms" = C3,
"Modal" = C4.

| Surface | Headline issues |
|---|---|
| **Shell** (Dashboard/BoardCanvas/TopBar/TitleBar) | C1 root `slate-950/white`; TitleBar good (minor: button order min/fullscreen/max/close — Windows norm is min/max/close, fullscreen is non-standard in caption bar). |
| **Deep Focus** (FocusWidget/FocusSetup) | Heavy `bg-black/*`+`text-white/*`; native `range` + `number`; duplicated stat readouts (already trimmed). |
| **Focus lock / PiP / Zen** | Intentionally dark — adopt `island`/inverse tokens instead of raw white/black; otherwise fine. |
| **Subjects / MicroKanban** | Native `datetime-local`; token drift on cards; merged-todo board (new) is consistent. |
| **Todos widget** | 30 hardcoded colors (most in the list rows); its own DnD board vocabulary — fine, but colors should tokenize. |
| **Scorecard** (widget + 5 modals) | Worst forms offender (ScorecardEditorModal 12 native inputs + selects); charts hardcode slate. |
| **Timetable / Calendar** (grid/month/agenda/editors) | TimetableGrid 32 hardcoded colors; SlotEditorModal 6 native inputs + 5 selects; ItemDetailPopover/TimeContextPanel ad-hoc overlays. |
| **Settings** (SettingsPanel + ~10 tabs) | Native selects (Integrations 4); mixed control styling tab-to-tab; otherwise structured. |
| **AI Assistant** (Chat/Voice/Note) | Ad-hoc overlay backdrop; token drift. |
| **Modals** (Mode/Habit/Alarm/Analytics/Confirm/Help/WhatsNew/Support/Weather) | Split between `Modal.jsx` adopters and ad-hoc overlays (C4); backdrop drift. |
| **Prompts / Island** (CenterPrompt bodies, DynamicIsland, AppLock) | CenterPrompt rolls its own shell (justified — blocking queue); align its scrim + radius to the modal token. |
| **Auth / Onboarding / Web gateway** (QrLogin, OnboardingGate, Landing, Link pages, Patreon) | Standalone screens; token drift; verify these too since they're first-impression surfaces. |

---

## 4. Missing states (targeted — most are present)

Global focus ring and reduced-motion are covered. Real gaps to check per-surface during
implementation, not assumed-missing wholesale:
- **Empty states** — some strong (MonthlyForest "freshly tilled soil"), some absent
  (empty scorecard/timetable). Standardize an `EmptyState` primitive.
- **Loading states** — `Spinner`/`AppLoader` exist; lazy widgets (charts) should show a
  skeleton, not a layout jump.
- **Error states** — `ErrorBoundary` + calendar error banners exist; form validation
  errors in editors are inconsistent (some silent).
- **Disabled/hover/active** — present on primitives; ad-hoc buttons vary.

---

## 5. Recommended scope (for confirmation)

Do **not** rebuild the design system — enforce and close gaps in the existing one. The
proposed token additions and the phased plan live in
[`DESIGN_SYSTEM.md` §10–§11](./DESIGN_SYSTEM.md). Highest-leverage order:

1. **C2 color-token sweep** — biggest visible win, done **surface-by-surface with
   light+dark verification** so intentional dark-island surfaces are preserved.
2. **C3 styled form-control layer** — kills the "browser-y" tell.
3. **C4 modal/scrim unification** — dialogs feel like one app.
4. **C5–C10** — Button adoption, font consolidation, radius source-of-truth,
   scrollbar policy, spacing rhythm, toast theming.

**Verification constraint (important):** the app is gated behind Google sign-in, which
this environment can't complete — so an agent cannot self-verify the *visual* correctness
of the color sweep in light and dark. The sweep therefore proceeds per-surface with a
human (or a signed-in preview) confirming each surface in both themes, rather than as one
blind 90-file diff. Build/lint/test gates catch code errors but not visual regressions.

Business logic, IPC, and state are untouched throughout (visual/props only).
