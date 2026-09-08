# PRO TRACK v2.1 — Consolidation Plan (P1–P13 + Scorecard + Website + Auto-Update)

**Author:** Claude (Sonnet 5) · **Date:** 2026-09-08
**Scope source:** `I:\Downloads\claude-code-prompt.md` (4-step consolidation brief)
**Reference specs:** [`docs/V2.1_MULTI_AGENT_ROADMAP.md`](./V2.1_MULTI_AGENT_ROADMAP.md), [`docs/SESSION_REPORT_CLAUDE_P9_P13.md`](./SESSION_REPORT_CLAUDE_P9_P13.md)
**Status:** 🟢 **APPROVED — decisions locked (see §8); execution waits on the merged `development`**

### Decisions locked (owner, 2026-09-08)
- **D1 — merges:** the **parallel wave-3 session** merges *everything* into one `development` —
  P2, P6, **P7, P4b, P3** included. This consolidation session does **not** run any branch
  merges (old "Unit 1" is retired). Execution here starts once wave-3 ends and `development`
  is the single merged branch.
- **D2 — auto-update post-install UX:** **one non-blocking "Restart to apply update" action**
  in the Dynamic Island; silent download + silent install; installs on next quit regardless.
  No auto-relaunch.
- **D3 — branch strategy:** land Units 2–8 **directly on `development`**, one gate-green
  commit-group per unit.
- **D4 — website screenshots:** **skipped this pass** — copy / features / steps rewrite only.
- **D5 — forest source assets:** _still open_ — default to **keep** (`trees-2.jpg` etc. stay)
  unless you say otherwise; revisit in a later cleanup.

---

## 0. How to read this document

This is **Step 1** of the brief: an audit of what actually shipped in P1–P13 (+ the scorecard
extra), cross-checked against the roadmap and the Antigravity session report, plus the
website and auto-update review. **No production code has been changed yet.** Section 8 lists
the decisions I need from you before starting the fix pass.

The audit method: read both spec docs in full; enumerate branches / worktrees / merge state;
run all four build gates on `development`; grep for dead code, `TODO(Px)` anchors, unused
slice fields; trial-merge the unmerged branches; read the core pure modules
(`dayAgenda`, `counts`, `bulkParse`), `Dashboard.jsx`, the auto-update chain end-to-end, and
the marketing page. Neither spec doc was trusted blindly — every claim below is grounded in a
file/line or a command result.

---

## 1. Baseline — current state of `development`

| Gate | Command | Result on `development` @ `a68f3ab` |
|---|---|---|
| Lint | `npm run lint` | ✅ **0 errors**, 73 warnings (all `no-unused-vars` for unreferenced Lucide imports / args) |
| Unit tests | `npm test` | ✅ **308 passed** / 20 files |
| Web build | `npm run build` | ✅ built in ~10 s |
| Electron build | `ELECTRON=true vite build` | ✅ main.js + preload.cjs emitted |

**The tree is green.** Consolidation is about *integration gaps, dead code, half-merged work,
untested wiring, doc drift, and UX polish* — not a broken build.

### 1.1 Merge state (the single most important finding)

| Phase | Branch | Merged to `development`? | Effect if left unmerged |
|---|---|---|---|
| P0 sound | `feat/p0-sound` | ✅ yes | — |
| P1 day-view | `feat/p1-dayview` | ✅ yes (`b196e23`) | see §3 P1 — task listener never wired |
| P4 center-prompts | `feat/p4-prompts` | ✅ yes (`5453ea1`) | — |
| **P4b** habit-prompt dogpile fix | `feat/p4b-habit-prompts` (`8c37e62`) | ❌ **NO** | habit cues can still stack; snooze-once / auto-miss logic absent |
| P5 chimes | `feat/p5-chimes` | ✅ yes | — |
| **P3** finish PiP | `feat/p3-pip` (`ad2c2f8`) | ❌ **NO** | dead `FloatingFocusPip`/`PipFocusWindow` still mounted; Expand==Close bug; no dbl-click restore |
| **P7** nav bus + tags | `feat/p7-interop` (`1ef0301`) | ❌ **NO** | `navSlice`, `lib/tags.js`, `TagPill`, `ScopeChip` absent; **blocks P8** |
| P9 subjects | `feat/p9-subjects` | ✅ yes (`c795bc1`) | — |
| P10 timetable to-dos | `feat/p10-timeline-todos` | ✅ yes (`b393d36`) | — |
| P11 quick-add + counter | `feat/p11-quickadd-counter` | ✅ yes (`75deb5c`) | — |
| P12 bulk task entry | `feat/p12-ai-bulkadd` | ✅ yes (`18747ef`) | — |
| P13 forest sprites | `feat/p13-forest-sprites` | ✅ yes (`58d9919`) | — |
| Scorecard extra | `feat/scorecard-wip` | ✅ yes (`0275011`) | integrated as a widget; **undocumented** in `claude.md` |

**Parallel "wave 3" session (do not collide):** two live worktrees —
`E:/anti-projects/protrack-p2` on `feat/p2-gcal` (`35ed4b4`, committed minutes ago) and
`E:/anti-projects/protrack-p6` on `feat/p6-voice` (currently at `development` HEAD, just
started). Wave 3 per the roadmap = **P2 (Google Calendar), P6 (natural voice), P8
(per-module cross-links)**. P8 has no branch yet and **cannot start until P7 is merged.**

### 1.2 Trial-merge results (non-destructive `git merge-tree`)

| Branch → `development` | Conflicts | Assessment |
|---|---|---|
| `feat/p3-pip` | `CHANGELOG.md` only | trivial — `electron/main.js` + `Dashboard.jsx` auto-merge clean |
| `feat/p4b-habit-prompts` | `CHANGELOG.md` only | trivial |
| `feat/p7-interop` | `CHANGELOG.md` + `src/components/layout/BoardCanvas.jsx` | small — BoardCanvas conflict is the P9–P13 scorecard `ALL_SWAPPABLE` line vs P7's context prop; `claude.md` + `uiSlice.js` auto-merge clean |

---

## 2. Cross-cutting findings (grouped)

### A — Integration gaps (highest impact)

| # | Finding | Evidence | Fix |
|---|---|---|---|
| A1 | **P3 done but unmerged** → `FloatingFocusPip.jsx` + `PipFocusWindow.jsx` are still imported and rendered in `Dashboard.jsx:31-32,326-327` (roadmap flags both as dead-on-desktop). PiP Expand (`Maximize2`) and Close (`X`) both call `exitPip`; no double-click-to-restore. | `Dashboard.jsx:326`, roadmap P3 brief | Merge `feat/p3-pip` (resolves the dead mounts + adds dbl-click + honest buttons + `pip.test.js`). |
| A2 | **P7 done but unmerged** → no `src/store/slices/navSlice.js`, no `src/lib/tags.js`. `TodayAgenda.jsx:195` still has `// TODO(P7): openModule(...)`; `TimetableWidget.jsx:39` still has `// TODO(P8)`. Blocks the parallel P8. | `ls` misses both files; grep of TODO anchors | Merge `feat/p7-interop` (adds `navSlice`, `tags.js`, `TagPill`, `ScopeChip`, `navSlice.test.js`, `tags.test.js`). Resolve the `BoardCanvas.jsx` conflict. |
| A3 | **P1 day-view never got kanban tasks.** `TimetableWidget.jsx:40 const DAY_TASKS = []`, passed at `:404 tasks={DAY_TASKS}`. `buildDayTimeline` fully supports `tasks` + carry-forward, but the widget feeds it an empty array — so tasks with `dueAt` never appear in the merged day timeline and never carry forward. | `dayAgenda.js:262-276` ready; `TimetableWidget.jsx:40` stub | Wire the already-subscribed `useTasks(activeModeId)` output into `TodayAgenda` via the widget. One bounded, already-existing listener — no new reads. (Roadmap P1 "Done when" + P10 carry-forward both depend on this.) |
| A4 | **P4b unmerged** — habit-reminder prompts can dogpile; the "one at a time, snooze once, auto-miss" fix sits on a branch. | `feat/p4b-habit-prompts` diff: `useHabitReminders.js` +76, `promptSlice.js` +34 | Merge `feat/p4b-habit-prompts`. |

### B — Dead code / debris on `development`

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | `src/components/wellness/HabitReminderToast.jsx` — orphaned; no importer (grep: only its own definition + stale comments in `audioFX.js`/`RoutinePromptBody.jsx`). Superseded by `RoutinePromptBody`. | grep | Delete after P4b merges (P4b touches the same area — sequence it after). |
| B2 | `checkinSlice.js` still exports `checkinPrompt`, `setCheckinPrompt`, `clearCheckinPrompt` — unused since P4 moved check-ins to `promptSlice`. | `checkinSlice.js:12,15,16` | Remove the three; keep the bounded `checkins` listener + `recent` state. Update `checkinSlice` doc comment. |
| B3 | `FloatingFocusPip.jsx` / `PipFocusWindow.jsx` dead-on-desktop but mounted (same as A1). | `Dashboard.jsx:326-327` | Handled by A1 (P3 merge removes `FloatingFocusPip.jsx`, scopes `PipFocusWindow` to real browsers). |
| B4 | `src/assets/forest/trees-2.jpg` (4.28 MB), `trees.jpg` (215 KB), `base-shrubs.jpg` (403 KB) — source sheets, unreferenced by code (only `README.md` documents provenance). Not bundled (no `import`), but 4.9 MB of binaries in git. `shrub-01..03.png` are now unused too (shrubs removed in `a68f3ab` per your request). | grep; `ls` | **Low priority.** Propose: keep the small two + README for provenance, `git rm` the 4.28 MB `trees-2.jpg`, and either wire `SpriteShrub` back as an opt-in or `git rm` the 3 shrub PNGs. Confirm before deleting assets. |

### C — Scorecard extra: integrated as a widget, not as a first-class citizen

| # | Finding | Evidence | Fix |
|---|---|---|---|
| C1 | `claude.md` (the architectural blueprint) has **zero** mention of the scorecard/exam suite: `ScorecardWidget`, `src/components/scorecard/*` (7 files), `scorecardService`, `examService`, `scorecardParser`, `useScorecards`, `useExams`, `EXAM_RETENTION_DAYS`, the `html-to-image` dependency, or the Firestore collections. | grep of `claude.md` | Add a §3 data-model block (`users/{uid}/scorecards`, `users/{uid}/exams`, retention/soft-delete) and a §4 flow paragraph. Add to the §1 `src/` tree. |
| C2 | Scorecard has no phase brief and is absent from the roadmap's "Cross-cutting verification" checklist and §6 P9–P13 smoke list. | roadmap grep | Add a short "Scorecard (extra)" brief to the roadmap + a smoke bullet, so it is held to the same standard. |
| C3 | `ScorecardWidget.jsx` carries 10 unused-import lint warnings (`Layers`, `Filter`, `ArrowUpRight`, `ChevronRight`, `Clock`, `Target`, `Percent`, `maximizeWidget`, `examsLoading`, `scorecardsLoading`). | `npm run lint` output | Remove unused imports/vars; if `examsLoading`/`scorecardsLoading` should drive a skeleton, wire them (see C4). |
| C4 | **Verify** (read pass in Step 2): empty state (no exams), loading skeleton, AI-coach failure path when no Gemini key, `scorecardParser` fallback when Gemini unavailable, `ScorecardDetailModal` overflow with long mistake text, `html-to-image` export failure, mode-scoped subscription teardown on scope switch, `ExamEditorModal` vs `ScorecardEditorModal` responsibility overlap, `DeletedExamsModal` retention-countdown correctness (`getExamDaysRemaining`). | — | One consistency + edge-case pass; fixes folded into the scorecard commit. |
| C5 | `firestore.rules` — OK. The catch-all `match /users/{userId}/{document=**}` owner-only rule already covers `scorecards`/`exams`. No rules change needed; note it in the plan so we don't "fix" a non-issue. | `firestore.rules:22-30` | none |

### D — "Feel like one product" consistency pass (P1–P13)

| # | Finding | Fix |
|---|---|---|
| D1 | **Double-click-to-add** convention: roadmap mandates native `onDoubleClick` on empty containers, or the 280 ms single/double discriminator from `BoardCanvas.MiniCard` where single-click already acts. Verify P9 (`SubjectsWidget`), P10 (`TimetableGrid` cells), P11 (`TodosWidget` columns) all follow one of the two — not three ad-hoc timings. | Align to the shared pattern; extract a `useSingleDoubleClick` helper if 3+ call sites diverge. |
| D2 | **Island `kind` taxonomy:** `useAutoUpdate.jsx` pushes `kind:'update-downloading'` / `'update-ready'`; `chimeForIslandKind` (P0) maps a fixed set (`success`, `progress`, `water`, `sync-online`, `deadline`, `error`, `focus`, `break`, `info`). Confirm the update kinds resolve to a sensible chime (likely fall through to `notify`) and that P5's `SELF_CHIMED` skip-list is still correct. | Add `update-downloading`→(silent), `update-ready`→`success` to the map, or document the fallthrough as intentional. |
| D3 | **Naming drift:** subject editor is `SubjectEditorModal.jsx` in code; roadmap P9 brief header once says "restructures `SubjectDetail.jsx`", session report says `SubjectEditorModal`. Cosmetic — confirm one name is used in code + all three docs. | Doc-only alignment. |
| D4 | **Changelog coherence:** `CHANGELOG.md` has `## v2.2.0 — 2026-09-08` (from P9–P13). P3, P7, P4b each add their own `### Added` bullets under a conflicting heading (that's the trial-merge conflict). After merges, produce **one** clean `## v2.2.0` section covering P3/P4b/P7 + scorecard + website + auto-update, in the `## v<semver> — YYYY-MM-DD` format the release `awk` extractor requires. | Single consolidated changelog edit at the end. |
| D5 | **Version bump:** `package.json` is `2.1.1`; `CHANGELOG.md` top is `v2.2.0`; `src/lib/version.js` reads `__APP_VERSION__` from `package.json` at build. The desktop "vXXX" badge (`DynamicBranding`) and Settings → Changelog therefore show `2.1.1` while the changelog claims `2.2.0`. | Bump `package.json` to `2.2.0` (or `2.3.0` if you want auto-update to have a real upgrade target to test against — see §6) as the final consolidation commit. Add a `content/changelog.js`-visible entry (it reads `CHANGELOG.md?raw`, so the changelog edit covers it). |
| D6 | `src/lib/audioFX.js` header comment still lists `HabitReminderToast` as a consumer (stale after B1). | Update the comment when B1 lands. |

### E — Website (`src/components/marketing/LandingPage.jsx`) — Step 3

Last modified 2026-06-06; predates P0–P13 entirely.

| # | Finding | Fix |
|---|---|---|
| E1 | `FEATURES` (6 cards) is stale: "Workspace modes / deep focus forest / interactive calendar / activity rings / habits+kanban / AI companion". Missing everything shipped since: **day-at-a-glance timeline, daily check-ins + center-blur prompts, universal chimes, Google Calendar two-way sync (wave 3), Picture-in-Picture, exam scorecards + AI coach, natural assistant voice (wave 3), per-subject bulk task entry, timetable carry-forward, the raster forest**. | Rewrite `FEATURES` to ~8–10 accurate cards grouped (Plan / Focus / Reflect / Assist). Keep icon-per-card style. |
| E2 | `STEPS` shows only the QR handshake. `claude.md` §4 says desktop now also has **direct "Sign in with Google"** (`QrLoginScreen`). Copy is incomplete. | Add/adjust: "Download → Sign in (Google directly, or scan the QR from your phone) → your workspace opens." |
| E3 | No screenshots anywhere — the brief explicitly asks for "screenshots/descriptions". Currently pure text + `AuroraBackground`. | Add a screenshot strip (2–4 images). **Need input:** do you have current screenshots, or should I add captioned placeholder `<figure>`s wired to `src/assets/` for you to drop images into? |
| E4 | Copy contradiction: hero says "runs on a zero-cost backend" but the Wall of Honor section says "These supporters keep the servers running." | Reconcile to one story ("no servers to run — donations fund the founder's time / API costs", matching `SupportModal`). |
| E5 | `APP_LINKS.releasesLatest` → `github.com/thecheesybit/protrack/releases/latest`. Fine **iff** the repo/releases are public (roadmap §7 manual prereq). Flag, don't change. | Verify with you; add a fallback note if private. |
| E6 | Bug sweep while in there: `min-h-full` + `h-full` nesting on the scroll container; `whileInView` cards with no `once` re-animating; unused imports; `AuroraBackground` perf on low-end. Fix what's real. | Small pass. |

### F — Auto-update: make it fully silent — Step 4

Current chain (traced end-to-end):

- `electron/main.js:300 initAutoUpdate()` → `autoUpdater.autoDownload = true` ✅ (silent background download already works), `autoUpdater.autoInstallOnAppQuit = true` ✅.
- On `update-downloaded`, `src/hooks/useAutoUpdate.jsx:80` pushes **two** things at once: a sticky Dynamic Island card ("Update Ready to Install — Click here to restart") **and** a `react-hot-toast` with a "Restart" button (`:100-116`). Both call `desktopBridge.update.install()`.
- IPC `update:install` (`electron/main.js:866`) → `autoUpdater.quitAndInstall()` — **no arguments**, so `isSilent = false`.
- `electron-builder.yml:nsis` → `oneClick: false`, `allowToChangeInstallationDirectory: true`, `runAfterFinish: true`.

**Why you see "click Next, then the installer runs":** `oneClick: false` builds the *assisted*
NSIS installer (welcome page, install-dir page, Next/Install/Finish). `quitAndInstall()` with
no args runs that full wizard UI.

| # | Change | File |
|---|---|---|
| F1 | `nsis.oneClick: true` (one-click silent installer — no pages, just a progress bar). Drop `allowToChangeInstallationDirectory` (incompatible with one-click). Keep `perMachine: false`, `runAfterFinish: true`, `createDesktopShortcut`/`createStartMenuShortcut`. | `electron-builder.yml` |
| F2 | `update:install` → `autoUpdater.quitAndInstall(true, true)` (`isSilent=true`, `isForceRunAfter=true` → app relaunches itself after the silent swap). | `electron/main.js:866` |
| F3 | Keep `autoDownload`/`autoInstallOnAppQuit` as-is (already correct). | — |
| F4 | Collapse the double notification to **one** unobtrusive affordance (see §8 decision D2): either auto-restart after a short idle/grace with a 1-line Island notice, **or** a single "Restart to apply update" Island action. Remove the redundant `react-hot-toast`. | `src/hooks/useAutoUpdate.jsx` |
| F5 | `Settings → Updates` currently surfaces status from `updateSlice`; keep it, but the "Restart & install" button there also routes through `quitAndInstall(true,true)` now. Verify Store-build path (`isStoreBuild`) still short-circuits (it does — `main.js:301`, `876`). | `SettingsPanel.jsx` (surgical) |
| F6 | Document the new silent flow in `claude.md` §5b "CI/CD" / "Shipping targets" and in `CHANGELOG.md`. Note: one-click NSIS cannot prompt for install dir — acceptable for a single-user desktop app; existing installs upgrade in place. | docs |

`electron-updater` **does** cleanly support the fully-silent path, so the only open question
is the post-install UX (auto-restart vs one prompt) — §8 D2.

---

## 3. Phase-by-phase audit (spec vs. actual)

> ✅ implemented & consistent · 🟡 minor gap/polish · 🔴 integration gap

| Phase | Spec (roadmap) | Actual | Verdict | Action |
|---|---|---|---|---|
| **P0** sound | `lib/sound.js` bank + `chimeForIslandKind` + unified `protrack:sounds` flag + migration; `audioFX.js` shim | Present; `sound.test.js` (10 cases in `lib/__tests__`); `audioFX.js` is a re-export shim | ✅ | D2 (map update kinds), D6 (stale comment) |
| **P1** day-view | Merge *every* dated thing incl. **tasks with due dates**; works in All Scopes; footer | `dayAgenda.js` + `dayAgenda.test.js` complete & pure; `TodayAgenda` redesigned; **tasks fed `[]`** | 🔴 | **A3** — wire tasks |
| **P3** PiP | dbl-click restore; always-visible pause; honest Expand/Close; kill dead variants | Done on `feat/p3-pip`, **unmerged**; dead variants still mounted on `development` | 🔴 | **A1** — merge P3 |
| **P4** prompts | `promptSlice` + `CenterPrompt`; check-ins/routines/quotes through one shell; snooze-on-close | Present & merged; `CheckInCard.jsx` deleted ✅; `promptSlice.test.js` (P4b adds cases) | 🟡 | **B2** (dead `checkinSlice` fields), **A4/B1** (P4b + toast) |
| **P4b** habit dogpile | one-at-a-time, snooze once, auto-miss | Done on branch, **unmerged** | 🔴 | **A4** — merge P4b |
| **P5** chimes | chime once per new Island id; single toggle | `useIslandCycle` guards with `lastSoundedIdRef`; Settings routes to `setSoundsEnabled` | ✅ | D2 |
| **P7** interop | `navSlice` + `openModule` + back-stack; `lib/tags.js` (pure, tested) | Done on `feat/p7-interop`, **unmerged**; files absent from `development` | 🔴 | **A2** — merge P7 (unblocks wave-3 P8) |
| **P9** subjects | exhaustive scroll list; add-anywhere incl. All Scopes; persistent rail; dbl-click add | Merged; `SubjectsWidget` + `SubjectEditorModal` mode picker; two-pane hero rail | ✅ | D1 (dbl-click consistency), D3 (naming) |
| **P10** timetable to-dos | compact markers; gutter `ItemDetailPopover`; **display-only carry-forward**; dbl-click cell add | Merged; `ItemDetailPopover.jsx`; `dayAgenda.js` carry path + 7 tests; no `dueAt` writes | ✅ (blocked visibly by A3 for *tasks*) | depends on **A3** |
| **P11** quick-add + counter | `counts.js` pure; clickable "N open · M today · K overdue"; dbl-click todo columns | Merged; `counts.js` + `counts.test.js`; pill in `TimetableWidget` header | ✅ | D1 |
| **P12** bulk entry | `bulkParse.js` pure + tested; chunked `addTasksBulk` (≤400); mic; preview-before-write; `add_tasks_bulk` tool; `/tasks` | Merged; `bulkParse.js` (`MAX_BULK_ITEMS=500`, cap warning) + 11 tests; `SubjectQuickAdd.jsx`; tool + slash cmd | ✅ | verify preview modal edge cases (empty parse, all-removed, no-key hint) in Step 2 |
| **P13** forest sprites | crop 9 trees + shrubs to transparent PNG; raster `DayGrove`; keep session→tree mapping | Merged; 9 `tree-*.png` + 3 `shrub-*.png` + `ForestSprites.jsx`; `CalendarForest` uses `SpriteTree`; **shrubs removed entirely** per your later request (`a68f3ab`) | 🟡 | **B4** (unused source JPGs + unused shrub PNGs); roadmap "Done when" mentions shrubs — reconcile doc |
| **Scorecard** | (no brief) | 7 components + 3 services + 2 hooks + widget-registry entry + `html-to-image` | 🟡 | **C1–C4** — document + edge-case + delint |

**P2 (GCal) and P6 (voice) are explicitly out of scope for this consolidation** — the parallel
wave-3 session owns them. I will not touch `calendarService.js`, `useCalendarSync.js`,
`gcalMap.js`, `tts.js`, `HandsFreeTab.jsx`, `BackgroundHandsFree.jsx`, or the GCal parts of
`SettingsPanel.jsx` / `TimetableWidget.jsx`.

---

## 4. Fix plan — ordered, reviewable units

Each unit = one branch off `development` + one focused commit set, so you can review per area.
Proposed working branch: **`chore/consolidation-v2.1`** (or merge units straight to
`development` one at a time — your call, §8 D3).

### Unit 1 — ~~Land the finished-but-unmerged phases~~ → RETIRED (owner D1)
The parallel wave-3 session merges P2, P6, **P7, P4b, P3** into one `development`. This session
does no merges. When wave-3 ends, **re-baseline**: `git fetch`/`git log development`, re-run all
four gates, and re-verify these before starting Unit 2:
- `FloatingFocusPip.jsx` deleted + no longer imported in `Dashboard.jsx` (P3 landed)
- `HabitReminderToast.jsx` disposition after P4b (B1)
- `src/store/slices/navSlice.js` + `src/lib/tags.js` present (P7 landed)
- `useHabitReminders.js` has the dogpile guard (P4b landed)
- note anything wave-3 changed that shifts A3/B2/D1/D2 line numbers below.

### Unit 2 — Close the P1 task-listener gap (A3)
- `TimetableWidget.jsx`: replace `const DAY_TASKS = []` with the mode-scoped tasks already
  available via `useTasks(activeModeId)` (confirm the hook/selector; it feeds `SubjectsWidget`
  today). Pass into `TodayAgenda`. No new Firestore listener.
- Extend `dayAgenda.test.js`: a `dueAt` task shows on its day **and** carries forward when overdue.
- Manual: All Scopes day view shows cross-mode tasks with the mode dot.

### Unit 3 — Dead-code & slice cleanup (B1, B2, B3, D6)
- Delete `HabitReminderToast.jsx` (after Unit 1 step 1).
- Remove `checkinPrompt`/`setCheckinPrompt`/`clearCheckinPrompt` from `checkinSlice.js` + fix its doc comment; grep-confirm zero references.
- Fix `audioFX.js` header comment.
- `refactor:` commit; gates green.

### Unit 4 — Scorecard first-class pass (C1, C2, C3, C4)
- Delint `ScorecardWidget.jsx` (+ any sibling scorecard files with warnings).
- Edge-case pass on the 7 scorecard components (empty / loading / error / overflow / no-key AI).
- `claude.md`: add scorecard to §1 tree, §3 data model, §4 flows.
- `docs/V2.1_MULTI_AGENT_ROADMAP.md`: add a short "Scorecard (extra)" brief + smoke bullet.

### Unit 5 — Consistency pass (D1, D2, D3)
- Audit the 3 double-click-to-add call sites; unify on the shared discriminator (extract helper if needed).
- `chimeForIslandKind`: handle `update-downloading` / `update-ready` explicitly.
- Doc-only naming alignment for the subject editor.

### Unit 6 — Website (E1–E6)
- Rewrite `FEATURES` + `STEPS`; reconcile copy (E4); add screenshot strip (E3 — pending your input); fix real bugs (E6).
- No behavior change to `/link`, `/link-gcal`, routing.

### Unit 7 — Silent auto-update (F1–F6)
- `electron-builder.yml`: `nsis.oneClick: true` (+ drop `allowToChangeInstallationDirectory`).
- `electron/main.js`: `quitAndInstall(true, true)`.
- `useAutoUpdate.jsx`: collapse to one affordance per §8 D2.
- `claude.md` §5b + `CHANGELOG.md` note.
- **Cannot be end-to-end verified without a signed pair of releases** — I'll verify the code
  paths, the builder config, and a local packaged install; real OTA needs a `v2.2.0`→`v2.2.1`
  release cycle (§6).

### Unit 8 — Changelog + version (D4, D5)
- One consolidated `## v2.2.0 — 2026-09-08` section (P3, P4b, P7, scorecard docs, website, silent update).
- Bump `package.json` version.
- Gates green; final full smoke per roadmap §"Cross-cutting verification".

---

## 5. Sequencing with the parallel wave-3 session

```
wave-3 session ──▶ merges P2, P6, P7, P4b, P3 into `development`, then ends
                                    │
                        ┌───────────┘  (single merged `development`)
                        ▼
this session ──▶ re-baseline (gates + §4 Unit-1 re-verify checklist)
             ──▶ Units 2 → 8, one gate-green commit-group each, direct to `development`
             ──▶ final full smoke (roadmap §"Cross-cutting verification") + version bump
```

**No file-level coordination needed** — the two sessions do not run concurrently on
`development`. This session touches these files *after* wave-3 has landed everything, so its
edits sit on top of the merged result. Re-check line numbers in §2/§3 against the merged tree
during re-baseline (P2/P6/P3 edited `Dashboard.jsx`, `SettingsPanel.jsx`, `TimetableWidget.jsx`,
`claude.md`, `CHANGELOG.md`).

---

## 6. Testing auto-update for real

Silent-update behaviour can't be proven from source alone. Minimum real test:
1. Land consolidation, bump to `v2.2.0`, cut a GitHub release (installer + `latest.yml`).
2. Install `v2.2.0` locally.
3. Land a trivial change, bump `v2.2.1`, release.
4. Launch `v2.2.0`, confirm: silent download → (auto-restart **or** single prompt per D2) →
   relaunches on `v2.2.1` with **no NSIS wizard, no Next**.

Until then, Unit 7 ships as "code + config correct, locally packaged install verified,
OTA pending a release pair" — called out in the final summary as a known-unverified item.

---

## 7. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Merging P3/P7/P4b regresses a merged phase | Full gates + desktop smoke after each merge; branches trial-merge clean bar `CHANGELOG.md` |
| Wave-3 P8 built on pre-P7 `development` → conflicts | Land Unit 1 **first**, notify wave-3 immediately; P8 literally needs P7's files so this is net-positive |
| `nsis.oneClick: true` changes installer behaviour for *new* installs (no dir choice) | Acceptable for single-user desktop; documented; existing installs upgrade in place |
| Touching shared hotspots races the parallel session | Surgical anchored edits; Unit ordering in §5; `CHANGELOG.md` reconciled last |
| Website screenshots not available | Ship structure with captioned placeholders; you drop images later (E3) |
| `useTasks` selector for A3 not mode-scoped / adds a listener | Verify before wiring; if it would add a read, fall back to `// TODO` staying and document why |

---

## 8. Decisions — RESOLVED (see header block)

| # | Decision | Resolution |
|---|---|---|
| D1 | Who merges P3/P7/P4b (+P2/P6) | **Parallel wave-3 session** — this session does no merges; retires old Unit 1 |
| D2 | Silent-update post-install UX | **One "Restart to apply update" action** (no auto-relaunch) |
| D3 | Branch strategy | **Direct to `development`**, one gate-green commit-group per Unit 2–8 |
| D4 | Website screenshots | **Skipped this pass** — copy/features/steps only (E3 deferred) |
| D5 | Forest source-asset cleanup | **Open** — default keep; revisit later |

---

## 9. Deliverables checklist (from the brief)

- [x] `docs/CONSOLIDATION_PLAN_P1_P13.md` — this file (Step 1)
- [ ] P1–P13 + scorecard consolidated (Units 1–5, 8)
- [ ] Electron app matched (PiP via Unit 1; silent update via Unit 7)
- [ ] Website updated (Unit 6)
- [ ] Auto-update fully silent (Unit 7)
- [ ] Final summary of changes + residual risks
